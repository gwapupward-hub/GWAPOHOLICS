#!/usr/bin/env node
// Stream a PostgreSQL 18 pg_restore --data-only --schema=public SQL output.
// Count COPY rows only. Never print actual rows, Telegram IDs, or COPY data.
import { createInterface } from 'node:readline';

const required = ['players', 'quest_runs', 'virtual_ledger', 'command_receipts'];
const counts = Object.fromEntries(required.map(name => [name, 0]));
const seen = new Set();
let active = null;

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (active !== null) {
    if (line === '\\.') {
      active = null;
    } else {
      counts[active] += 1;
    }
    continue;
  }
  const match = /^COPY public\\.(players|quest_runs|virtual_ledger|command_receipts)\\s+\\(.*\\)\\s+FROM stdin;$/.exec(line);
  if (match) {
    active = match[1];
    if (seen.has(active)) {
      console.error('::error::Duplicate game COPY section in archive; rejecting.');
      process.exitCode = 1;
    }
    seen.add(active);
  }
}

if (active !== null || required.some(name => !seen.has(name) || counts[name] < 1)) {
  console.error('::error::Backup contains incomplete or empty public game data; archive upload blocked.');
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log('Archived game data verified: ' +
    required.map(name => `${name}=${counts[name]}`).join(' '));
}

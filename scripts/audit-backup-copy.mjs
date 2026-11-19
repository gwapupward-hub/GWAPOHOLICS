#!/usr/bin/env node
// Stream the actual dump's COPY sections. Only table names and counts leave this process.
import { createInterface } from 'node:readline';

const legacy = ['players', 'quest_runs', 'virtual_ledger', 'command_receipts'];
const founder = ['v2_schema_meta','v2_founders','v2_founder_telegram_accounts','v2_origin_runs',
  'v2_origin_quest_results','v2_origin_qualification','v2_capital_accounts','v2_capital_credit_ledger',
  'v2_origin_settlements','v2_reputation_events','v2_telemetry_events','v2_command_receipts','v2_businesses'];
const business = ['v2_capital_debit_ledger','v2_founder_decisions'];
const operations = ['v2_operating_cycles','v2_capacity_upgrades'];
const known = new Set([...legacy, ...founder, ...business, ...operations]);
const counts = new Map();
let section = null;

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (section !== null) {
    if (line === '\\.') section = null;
    else if (known.has(section)) counts.set(section, counts.get(section) + 1);
    continue;
  }
  const copy = /^COPY public\.(\w+)\s+\(.*\)\s+FROM stdin;$/.exec(line);
  if (!copy) continue;
  section = copy[1];
  if (!known.has(section)) continue;
  if (counts.has(section)) {
    console.error('::error::Duplicate game COPY section in archive.');
    process.exitCode = 1;
  }
  counts.set(section, 0);
}

const expectedVersion = Number(process.argv[2] ?? 1);
if (![1,2,3,4].includes(expectedVersion)) throw new Error("Unknown source schema generation");
const hasOperations = expectedVersion >= 4 || operations.some(name => counts.has(name));
const hasBusiness = expectedVersion >= 3 || hasOperations || business.some(name => counts.has(name));
const hasFounder = expectedVersion >= 2 || hasBusiness || founder.some(name => counts.has(name));
const expected = [...legacy, ...(hasFounder ? founder : []), ...(hasBusiness ? business : []), ...(hasOperations ? operations : [])];
if (section !== null || expected.some(name => !counts.has(name)) || legacy.some(name => !counts.get(name)) ||
    (hasFounder && !counts.get('v2_schema_meta'))) {
  console.error('::error::Archive has incomplete schema sections or missing required game data.');
  process.exitCode = 1;
}
if (!process.exitCode) {
  console.log('Archived table counts: ' + expected.map(name => name + '=' + counts.get(name)).join(' '));
  if (hasFounder && counts.get('v2_founders') === 0) console.log('Founder schema only. No founder gameplay to restore.');
}

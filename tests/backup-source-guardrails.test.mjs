import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const cwd = new URL('..', import.meta.url).pathname;
const expectedHost = 'ep-super-shadow-bci5cjya.c-16.us-east-1.aws.neon.tech';
const validURL = 'postgresql://gwapoholics_backup_reader:dummy-password@' +
  expectedHost + '/neondb?sslmode=require';
const tables = ['players', 'quest_runs', 'virtual_ledger', 'command_receipts'];

function sourceCheck(DATABASE_URL) {
  return spawnSync(process.execPath, ['scripts/verify-backup-source.mjs'], {
    cwd, env: {...process.env, DATABASE_URL}, encoding: 'utf8'
  });
}

function archiveInput(rowCounts) {
  return tables.map(name => [
    `COPY public.${name} (id) FROM stdin;`,
    ...Array.from({length: rowCounts[name]}, (_, i) => String(i+1)),
    String.raw`\.`
  ].join('\n')).join('\n') + '\n';
}

function archiveCheck(input) {
  return spawnSync(process.execPath, ['scripts/audit-backup-copy.mjs'], {
    cwd, input, encoding: 'utf8'
  });
}

test('backup source accepts only the expected direct Preview Neon database and read-only role', () => {
  const ok = sourceCheck(validURL);
  assert.equal(ok.status, 0, ok.stderr);
  assert.doesNotMatch(ok.stdout+ok.stderr, /dummy-password/);
  for (const invalid of [
    validURL.replace(expectedHost, 'ep-unrelated.c-16.us-east-1.aws.neon.tech'),
    validURL.replace('/neondb?', '/postgres?'),
    validURL.replace('gwapoholics_backup_reader', 'neondb_owner'),
    'not-a-database-url'
  ]) {
    const r = sourceCheck(invalid);
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.stdout+r.stderr, /dummy-password/);
  }
});

test('archive audit accepts all four populated game tables but never echoes row data', () => {
  const input = archiveInput({
    players: 2, quest_runs: 5, virtual_ledger: 7, command_receipts: 27
  });
  const result = archiveCheck(input);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /players=2/);
  assert.match(result.stdout, /command_receipts=27/);
  assert.doesNotMatch(result.stdout, /COPY |FROM stdin|dummy-password/);
});

test('archive audit rejects incomplete or empty game-table data', () => {
  const allEmpty = archiveCheck(archiveInput({
    players: 0, quest_runs: 0, virtual_ledger: 0, command_receipts: 0
  }));
  assert.notEqual(allEmpty.status, 0);
  const oneMissing = archiveCheck(archiveInput({
    players: 2, quest_runs: 1, virtual_ledger: 0, command_receipts: 1
  }));
  assert.notEqual(oneMissing.status, 0);
  const noCOPY = archiveCheck('-- PostgreSQL dump without data\n');
  assert.notEqual(noCOPY.status, 0);
});

test('scheduled upload is guarded by source identity and archived public game data', () => {
  const workflow = readFileSync(new URL('../.github/workflows/preview-backup.yml', import.meta.url), 'utf8');
  assert.match(workflow, /scripts\/verify-backup-source\.mjs/);
  assert.match(workflow, /scripts\/audit-backup-copy\.mjs/);
  assert.match(workflow, /pg_dump .*--schema=public/);
  assert.match(workflow, /pg_restore --data-only --schema=public/);
  assert.ok(workflow.indexOf('scripts/audit-backup-copy.mjs') <
    workflow.indexOf('Encrypt and upload immutable backup'));
});

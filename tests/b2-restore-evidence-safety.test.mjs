import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const script = 'scripts/collect-b2-restore-evidence.sh';
test('B2 recovery evidence shell script has valid Bash syntax', () => {
  const result = spawnSync('bash', ['-n', script], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
test('B2 recovery refuses to run without explicit disposable restore consent', () => {
  const env = {...process.env, GWAP_CONFIRM_DISPOSABLE_RESTORE: ''};
  for (const key of ['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','B2_OBJECT_KEY',
      'B2_ARCHIVE_VERSION_ID','B2_CHECKSUM_VERSION_ID','AGE_IDENTITY_FILE',
      'RESTORE_TEST_DATABASE_URL']) delete env[key];
  const result = spawnSync('bash', [script], {encoding:'utf8',env,timeout:3000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/RECOVERY_EVIDENCE=FAIL/);
  assert.doesNotMatch(result.stdout,/RECOVERY_EVIDENCE=PASS/);
});
test('restore is pinned to a new empty database with version and retention guards',()=>{
  const source=readFileSync(script,'utf8');
  assert.match(source,/gwap_b2_evidence_20261118/);
  assert.match(source,/ep-royal-math-bc1hxchn/);
  assert.match(source,/B2_ARCHIVE_VERSION_ID/);
  assert.match(source,/B2_CHECKSUM_VERSION_ID/);
  assert.match(source,/get-object-retention/);
  assert.match(source,/restore_target_not_empty/);
  assert.match(source,/--single-transaction --no-owner --no-acl --exit-on-error/);
  assert.match(source,/audit-backup-copy.mjs/);
  assert.match(source,/verify-restored-backup.sql/);
});

test('historical backup script is syntactically valid and fails without operator confirmation', () => {
  const path='scripts/archive-recovered-history.sh';
  const parsed=spawnSync('bash',['-n',path],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr);
  const env={...process.env};
  for (const key of ['HISTORICAL_SOURCE_DATABASE_URL','BACKUP_AGE_RECIPIENT',
      'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY']) delete env[key];
  env.GWAP_CONFIRM_HISTORICAL_BACKUP='';
  const refusal=spawnSync('bash',[path],{encoding:'utf8',env,timeout:3000});
  assert.notEqual(refusal.status,0);
  assert.match(refusal.stderr,/HISTORICAL_BACKUP=FAIL/);
  assert.doesNotMatch(refusal.stdout,/UPLOADED/);
});
test('historical backup is pinned to the approved read-only Neon branch and never uploads plaintext',()=>{
  const src=readFileSync('scripts/archive-recovered-history.sh','utf8');
  assert.match(src,/ep-aged-mountain-bcu7g4ps/);
  assert.match(src,/expected_history_counts_mismatch/);
  assert.match(src,/has_sequence_privilege/);
  assert.match(src,/gwapoholics_backup_reader/);
  assert.match(src,/not_read_only_source/);
  assert.match(src,/--schema=public/);
  assert.match(src,/audit-backup-copy\.mjs/);
  assert.match(src,/age --recipient/);
  assert.match(src,/--body "\$encrypted"/);
  assert.match(src,/\.dump\.age/);
});
test('restoration accepts distinct version-pinned current Preview and historical archives',()=>{
  const source=readFileSync('scripts/collect-b2-restore-evidence.sh','utf8');
  assert.match(source,/gwapoholics-\(preview\|recovery\)/);
  assert.match(source,/--version-id "\$B2_ARCHIVE_VERSION_ID"/);
  assert.match(source,/--version-id "\$B2_CHECKSUM_VERSION_ID"/);
});

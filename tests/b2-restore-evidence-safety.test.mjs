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

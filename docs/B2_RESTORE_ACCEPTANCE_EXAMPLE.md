# GWAPOHOLICS — B2 encrypted backup restore: operator acceptance example

**Status:** READY TO EXECUTE / **RECOVERY NOT YET PASSED**.  
**Tracking:** [#30](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/30) and [#34](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/34).  
**Environment scope:** GWAPOHOLICS **Preview-only** game data, not public production. Do not alter `@TestGwap_bot`, `@GwapoholicsBot`, production Neon, B2 retention or TON DNS.

## What has been independently verified

1. GitHub Actions encrypted backup job [run 43721534545](https://github.com/gwapupward-hub/GWAPOHOLICS/actions/runs/43721534545) successfully executed PostgreSQL 18 custom-format `pg_dump`, `age` encrypt, B2 archive + `.sha256` uploads, and local temp cleanup.
2. Real log output identifies the archive key **`postgres/gwapoholics-preview-20261115T135550Z-43721534545.dump.age`** in private bucket `gwapoholics-db-backups`; companion checksum key is **`postgres/gwapoholics-preview-20261115T135550Z-43721534545.dump.age.sha256`**.
3. Two existing Neon branches have valid data and passed the read-only validation SQL on November 15, 2026 ET: Preview `br-billowing-sea-bcx8nhn7`, and `restore-test/offsite-b2-2026-11-14` (`br-lively-voice-bcxqb39m`). **Both are existing branches; neither demonstrates import of the B2 archive.** Neon reports the latter's `init_source=parent-data`.

## Pass criteria

- [ ] Exact archived object version and separate checksum fetched using **read-only B2 credentials** to a secured, isolated operator machine.
- [ ] Encrypted archive SHA-256 equals the stored `.sha256` checksum exactly; record result, not credentials.
- [ ] B2 Object Lock / retain-until date confirmed on **both** objects or an explicitly documented alternative immutable retention proof; expected default retention is 30 days (verify rather than assume).
- [ ] Decrypt using the actual **private `age` identity** held outside GitHub (founder-controlled). Confirm `pg_restore --list` parses it.
- [ ] **Only the game `public` schema** from the source archive restored successfully and **atomically** with PostgreSQL 18 `pg_restore --schema=public --single-transaction` into a **NEW, independently verified EMPTY / DISPOSABLE** Neon database. Confirm its project/branch/endpoint; never use existing Preview, existing restore-test branch or main. The uploaded decrypted archive also contains **nine `neon_auth` tables** in addition to four `public` game tables, so restoring the entire archive would unnecessarily import authentication-related tables. This drill is scoped to game data recovery, **not** complete Neon Auth recovery.
- [ ] `scripts/verify-restored-backup.sql` returns all expected tables, primary keys, unique settlement index, identity sequence, and **ZERO** ledger-chain/balance/quest/duplicate/missing-settlement errors.
- [ ] Compare table counts and schema fingerprint to an **archive-time** source manifest if one was captured. Do not compare old backup counts against the current live Preview; gameplay may have changed the latter.
- [ ] Owner records redacted evidence plus cleanup status. Only then mark #30 as **PASS**; the public production gate #34 still needs its other checks.

## Operator example: secure machine only

Run on a **trusted workstation or dedicated short-lived restore runner**, **not** in Vercel's game runtime and **not** from a public GitHub Actions job. Install AWS CLI, `age`, PostgreSQL **18** client, and `psql`.

Configure the distinct B2 **read-only** profile `gwap-b2-restore-readonly` using a local credential manager. The following commands assume that setup already exists. **Never paste AWS credentials, Neon URL, plaintext dump or `age` private identity into chat, GitHub issues, CI logs or screenshots.**

```bash
set -euo pipefail
umask 077
mkdir -p "$HOME/gwapoholics-restore-check"
cd "$HOME/gwapoholics-restore-check"

export B2_ENDPOINT="https://s3.us-east-005.backblazeb2.com"
export B2_BUCKET="gwapoholics-db-backups"
export AWS_DEFAULT_REGION="us-east-005"
export AWS_PROFILE="gwap-b2-restore-readonly"
export ARCHIVE="gwapoholics-preview-20261115T135550Z-43721534545.dump.age"
export KEY="postgres/$ARCHIVE"

# Confirm object version, size and retention with authorized read-only permissions.
aws --endpoint-url "$B2_ENDPOINT" s3api head-object \
  --bucket "$B2_BUCKET" --key "$KEY" \
  --query '{size:ContentLength,version:VersionId,lockMode:ObjectLockMode,retainUntil:ObjectLockRetainUntilDate}'
aws --endpoint-url "$B2_ENDPOINT" s3api head-object \
  --bucket "$B2_BUCKET" --key "$KEY.sha256" \
  --query '{size:ContentLength,version:VersionId,lockMode:ObjectLockMode,retainUntil:ObjectLockRetainUntilDate}'

# Download the exact archive plus its separately uploaded hash.
aws --endpoint-url "$B2_ENDPOINT" s3 cp "s3://$B2_BUCKET/$KEY" ./backup.dump.age --no-progress
aws --endpoint-url "$B2_ENDPOINT" s3 cp "s3://$B2_BUCKET/$KEY.sha256" ./backup.dump.age.sha256 --no-progress

# CHECKSUM PASS only if this prints 'backup.dump.age: OK' and exits with status 0.
printf '%s  %s\n' "$(cat backup.dump.age.sha256)" backup.dump.age | sha256sum --check
```

If head-object lacks Object Lock fields, separately query `aws s3api get-object-retention --bucket ... --key ...` for each exact key with a key that permits `GetObjectRetention`. Some restricted B2 application keys may not expose retention metadata; that is **unknown**, not a pass.

**Before any restore,** confirm in the Neon Console that the destination is a newly created, empty, disposable restore target with no app integration. Record its **project/branch ID**, not credentials. `RESTORE_TEST_DATABASE_URL` must be obtained from that target through a private secret manager; use a PostgreSQL 18-compatible endpoint with verified TLS. The following commands are **not safe** if the URL points to Preview, production or a nonempty branch.

```bash
# AGE_IDENTITY_FILE is a secure LOCAL PATH provided by the owner,
# e.g. a protected location on the trusted runner. Never upload it to GitHub.
: "${AGE_IDENTITY_FILE:?Set path to the private age identity file securely}"
: "${RESTORE_TEST_DATABASE_URL:?Set NEW isolated disposable database URL securely}"

age --decrypt --identity "$AGE_IDENTITY_FILE" \
  --output ./backup.dump ./backup.dump.age
pg_restore --list ./backup.dump >/dev/null

# Preflight: should output 0 before any restore.
psql -X -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" \
  -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public';"

# Run ONLY after verifying 0 tables and independently checking branch identity.
# Do not use --clean or --create. Atomic restore aborts on SQL error.
pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" \
  --schema=public --single-transaction --no-owner --no-acl --exit-on-error ./backup.dump

# From a clean local checkout of the approved repository:
psql -X -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" \
  -f scripts/verify-restored-backup.sql

# Restrict evidence to sanitized summary, object IDs and test statuses.
# Safely remove local plaintext only after recording the evidence.
rm -f ./backup.dump ./backup.dump.age ./backup.dump.age.sha256
```

**Important:** the archive source is a *Preview* database snapshot. It may include real Telegram user IDs and game records; never upload the decrypted archive or query row-level records to an issue or artifact.

## Example evidence record (ILLUSTRATIVE — not a completed test)

```yaml
test: GWAPOHOLICS B2 encrypted Preview recovery
status: PENDING
source_workflow_run: 43721534545
archive_key: postgres/gwapoholics-preview-20261115T135550Z-43721534545.dump.age
archive_version_id: to_be_verified_privately
archive_sha256_result: PENDING
checksum_object_result: PENDING
age_decrypt: PENDING
pg_restore_list: PENDING
restore_exit_code: PENDING
isolated_neon_branch_id: PENDING_new_empty_branch
postgres_version: "18.x (verify)"
object_lock_retention: PENDING_for_both_objects
table_counts: PENDING_snapshot_relative
required_schema_checks: PENDING
ledger_integrity_mismatch_counts: PENDING
plaintext_cleanup: PENDING
operator: PENDING
founder_acceptance: PENDING
```

A successful upload, a `parent-data` Neon branch, all-green CI, and an unchanged Preview balance are **not** sufficient substitutes for a proven download–decrypt–restore pipeline.

## Scope of evidence

The static SQL verifier was dry-run via read-only Neon queries against Preview and the older parent-data test branch: four table and structural checks all true; integrity mismatch counts all zero. **Those tests prove only that the verifier works on existing databases, not that recovery has been completed.**

Ref: [PostgreSQL 18 pg_restore documentation](https://www.postgresql.org/docs/18/app-pgrestore.html); [Backblaze B2 Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock).

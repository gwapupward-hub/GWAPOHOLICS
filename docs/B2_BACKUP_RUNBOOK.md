# GWAPOHOLICS — Encrypted offsite Preview backups

Status: **Prepared in PR only; not operational until secrets, bucket retention, and restore testing are verified.** No production deployment is authorized.

## Destination
- Provider: Backblaze B2 S3 API
- Private bucket: `gwapoholics-db-backups`
- Endpoint: `https://s3.us-east-005.backblazeb2.com`
- Prefix: `postgres/`
- Schedule: 06:17 UTC daily and manual dispatch, after this workflow is merged to default branch
- Format: PostgreSQL 18 `pg_dump -Fc`, encrypted with age (recipient public key), plus SHA-256 checksum
- Desired retention: 30-day Object Lock default retention (configure and verify in B2 dashboard). Do not assume the workflow enforces retention.

## Required GitHub Environment
Create environment `preview-backup` in repository Settings → Environments. Configure:

| Kind | Name | Value |
| --- | --- | --- |
| Environment secret | `NEON_PREVIEW_BACKUP_DATABASE_URL` | Dedicated **read-only** Postgres role on the **Preview** Neon branch, TLS required |
| Environment secret | `B2_BACKUP_KEY_ID` | Restricted B2 key ID |
| Environment secret | `B2_BACKUP_APPLICATION_KEY` | Restricted B2 application key |
| Environment variable | `BACKUP_AGE_RECIPIENT` | age public recipient (`age1...`) |

Never commit or share secrets. Generate the age identity on a trusted local machine with `age-keygen -o gwapoholics-backup-identity.txt`. Save the identity securely outside GitHub, Backblaze, and the backup runner; only the public recipient belongs in GitHub.

B2 key should be bucket-scoped, limited to `postgres/`, and allow upload; the AWS CLI upload may need bucket-list capability. Do **not** grant deletion permission. For restore, create a distinct bucket-scoped read-only key.

**Database permissions:** A dedicated backup role needs CONNECT on database, USAGE on application schema(s), SELECT on all tables, and permissions to read sequences if required. Restrict scope to Preview and test `pg_dump` before relying on the schedule. Avoid putting raw connection URLs in workflow logs.

## Manual first backup
1. Verify B2 bucket is private, Object Lock enabled, **default** 30-day retention configured, and a lifecycle policy is not undermining the recovery window.
2. Create the GitHub Environment and its three secrets + one public variable.
3. Merge this PR only after review (merge does not deploy production). From GitHub Actions, dispatch **Encrypted Neon Preview backup**.
4. Verify successful run, two objects under `postgres/`, nonzero encrypted archive, and B2 Object Lock retention metadata.
5. Confirm the checksum against the downloaded encrypted archive.

## Isolated restore drill
Perform from a trusted workstation or ephemeral secured runner, never from the app runtime:

```bash
# Supply these through a secret manager; do not paste values into chat.
export AWS_ACCESS_KEY_ID=...            # distinct read-only B2 key
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-005
export B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
export B2_BUCKET=gwapoholics-db-backups

# Replace <archive> with an actual object name listed in B2.
aws --endpoint-url "$B2_ENDPOINT" s3 cp "s3://$B2_BUCKET/postgres/<archive>" ./backup.dump.age
aws --endpoint-url "$B2_ENDPOINT" s3 cp "s3://$B2_BUCKET/postgres/<archive>.sha256" ./backup.dump.age.sha256
printf '%s  %s\n' "$(cat backup.dump.age.sha256)" backup.dump.age | sha256sum --check
age --decrypt --identity ./gwapoholics-backup-identity.txt --output ./backup.dump ./backup.dump.age
pg_restore --list ./backup.dump >/dev/null
```

Restore into a **new, isolated, empty** PostgreSQL 18 database, NEVER the Preview or production database:

```bash
# RESTORE_TEST_DATABASE_URL must point to the disposable restore database only.
pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" --no-owner --no-acl --exit-on-error ./backup.dump
```

Compare the four public tables (`players`, `quest_runs`, `command_receipts`, `virtual_ledger`) against the source snapshot and validate schema, indexes, constraints, and ledger settlement invariants. Clean up downloaded plaintext dumps and credentials securely. A successful upload **alone is not a verified backup**.

## Alerting and operational constraints
- Enable GitHub Actions workflow failure notifications or external alerting; a silent failed schedule is unacceptable.
- Record backup run ID, object name, retention-until date, encrypted checksum, and restore test result in a private operations log.
- Rotate keys periodically and on suspected exposure; test a restore after any rotation.
- GitHub-hosted runners and scheduled workflows have availability and schedule limitations. Monitor for missed daily backups.
- No production secrets, production database, official Telegram bot, or production domain are involved.

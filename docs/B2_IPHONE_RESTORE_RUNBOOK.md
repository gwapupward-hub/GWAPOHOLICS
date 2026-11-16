# GWAPOHOLICS — iPhone-only encrypted B2 recovery drill

**Status:** Restore destination **PROVISIONED AND VERIFIED EMPTY**; encrypted archive download/decrypt/`pg_restore` **NOT YET EXECUTED**.

This is an iPhone-local operator workflow, not an app runtime, GitHub secret, or public production deployment. The private `age` identity stays on the owner's iPhone and is never pasted into chat, GitHub, or a hosted workflow.

## Confirmed restore destination

- Neon project: `square-mode-74279855` (GWAPOHOLICS dedicated Preview project)
- Separate disposable branch: `restore-drill/b2-iphone-20261116`
- Branch ID: `br-damp-scene-bc9ep85r`
- **New empty database within that branch:** `gwap_b2_restore_20261116`
- Database role: `neondb_owner`
- Version: PostgreSQL `18.7`, queried Nov 15 ET / Nov 16 UTC
- Independent read-only preflight: `SELECT count(*) FROM pg_tables WHERE schemaname = 'public'` returned **0**.
- **Critical isolation fact:** This new *branch* was created with `init_source=parent-data` (Neon default) and its inherited `neondb` database is **not empty**. Only the newly created database `gwap_b2_restore_20261116` is an authorized `pg_restore` target. Never use `neondb`, live Preview, main, or the older `restore-test/offsite-b2-2026-11-14`.

Only restored data imported into the new empty database can prove B2 backup recovery. The branch's copy-on-write inherited rows are not recovery proof.

## The exact two files to download in iPhone Safari

Sign in to the owner's **Backblaze B2 Console** with MFA. Open the private bucket `gwapoholics-db-backups`, browse `postgres/`, and download these two files **into the iPhone Files app**, preferably into a dedicated `B2 Restore Drill` folder:

1. `gwapoholics-preview-20261115T135550Z-43721534545.dump.age`
2. `gwapoholics-preview-20261115T135550Z-43721534545.dump.age.sha256`

These object names come directly from the successful [encrypted backup GitHub Actions run 43721534545](https://github.com/gwapupward-hub/GWAPOHOLICS/actions/runs/43721534545). **Downloading has not yet been confirmed**.

In the B2 web console, inspect Object Lock/retention of **both** objects and capture **only** the retain-until date and confirmation that both remain immutable. Do not upload screenshots showing B2 credentials, tokens or sensitive account information.

## Set up an iPhone-local shell (no cloud decryption)

Install **[iSH Shell](https://apps.apple.com/us/app/ish-shell/id1436902243)** from the App Store. iSH is an Alpine-based local shell and can import Files folders. On the phone, run:

```sh
cat /etc/alpine-release
cat /etc/apk/repositories
apk update
apk search -x age
apk search -x postgresql18-client
```

**Safety decision:** Proceed only if the existing signed package sources offer `age` and PostgreSQL **18** client, or if an operator separately verifies a supported Alpine upgrade. Some iSH installations ship old pinned repositories; **do not blindly replace repositories, mix release versions or download random binaries**. If `postgresql18-client` is unavailable, stop and use a separate reviewed iPhone-controlled recovery environment instead. PostgreSQL 13/14 `pg_restore` cannot be assumed to parse PostgreSQL 18 custom-format archives.

If both packages are available:

```sh
apk add age postgresql18-client curl coreutils ca-certificates
age --version
pg_restore --version
```

Verify that `pg_restore --version` prints **18.x**. The locally installed `age` must support the private identity format.

## Import encrypted files and point to the identity without sharing its contents

In iSH, mount the iPhone Files folder containing the two downloads. The `mount -t ios` command opens the iOS folder picker. Give it access **only to the designated B2 folder**, not your entire iCloud Drive.

```sh
mkdir -p /mnt/b2 /mnt/age-private /root/gwap-b2-restore
mount -t ios . /mnt/b2
```

To use the encrypted identity file, mount **only the dedicated folder holding your founder-owned private `age` identity** at `/mnt/age-private`. The file must stay outside GitHub and ChatGPT. If it exists only inside a secure vault app, use that app's local Files-export feature temporarily and remove that export afterward; do not share it over chat.

```sh
mount -t ios . /mnt/age-private
cd /root/gwap-b2-restore
cp /mnt/b2/gwapoholics-preview-20261115T135550Z-43721534545.dump.age ./backup.dump.age
cp /mnt/b2/gwapoholics-preview-20261115T135550Z-43721534545.dump.age.sha256 ./backup.dump.age.sha256
```

**Verify SHA-256 before decrypting:**

```sh
printf '%s  %s\n' "$(cat backup.dump.age.sha256)" backup.dump.age | sha256sum -c -
```

Required outcome: `backup.dump.age: OK`. Any other result = STOP.

**Decrypt locally on the iPhone:** Replace the placeholder below **with only the filename, not the key itself**.

```sh
age --decrypt --identity "/mnt/age-private/REPLACE_WITH_AGE_IDENTITY_FILENAME" --output ./backup.dump ./backup.dump.age
pg_restore --list ./backup.dump >/dev/null
```

Both commands must exit successfully. The plaintext backup contains real Preview game records and must remain private and local.

## Obtain the exact one-use restore database URL privately

Open **[Neon Console](https://console.neon.tech/)** in Safari and select project `square-mode-74279855`. Select branch `restore-drill/b2-iphone-20261116` and **database `gwap_b2_restore_20261116`**, role `neondb_owner`, direct/unpooled connection. Copy the private connection URI **locally to your clipboard**, confirm TLS verification (`sslmode=verify-full` with appropriate trust roots), and never paste the URI into ChatGPT or GitHub.

In iSH, avoid putting a password or database URL into typed commands saved in shell history. Instead enter it when prompted:

```sh
printf 'Paste ONLY the disposable Neon database connection URL: '
IFS= read -r RESTORE_TEST_DATABASE_URL
export RESTORE_TEST_DATABASE_URL
```

Note: the above prompt is **visible input** on some iSH builds. Use a supported silent/read-secret prompt when available, or paste inside a temporary private shell session and clear clipboard immediately afterward. Never take a screenshot showing the URI.

**Critical preflight, before any restore:**

```sh
psql -X -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" -Atqc 'SELECT current_database()'
psql -X -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
```

The exact outputs MUST be:

```text
gwap_b2_restore_20261116
0
```

**DO NOT CONTINUE** if the database is `neondb` or any other name, or if the table count is not zero.

## Restore and verify — only after the correct empty-database preflight

```sh
pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" \
  --single-transaction --no-owner --no-acl --exit-on-error \
  ./backup.dump

curl -fsSLo ./verify-restored-backup.sql \
  "https://raw.githubusercontent.com/gwapupward-hub/GWAPOHOLICS/main/scripts/verify-restored-backup.sql"

psql -X -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" \
  -f ./verify-restored-backup.sql
```

**PASS conditions:** exit code zero, four expected game tables with matching source **archive-time** row counts, all required keys/indexes/identity sequence TRUE, all ledger and quest mismatch totals ZERO. Do not mistake the earlier inherited branch records for restored records. The archive-time source snapshot may predate the latest Preview gameplay.

The original run did not save a signed archive-time counts manifest; record the recovered snapshot counts as `observed_from_archive`, and compare to a true archived manifest if later recovered. A schema and ledger consistency pass is possible even when historical source counts are unavailable, but note the missing comparison in the report rather than claiming independently reconciled snapshot counts.

## Required sanitized completion report — share ONLY these fields

```text
Archive SHA-256: PASS / FAIL
age decrypt: PASS / FAIL
pg_restore --list: PASS / FAIL
Restore database name: gwap_b2_restore_20261116
pg_restore: PASS / FAIL
Four table/index checks: PASS / FAIL
Ledger/quest mismatch totals: 0 / other
Restored table row counts: players __, quests __, ledger __, receipts __
B2 30-day retention for BOTH objects: VERIFIED / UNKNOWN
Archive-time source count comparison: PASS / UNKNOWN
Local plaintext cleanup: YES / NO
```

Don't share identities, B2 access keys, private object download URLs, connection strings, raw SQL row data or screenshots containing them.

## Cleanup and sign-off

After verifying and recording the sanitized results:

```sh
unset RESTORE_TEST_DATABASE_URL
rm -f /root/gwap-b2-restore/backup.dump /root/gwap-b2-restore/backup.dump.age \
  /root/gwap-b2-restore/backup.dump.age.sha256
umount /mnt/age-private
umount /mnt/b2
```

Delete any additional plaintext dump in iPhone Files and clear temporary copies of the private identity exported from secure storage; note that ordinary file deletion may not guarantee secure erasure on flash storage. Keep the original encrypted backup and protected original key. Do **not** delete the Neon restore database/branch until a sanitized test record has been accepted by issue #30, then remove those disposable resources through an explicitly approved cleanup.

**Operational caveat:** iOS may suspend a foreground terminal when you switch apps, and x86 emulation may be slow. Use Wi-Fi, keep iSH in foreground during decrypt/restore, and do not repeatedly retry a partially completed restore in the same database; if restore errors, investigate and use another empty isolated database.

## Recovery evidence status

- **DONE:** dedicated new branch and new empty database created and inspected; no app connected.
- **DONE:** backup upload and existing read-only verification SQL preparation.
- **PENDING:** iPhone B2 download, checksum, age decrypt, actual pg_restore and sanitised acceptance.
- **PENDING:** independently verify B2 retain-until metadata on both objects.
- **NOT AUTHORIZED:** public production, official bot or DNS changes.

Sources: [iSH package management](https://github-wiki-see.page/m/ish-app/ish/wiki/Using-iSH), [iSH Files folder mounting](https://github-wiki-see.page/m/ish-app/ish/wiki/Mounting-other-file-providers), [PostgreSQL 18 pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

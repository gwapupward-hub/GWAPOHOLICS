#!/usr/bin/env bash
# Manual owner-side encrypted backup of historical five-quest state; no hosted secrets.
set -Eeuo pipefail
umask 077
fail() { printf 'HISTORICAL_BACKUP=FAIL reason=%s\n' "$1" >&2; exit 1; }
for n in HISTORICAL_SOURCE_DATABASE_URL BACKUP_AGE_RECIPIENT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  [[ -n "${!n:-}" ]] || fail "missing_$n"
done
[[ "${GWAP_CONFIRM_HISTORICAL_BACKUP:-}" == "yes" ]] || fail 'explicit_confirmation_required'
[[ "$BACKUP_AGE_RECIPIENT" == age1* ]] || fail 'invalid_public_age_recipient'
for cmd in psql pg_dump pg_restore age aws node date mktemp sha256sum cut; do
  command -v "$cmd" >/dev/null || fail "missing_tool_$cmd"
done
[[ "$(pg_dump --version)" == *" 18."* ]] || fail 'postgres_18_required'
[[ -f scripts/audit-backup-copy.mjs ]] || fail 'run_from_repository_root'
node --input-type=module <<'JS' || fail 'wrong_historical_source'
const raw=process.env.HISTORICAL_SOURCE_DATABASE_URL||'';
try {
  const u=new URL(raw);
  if (!['postgres:','postgresql:'].includes(u.protocol) ||
      u.hostname!=='ep-aged-mountain-bcu7g4ps.c-16.us-east-1.aws.neon.tech' ||
      decodeURIComponent(u.pathname)!=='/neondb' ||
      decodeURIComponent(u.username)!=='gwapoholics_backup_reader' ||
      !u.password) process.exit(1);
} catch { process.exit(1); }
JS
role_check="$(psql -X -At -F '|' -v ON_ERROR_STOP=1 "$HISTORICAL_SOURCE_DATABASE_URL" -c "
SELECT current_user,current_database(),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('players','quest_runs','virtual_ledger','command_receipts')),
  (SELECT bool_and(has_table_privilege(current_user,format('public.%I',t.table_name),'SELECT')) FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_name IN ('players','quest_runs','virtual_ledger','command_receipts')),
  (SELECT bool_or(has_table_privilege(current_user,format('public.%I',t.table_name),'INSERT,UPDATE,DELETE,TRUNCATE')) FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_name IN ('players','quest_runs','virtual_ledger','command_receipts')),
  has_sequence_privilege(current_user,'public.virtual_ledger_id_seq','SELECT'),
  has_sequence_privilege(current_user,'public.virtual_ledger_id_seq','USAGE')")" \
  || fail 'source_access_failure'
[[ "$role_check" == 'gwapoholics_backup_reader|neondb|4|t|f|t|f' ]] || fail 'not_read_only_source'
dir="$(mktemp -d "${TMPDIR:-/tmp}/gwap-history-backup.XXXXXXXX")"
trap 'rm -rf -- "$dir"' EXIT
dump="$dir/history.dump"
encrypted="$dir/history.dump.age"
pg_dump --dbname="$HISTORICAL_SOURCE_DATABASE_URL" --schema=public \
  --format=custom --no-owner --no-acl --file="$dump" || fail 'pg_dump_failed'
pg_restore --list "$dump" >/dev/null || fail 'toc_invalid'
archive_counts="$(pg_restore --data-only --schema=public --file=- "$dump" \
  | node scripts/audit-backup-copy.mjs)" || fail 'empty_archive_copy'
[[ "$archive_counts" =~ players=[0-9]+.*quest_runs=[0-9]+.*virtual_ledger=[0-9]+.*command_receipts=[0-9]+ ]] || fail 'counts_missing'
[[ "$archive_counts" == *"players=2 quest_runs=5 virtual_ledger=7 command_receipts=27" ]] || fail 'expected_history_counts_mismatch'
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$dump" || fail 'encrypt_failed'
checksum="$(sha256sum "$encrypted" | cut -d' ' -f1)"
[[ "$checksum" =~ ^[a-f0-9]{64}$ ]] || fail 'checksum_invalid'
printf '%s\n' "$checksum" > "$dir/history.dump.age.sha256"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
epoch="$(date -u +%s)"
key="postgres/gwapoholics-recovery-$stamp-$epoch.dump.age"
endpoint="https://s3.us-east-005.backblazeb2.com"
bucket="gwapoholics-db-backups"
# Object Lock verification requires separate readFileRetentions permission.
archive_version="$(aws --endpoint-url "$endpoint" s3api put-object \
  --bucket "$bucket" --key "$key" --body "$encrypted" --query VersionId --output text)" || fail 'archive_upload_failed'
checksum_version="$(aws --endpoint-url "$endpoint" s3api put-object \
  --bucket "$bucket" --key "$key.sha256" --body "$dir/history.dump.age.sha256" \
  --query VersionId --output text)" || fail 'checksum_upload_failed'
[[ "$archive_version" != 'None' && -n "$archive_version" &&
   "$checksum_version" != 'None' && -n "$checksum_version" ]] || fail 'missing_version_ids'
printf 'HISTORICAL_BACKUP=UPLOADED_NOT_RESTORED\n'
printf 'source=isolated_historical_backup_copy branch=br-round-hat-bcrldljj\n'
printf 'archive_counts=%s\n' "$archive_counts"
printf 'object_key=%s\narchive_version_id=%s\nchecksum_version_id=%s\n' "$key" "$archive_version" "$checksum_version"
printf 'encrypted_sha256=%s\nretention_verification=PENDING\nrestore_verification=PENDING\n' "$checksum"

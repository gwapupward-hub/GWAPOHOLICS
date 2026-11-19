#!/usr/bin/env bash
# GWAPOHOLICS: local, owner-controlled B2 restore proof. Writes ONLY to a disposable DB.
# Never expose age identity, DB URL, user IDs or decrypted game records in logs.
set -Eeuo pipefail
umask 077
fail() { printf 'RECOVERY_EVIDENCE=FAIL reason=%s\n' "$1" >&2; exit 1; }
need() { [[ -n "${!1:-}" ]] || fail "missing_$1"; }
for k in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY B2_OBJECT_KEY B2_ARCHIVE_VERSION_ID \
         B2_CHECKSUM_VERSION_ID AGE_IDENTITY_FILE RESTORE_TEST_DATABASE_URL; do need "$k"; done
[[ "${GWAP_CONFIRM_DISPOSABLE_RESTORE:-}" == "yes" ]] || fail "isolated_target_confirmation_required"
[[ "$B2_OBJECT_KEY" =~ ^postgres/gwapoholics-(preview|recovery)-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump\.age$ ]] || fail "unrecognized_archive_key"
[[ -f "$AGE_IDENTITY_FILE" && -r "$AGE_IDENTITY_FILE" ]] || fail "age_identity_unavailable"
for cmd in aws age sha256sum pg_restore psql node date mktemp grep tr cut; do
  command -v "$cmd" >/dev/null || fail "missing_tool_$cmd"
done
[[ "$(pg_restore --version)" == *" 18."* ]] || fail "postgres_18_required"
[[ -f scripts/audit-backup-copy.mjs && -f scripts/verify-restored-backup.sql ]] || fail "run_from_repository_root"

# Pin the target endpoint AND database. All other branches fail closed.
node --input-type=module <<'JS' || fail "wrong_restore_database"
const raw=process.env.RESTORE_TEST_DATABASE_URL||"";
try {
  const u=new URL(raw);
  const host=u.hostname.replace(/-pooler(?=\.)/,"");
  if (!["postgres:","postgresql:"].includes(u.protocol) ||
      host!=="ep-royal-math-bc1hxchn.c-16.us-east-1.aws.neon.tech" ||
      decodeURIComponent(u.pathname)!=="/gwap_b2_evidence_20261118" ||
      !u.password) process.exit(1);
} catch { process.exit(1); }
JS

bucket="gwapoholics-db-backups"
endpoint="https://s3.us-east-005.backblazeb2.com"
work="$(mktemp -d "${TMPDIR:-/tmp}/gwap-b2-restore.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
archive="$work/backup.dump.age"
checksum="$work/backup.dump.age.sha256"
plaintext="$work/backup.dump"

# Download exact B2 versions rather than silently accepting the latest object.
aws --endpoint-url "$endpoint" s3api get-object \
  --bucket "$bucket" --key "$B2_OBJECT_KEY" --version-id "$B2_ARCHIVE_VERSION_ID" "$archive" >/dev/null
aws --endpoint-url "$endpoint" s3api get-object \
  --bucket "$bucket" --key "$B2_OBJECT_KEY.sha256" --version-id "$B2_CHECKSUM_VERSION_ID" "$checksum" >/dev/null
remote_hash="$(tr -d '\r\n ' < "$checksum")"
[[ "$remote_hash" =~ ^[0-9a-fA-F]{64}$ ]] || fail "invalid_encrypted_archive_checksum"
actual_hash="$(sha256sum "$archive" | cut -d' ' -f1)"
[[ "${remote_hash,,}" == "$actual_hash" ]] || fail "encrypted_archive_checksum_mismatch"

# Require 30-day object lock for both versioned objects (Backblaze S3 compatible API).
verify_retention() {
  local key="$1" version="$2" response mode until uploaded until_epoch uploaded_epoch
  response="$(aws --endpoint-url "$endpoint" s3api get-object-retention \
    --bucket "$bucket" --key "$key" --version-id "$version" \
    --query 'Retention.[Mode,RetainUntilDate]' --output text)" || fail "retention_read_unavailable"
  read -r mode until <<< "$response"
  [[ "$mode" == "COMPLIANCE" || "$mode" == "GOVERNANCE" ]] || fail "missing_object_lock"
  until_epoch="$(date -u -d "$until" +%s 2>/dev/null)" || fail "invalid_retention_date"
  uploaded="$(aws --endpoint-url "$endpoint" s3api head-object \
    --bucket "$bucket" --key "$key" --version-id "$version" --query LastModified --output text)" || fail "object_metadata_unavailable"
  uploaded_epoch="$(date -u -d "$uploaded" +%s 2>/dev/null)" || fail "invalid_upload_date"
  (( until_epoch > $(date -u +%s) )) || fail "object_lock_expired"
  (( until_epoch-uploaded_epoch >= 2592000-120 )) || fail "object_lock_less_than_30_days"
  printf '%s' "$until"
}
archive_retain_until="$(verify_retention "$B2_OBJECT_KEY" "$B2_ARCHIVE_VERSION_ID")"
checksum_retain_until="$(verify_retention "$B2_OBJECT_KEY.sha256" "$B2_CHECKSUM_VERSION_ID")"

# The age private key stays on the owner's machine; no hosted workflow gets the identity.
age --decrypt --identity "$AGE_IDENTITY_FILE" --output "$plaintext" "$archive" >/dev/null || fail "decrypt_failed"
pg_restore --list "$plaintext" >/dev/null || fail "archive_toc_invalid"
archive_counts="$(pg_restore --data-only --schema=public --file=- "$plaintext" \
  | node scripts/audit-backup-copy.mjs)" || fail "archive_copy_empty_or_invalid"
if [[ "$archive_counts" =~ players=([0-9]+)[[:space:]]quest_runs=([0-9]+)[[:space:]]virtual_ledger=([0-9]+)[[:space:]]command_receipts=([0-9]+) ]]; then
  expected="${BASH_REMATCH[1]} ${BASH_REMATCH[2]} ${BASH_REMATCH[3]} ${BASH_REMATCH[4]}"
else
  fail "archive_count_parse_failed"
fi

# Refuse any populated or pre-existing public-schema destination before importing.
preflight="$(psql -X -At -F '|' -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" \
  -c "SELECT current_database(),(SELECT count(*) FROM pg_tables WHERE schemaname='public')")" || fail "restore_target_unavailable"
[[ "$preflight" == "gwap_b2_evidence_20261118|0" ]] || fail "restore_target_not_empty"
pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" --schema=public \
  --single-transaction --no-owner --no-acl --exit-on-error "$plaintext" \
  >/dev/null || fail "pg_restore_failed"

psql -X -At -F '|' -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" \
  -f scripts/verify-restored-backup.sql > "$work/verification.txt" || fail "verifier_sql_failed"
grep -qx 't|t|t|t' "$work/verification.txt" || fail "restored_structure_invalid"
grep -qx '0|0|0|0|0' "$work/verification.txt" || fail "ledger_integrity_failed"
restored="$(psql -X -At -F ' ' -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" \
  -c "SELECT (SELECT count(*) FROM public.players), (SELECT count(*) FROM public.quest_runs), (SELECT count(*) FROM public.virtual_ledger), (SELECT count(*) FROM public.command_receipts)")" || fail "restored_counts_unavailable"
[[ "$restored" == "$expected" ]] || fail "restored_rows_do_not_match_archive"

# Save this output in a private operations record; do not paste secrets into GitHub.
printf 'RECOVERY_EVIDENCE=PASS\n'
printf 'Restore branch: br-wispy-queen-bcyqvr1w\nRestore database: gwap_b2_evidence_20261118\n'
printf 'Object key: %s\nEncrypted archive SHA256: %s\n' "$B2_OBJECT_KEY" "$actual_hash"
printf 'Archive version: %s\nChecksum version: %s\n' "$B2_ARCHIVE_VERSION_ID" "$B2_CHECKSUM_VERSION_ID"
printf 'Archive retention until: %s\nChecksum retention until: %s\n' "$archive_retain_until" "$checksum_retain_until"
printf 'Table rows (players quests ledger receipts): %s\n' "$restored"
printf 'Structure: PASS\nLedger/quest invariants: PASS\nPlaintext dump: removed on script exit\n'

#!/usr/bin/env bash
# Exercise recovery only on the disposable PostgreSQL service owned by this CI job.
set -euo pipefail
: "${CI_POSTGRES_CONTAINER:?Expected the PostgreSQL service container ID}"
pg() { docker exec --user postgres -e PGUSER=gwap_ci "$CI_POSTGRES_CONTAINER" "$@"; }
source_db=gwapoholics_ci
restore_db=gwapoholics_restore_ci
archive=/tmp/empire-source.dump
restored=/tmp/empire-restored.dump
local_counts=$(mktemp -d)
trap 'rm -rf "$local_counts"' EXIT

# CREATE DATABASE must succeed. An existing target is never reused.
pg createdb "$restore_db"
pg pg_dump --schema=public --format=custom --no-owner --no-acl -d "$source_db" -f "$archive"
pg pg_restore --data-only --schema=public --file=- "$archive" |
  node scripts/audit-backup-copy.mjs 4 > "$local_counts/source"

# A fresh database already owns the public schema. Keep all its contents.
pg pg_restore --list "$archive" | sed -E '/ SCHEMA - public /d' |
  docker exec -i --user postgres "$CI_POSTGRES_CONTAINER" sh -c 'cat > /tmp/empire-restore.list'
pg pg_restore --use-list=/tmp/empire-restore.list --single-transaction --exit-on-error \
  --no-owner --no-acl -d "$restore_db" "$archive"
for script in verify-restored-backup.sql verify-founder-schema.sql; do
  docker cp "scripts/$script" "$CI_POSTGRES_CONTAINER:/tmp/$script"
done
pg env PGOPTIONS='-c gwap.require_operations_schema=yes' psql -X -qAt -F '|' -v ON_ERROR_STOP=1 \
  -d "$restore_db" -f /tmp/verify-restored-backup.sql | tee "$local_counts/reconciliation"
# The legacy verifier prints its four structural checks and five discrepancy counts.
grep -Fxq 't|t|t|t' "$local_counts/reconciliation"
grep -Fxq '0|0|0|0|0' "$local_counts/reconciliation"
pg pg_dump --schema=public --format=custom --no-owner --no-acl -d "$restore_db" -f "$restored"
pg pg_restore --data-only --schema=public --file=- "$restored" |
  node scripts/audit-backup-copy.mjs 4 > "$local_counts/restored"
diff -u "$local_counts/source" "$local_counts/restored"
cat "$local_counts/restored"

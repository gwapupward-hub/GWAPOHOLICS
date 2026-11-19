# v2.1-A — migration 002: apply, validate, roll back

Files: `server/sql/002_v2_founder_entry.sql` (up), `server/sql/002_v2_founder_entry.down.sql` (guarded down). Requires migration 001.

## Rules (from `AGENTS.md`, restated)

- **Do not apply to any connected Neon branch** (default/main, Preview, recovery) without separately documented founder approval.
- Validate on a disposable, isolated database first. A new Neon branch may copy source data; it is not proof of an empty or safe destination.
- Never print or commit connection URIs. Run the read-only identity check from `AGENTS.md` first and attach redacted output to the approval.

## What the up-migration does

Creates 13 `v2_*` tables, 2 views, 4 trigger functions and the `v2_schema_meta` row. It does not `ALTER`, `UPDATE`, `DELETE` or copy any v1 table. It is idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`) and runs in one transaction. It aborts with a clear error if migration 001 is missing.

## Validation performed (disposable infrastructure only)

Environment: throwaway PostgreSQL **16.15** cluster created for this sprint inside the sandbox (not Neon, not any connected branch), deleted afterwards. CI uses `postgres:17`; Neon runs 18, neither of which was available here.

| Check | Result |
| --- | --- |
| Apply 001 then 002 | pass |
| Re-apply 002 | pass, no change (`v2_schema_meta` stays 1 row) |
| Apply 002 without 001 | refused with `migration 001 (v1 schema) must be applied before 002` |
| Down without confirmation | refused; 15 objects remain |
| Down with `gwap.confirm_v2_rollback=yes` | 0 `v2_*` tables/views/functions remain; the four v1 tables still exist |
| v1 data fingerprint across apply → rollback → re-apply | identical |
| Full Origin flow, replays, concurrency (16 parallel requests across 4 pools), append-only triggers, unique settlement, composite-FK ownership, reserved business insert, reconciliation view, retention view | 27/27 integration tests |
| Scratch-database rollback test | runs in CI-style `CREATE DATABASE` so the shared test DB is never dropped |

Not validated: Neon PG18 specifically, PgBouncer/pooled endpoints, volume/performance, a restore drill containing v2 tables.

## Pre-apply checklist (for the founder-approved run)

1. Founder approval recorded (link it in the PR).
2. Create an isolated Neon branch for the drill; confirm the target by name and ID, then run the `AGENTS.md` aggregate identity query (redacted).
3. Take/verify a backup of the target (issue #30 gate).
4. Apply 002 to the isolated branch; run `node --test tests/integration/postgres-founder.test.mjs` against a disposable database on the same engine version; confirm `SELECT * FROM v2_origin_reconciliation_issues` is empty.
5. Keep `GWAP_V2_FOUNDER_HUB` unset until the migration is verified.

## Rollback

Prefer the flag first: unset `GWAP_V2_FOUNDER_HUB` (API returns 404, UI hides everything). Data stays intact and the schema is harmless.
Destructive schema rollback (deletes **all** v2 founder data) only after a verified backup and explicit approval:

```bash
PGOPTIONS="-c gwap.confirm_v2_rollback=yes" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f server/sql/002_v2_founder_entry.down.sql
```
The script touches only `v2_*` objects. Capital credits cannot be "fixed" by editing: the ledger is append-only by trigger. A correction is a new compensating entry (a later migration will add the entry type), not an UPDATE.

## Extending the schema (rules for 2.1-B and later)

New migration file per build (`003_…`). Add tables/columns/`CHECK` values; never rewrite finalized runs, ledger rows, settlements or evidence. Enabling a reserved telemetry name or a business lifecycle value requires editing the relevant `CHECK` in that migration and the registry in the same PR. Dropping `v2_businesses_insert_disabled` is a deliberate, reviewed act.

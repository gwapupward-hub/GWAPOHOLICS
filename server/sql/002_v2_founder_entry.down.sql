-- ROLLBACK for 002_v2_founder_entry.sql.
--
-- DESTRUCTIVE: permanently deletes ALL v2 founder data (identities, Origin runs,
-- capital ledger, reputation evidence, telemetry). It never touches the v1
-- tables (players, quest_runs, command_receipts, virtual_ledger).
--
-- Only run after a verified backup, on the intended database, with explicit
-- approval. The script refuses to run unless the confirmation setting is passed:
--
--   PGOPTIONS="-c gwap.confirm_v2_rollback=yes" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f server/sql/002_v2_founder_entry.down.sql
BEGIN;

DO $$
BEGIN
  IF coalesce(current_setting('gwap.confirm_v2_rollback', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'v2 rollback refused: set gwap.confirm_v2_rollback=yes to confirm destroying v2 data';
  END IF;
END $$;

DROP VIEW IF EXISTS v2_day2_retention_cohorts;
DROP VIEW IF EXISTS v2_origin_reconciliation_issues;
DROP TABLE IF EXISTS v2_businesses;
DROP TABLE IF EXISTS v2_command_receipts;
DROP TABLE IF EXISTS v2_telemetry_events;
DROP TABLE IF EXISTS v2_reputation_events;
DROP TABLE IF EXISTS v2_origin_settlements;
DROP TABLE IF EXISTS v2_capital_credit_ledger;
DROP TABLE IF EXISTS v2_capital_accounts;
DROP TABLE IF EXISTS v2_origin_qualification;
DROP TABLE IF EXISTS v2_origin_quest_results;
DROP TABLE IF EXISTS v2_origin_runs;
DROP TABLE IF EXISTS v2_founder_telegram_accounts;
DROP TABLE IF EXISTS v2_founders;
DROP TABLE IF EXISTS v2_schema_meta;
DROP FUNCTION IF EXISTS v2_businesses_reserved();
DROP FUNCTION IF EXISTS v2_reject_update();
DROP FUNCTION IF EXISTS v2_reject_finalized_run_mutation();
DROP FUNCTION IF EXISTS v2_reject_mutation();

COMMIT;

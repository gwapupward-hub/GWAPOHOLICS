-- Refuse rollback if it would discard any business or economic evidence.
BEGIN;
LOCK TABLE v2_businesses, v2_capital_debit_ledger, v2_telemetry_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF current_setting('gwap.confirm_v2_rollback', true) IS DISTINCT FROM 'yes'
     OR EXISTS (SELECT FROM v2_businesses) OR EXISTS (SELECT FROM v2_capital_debit_ledger)
     OR EXISTS (SELECT FROM v2_telemetry_events WHERE event_name='first_company_opened') THEN
    RAISE EXCEPTION 'Business rollback refused: confirmation and empty opening history required';
  END IF;
END $$;
DROP VIEW v2_origin_reconciliation_issues;
ALTER VIEW v2_credit_only_reconciliation_issues RENAME TO v2_origin_reconciliation_issues;
ALTER TABLE v2_businesses DROP CONSTRAINT v2_business_requires_opening_debit;
DROP TABLE v2_founder_decisions;
DROP TABLE v2_capital_debit_ledger;
ALTER TABLE v2_businesses DROP CONSTRAINT v2_first_business_per_founder,
  DROP CONSTRAINT v2_businesses_business_id_owner_founder_id_key,
  DROP CONSTRAINT v2_businesses_lifecycle_status_check,
  ADD CHECK (lifecycle_status IN ('reserved'));
CREATE TRIGGER v2_businesses_insert_disabled BEFORE INSERT ON v2_businesses
  FOR EACH ROW EXECUTE FUNCTION v2_businesses_reserved();
ALTER TABLE v2_telemetry_events DROP CONSTRAINT v2_telemetry_events_event_name_check,
  ADD CHECK (event_name IN ('session_started','founder_first_login','origin_quest_completed','origin_run_finalized',
    'origin_capital_credit_committed','founder_entered_v2','founder_goal_viewed'));
DELETE FROM v2_schema_meta WHERE migration='003_v2_first_business';
COMMIT;

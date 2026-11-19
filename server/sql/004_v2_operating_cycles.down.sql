BEGIN;
LOCK TABLE v2_capacity_upgrades,v2_operating_cycles,v2_telemetry_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF current_setting('gwap.confirm_v2_rollback',true) IS DISTINCT FROM 'yes'
    OR EXISTS (SELECT FROM v2_capacity_upgrades) OR EXISTS (SELECT FROM v2_operating_cycles) OR EXISTS (SELECT FROM v2_telemetry_events WHERE event_name='first_operating_loss')
    THEN RAISE EXCEPTION 'Operating rollback refused: confirmation and empty history required'; END IF;
END $$;
DROP VIEW v2_origin_reconciliation_issues;
ALTER VIEW v2_opening_reconciliation_issues RENAME TO v2_origin_reconciliation_issues;
DROP TABLE v2_capacity_upgrades;
DROP TABLE v2_operating_cycles;
ALTER TABLE v2_telemetry_events DROP CONSTRAINT v2_telemetry_events_event_name_check,
  ADD CHECK (event_name IN ('session_started','founder_first_login','origin_quest_completed','origin_run_finalized',
    'origin_capital_credit_committed','founder_entered_v2','founder_goal_viewed','first_company_opened'));
DELETE FROM v2_schema_meta WHERE migration='004_v2_operating_cycles';
COMMIT;

BEGIN;
DO $migration$
BEGIN
  IF EXISTS (SELECT FROM v2_schema_meta WHERE migration='004_v2_operating_cycles') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT FROM v2_schema_meta WHERE migration='003_v2_first_business') THEN RAISE EXCEPTION 'Apply migration 003 first'; END IF;
  CREATE TABLE v2_operating_cycles (
    transaction_id UUID PRIMARY KEY, business_id UUID NOT NULL, founder_id UUID NOT NULL,
    cycle_number INT NOT NULL CHECK (cycle_number > 0), policy_version INT NOT NULL CHECK (policy_version > 0),
    choice_id TEXT NOT NULL, supplier TEXT NOT NULL CHECK (supplier IN ('scheduled','flexible')),
    units_sold BIGINT NOT NULL CHECK (units_sold >= 0), unit_price_g BIGINT NOT NULL CHECK (unit_price_g >= 0),
    cost_g BIGINT NOT NULL CHECK (cost_g >= 0), revenue_g BIGINT NOT NULL CHECK (revenue_g = units_sold * unit_price_g),
    balance_before_g BIGINT NOT NULL CHECK (balance_before_g >= cost_g),
    balance_after_g BIGINT NOT NULL CHECK (balance_after_g = balance_before_g - cost_g + revenue_g),
    xp BIGINT NOT NULL CHECK (xp >= 0 AND (cycle_number=1 OR xp=0)),
    settled_at TIMESTAMPTZ NOT NULL, next_at TIMESTAMPTZ NOT NULL CHECK (next_at > settled_at),
    UNIQUE(business_id,cycle_number),
    FOREIGN KEY (business_id,founder_id) REFERENCES v2_businesses(business_id,owner_founder_id)
  );
  CREATE TABLE v2_capacity_upgrades (
    transaction_id UUID PRIMARY KEY, founder_id UUID NOT NULL, business_id UUID NOT NULL,
    upgrade_id TEXT NOT NULL, policy_version INT NOT NULL CHECK (policy_version > 0),
    cost_g BIGINT NOT NULL CHECK (cost_g > 0), extra_capacity INT NOT NULL CHECK (extra_capacity > 0),
    balance_before_g BIGINT NOT NULL CHECK (balance_before_g >= cost_g),
    balance_after_g BIGINT NOT NULL CHECK (balance_after_g=balance_before_g-cost_g),
    occurred_at TIMESTAMPTZ NOT NULL, UNIQUE(business_id,upgrade_id),
    FOREIGN KEY (business_id,founder_id) REFERENCES v2_businesses(business_id,owner_founder_id)
  );
  CREATE TRIGGER v2_capacity_upgrades_append_only BEFORE UPDATE OR DELETE ON v2_capacity_upgrades
    FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();
  CREATE INDEX v2_cycles_by_founder ON v2_operating_cycles(founder_id,cycle_number DESC);
  CREATE TRIGGER v2_operating_cycles_append_only BEFORE UPDATE OR DELETE ON v2_operating_cycles
    FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();
  ALTER VIEW v2_origin_reconciliation_issues RENAME TO v2_opening_reconciliation_issues;
  CREATE VIEW v2_origin_reconciliation_issues AS
    SELECT founder_id,issue FROM v2_opening_reconciliation_issues WHERE issue <> 'balance_differs_from_net_ledger'
    UNION ALL
    SELECT a.founder_id,'balance_differs_from_net_ledger'::text FROM v2_capital_accounts a
      WHERE a.balance_g <> COALESCE((SELECT SUM(credit_delta_g) FROM v2_capital_credit_ledger WHERE founder_id=a.founder_id),0)
        - COALESCE((SELECT SUM(amount_g) FROM v2_capital_debit_ledger WHERE founder_id=a.founder_id),0)
        + COALESCE((SELECT SUM(revenue_g-cost_g) FROM v2_operating_cycles WHERE founder_id=a.founder_id),0)
        - COALESCE((SELECT SUM(cost_g) FROM v2_capacity_upgrades WHERE founder_id=a.founder_id),0);
  ALTER TABLE v2_telemetry_events DROP CONSTRAINT v2_telemetry_events_event_name_check,
    ADD CHECK (event_name IN ('session_started','founder_first_login','origin_quest_completed','origin_run_finalized',
      'origin_capital_credit_committed','founder_entered_v2','founder_goal_viewed','first_company_opened','first_operating_loss'));
  INSERT INTO v2_schema_meta (migration,contract_versions) VALUES ('004_v2_operating_cycles','{"operatingCycle":1}');
END;
$migration$;
COMMIT;

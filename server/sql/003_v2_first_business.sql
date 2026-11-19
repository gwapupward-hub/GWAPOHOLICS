-- Run after 002, on a disposable database for development. No catalog prices are seeded.
BEGIN;
DO $migration$
BEGIN
  IF EXISTS (SELECT FROM v2_schema_meta WHERE migration = '003_v2_first_business') THEN RETURN; END IF;
  ALTER TABLE v2_businesses DROP CONSTRAINT v2_businesses_lifecycle_status_check,
    ADD CHECK (lifecycle_status IN ('reserved','operating')),
    ADD CONSTRAINT v2_first_business_per_founder UNIQUE (owner_founder_id),
    ADD UNIQUE (business_id, owner_founder_id);
  DROP TRIGGER v2_businesses_insert_disabled ON v2_businesses;

  CREATE TABLE v2_capital_debit_ledger (
    transaction_id UUID PRIMARY KEY,
    business_id UUID NOT NULL UNIQUE,
    founder_id UUID NOT NULL,
    amount_g BIGINT NOT NULL CHECK (amount_g > 0),
    reserve_g BIGINT NOT NULL CHECK (reserve_g >= 0),
    balance_after_g BIGINT NOT NULL CHECK (balance_after_g >= reserve_g),
    idempotency_key TEXT NOT NULL UNIQUE,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (business_id, founder_id) REFERENCES v2_businesses(business_id, owner_founder_id)
  );
  -- Both halves of an opening must exist by commit. An owner cannot substitute another receipt.
  ALTER TABLE v2_businesses ADD CONSTRAINT v2_business_requires_opening_debit
    FOREIGN KEY (business_id) REFERENCES v2_capital_debit_ledger(business_id) DEFERRABLE INITIALLY DEFERRED;
  CREATE TRIGGER v2_capital_debit_append_only BEFORE UPDATE OR DELETE ON v2_capital_debit_ledger
    FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();

  CREATE TABLE v2_founder_decisions (
    business_id UUID PRIMARY KEY,
    founder_id UUID NOT NULL,
    decision_id UUID NOT NULL UNIQUE,
    policy_version INT NOT NULL CHECK (policy_version >= 1),
    choice_id TEXT NOT NULL CHECK (choice_id IN ('scheduled','flexible')),
    occurred_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (business_id, founder_id) REFERENCES v2_businesses(business_id, owner_founder_id)
  );
  CREATE TRIGGER v2_decision_append_only BEFORE UPDATE OR DELETE ON v2_founder_decisions
    FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();

  ALTER VIEW v2_origin_reconciliation_issues RENAME TO v2_credit_only_reconciliation_issues;
  CREATE VIEW v2_origin_reconciliation_issues AS
    SELECT founder_id, issue FROM v2_credit_only_reconciliation_issues WHERE issue <> 'balance_differs_from_credits'
    UNION ALL
    SELECT b.owner_founder_id, 'business_without_supplier_decision' FROM v2_businesses b
      WHERE NOT EXISTS (SELECT FROM v2_founder_decisions d WHERE d.business_id=b.business_id)
    UNION ALL
    SELECT a.founder_id, 'balance_differs_from_net_ledger'::text
      FROM v2_capital_accounts a
      WHERE a.balance_g <>
        COALESCE((SELECT SUM(credit_delta_g) FROM v2_capital_credit_ledger WHERE founder_id=a.founder_id),0)
        - COALESCE((SELECT SUM(amount_g) FROM v2_capital_debit_ledger WHERE founder_id=a.founder_id),0);

  ALTER TABLE v2_telemetry_events DROP CONSTRAINT v2_telemetry_events_event_name_check,
    ADD CHECK (event_name IN ('session_started','founder_first_login','origin_quest_completed','origin_run_finalized',
      'origin_capital_credit_committed','founder_entered_v2','founder_goal_viewed','first_company_opened'));
  INSERT INTO v2_schema_meta (migration,contract_versions)
    VALUES ('003_v2_first_business','{"businessOpening":1,"capitalDebitLedger":1}');
END;
$migration$;
COMMIT;

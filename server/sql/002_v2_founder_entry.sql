-- GWAPOHOLICS v2.1-A "Founder Entry" (Sprint 1) — migration 002.
--
-- ADDITIVE ONLY. Creates new v2_* objects. It does not alter, rewrite, copy or
-- read the contents of the v1 tables (players, quest_runs, command_receipts,
-- virtual_ledger) and never touches any existing player balance.
--
-- Do NOT apply to a connected Neon branch (default/main, Preview, or any
-- recovery branch) without separately documented founder approval. Validate on
-- a disposable, isolated database first (see docs/V2_1A_MIGRATION_AND_ROLLBACK.md).
-- Rollback: server/sql/002_v2_founder_entry.down.sql (guarded; destroys v2 data).
--
-- Requires migration 001 (the v1 schema) so legacy testers can be tagged.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.players') IS NULL THEN
    RAISE EXCEPTION 'migration 001 (v1 schema) must be applied before 002';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS v2_schema_meta (
  migration TEXT PRIMARY KEY,
  contract_versions JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only guard: used by immutable evidence/ledger tables.
CREATE OR REPLACE FUNCTION v2_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- A finalized Origin run is immutable; an in-progress run may be updated once to finalize.
CREATE OR REPLACE FUNCTION v2_reject_finalized_run_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION '% on finalized Origin run is not allowed', TG_OP
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Founder identity (durable, independent of the Telegram identifier).
CREATE TABLE IF NOT EXISTS v2_founders (
  founder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version INT NOT NULL DEFAULT 1 CHECK (contract_version >= 1),
  cohort_kind TEXT NOT NULL CHECK (cohort_kind IN ('new', 'legacy_v1')),
  session_ordinal INT NOT NULL DEFAULT 0 CHECK (session_ordinal >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL,
  entered_v2_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Telegram account association: one Telegram account <-> one founder, both ways.
CREATE TABLE IF NOT EXISTS v2_founder_telegram_accounts (
  telegram_user_id BIGINT PRIMARY KEY CHECK (telegram_user_id > 0),
  founder_id UUID NOT NULL UNIQUE REFERENCES v2_founders (founder_id),
  linked_at TIMESTAMPTZ NOT NULL
);

-- Origin runs (versioned policy, server-issued seed). One open run per founder.
CREATE TABLE IF NOT EXISTS v2_origin_runs (
  origin_run_id UUID PRIMARY KEY,
  founder_id UUID NOT NULL REFERENCES v2_founders (founder_id),
  run_number INT NOT NULL CHECK (run_number >= 1),
  policy_version TEXT NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 64),
  seed BIGINT NOT NULL CHECK (seed BETWEEN 0 AND 4294967295),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'finalized')),
  draft JSONB CHECK (draft IS NULL OR jsonb_typeof(draft) = 'object'),
  verified_score_g INT CHECK (verified_score_g >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  UNIQUE (founder_id, run_number),
  UNIQUE (origin_run_id, founder_id),
  CHECK ((status = 'finalized') = (verified_score_g IS NOT NULL AND finalized_at IS NOT NULL)),
  CHECK (status = 'in_progress' OR draft IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS v2_one_open_origin_run_per_founder
  ON v2_origin_runs (founder_id) WHERE status = 'in_progress';
DROP TRIGGER IF EXISTS v2_origin_runs_finalized_guard ON v2_origin_runs;
CREATE TRIGGER v2_origin_runs_finalized_guard BEFORE UPDATE OR DELETE ON v2_origin_runs
  FOR EACH ROW EXECUTE FUNCTION v2_reject_finalized_run_mutation();

-- Completed quests inside a run (append-only; the founder and run must match).
CREATE TABLE IF NOT EXISTS v2_origin_quest_results (
  origin_run_id UUID NOT NULL,
  founder_id UUID NOT NULL,
  case_id TEXT NOT NULL CHECK (case_id ~ '^[a-z][a-z0-9-]{2,60}$'),
  path JSONB NOT NULL CHECK (jsonb_typeof(path) = 'array' AND jsonb_array_length(path) BETWEEN 1 AND 8),
  raw_delta INT NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('strong', 'steady', 'rough', 'collapse')),
  quest_score_g INT NOT NULL CHECK (quest_score_g >= 0),
  completed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (origin_run_id, case_id),
  FOREIGN KEY (origin_run_id, founder_id) REFERENCES v2_origin_runs (origin_run_id, founder_id)
);
DROP TRIGGER IF EXISTS v2_origin_quest_results_append_only ON v2_origin_quest_results;
CREATE TRIGGER v2_origin_quest_results_append_only BEFORE UPDATE OR DELETE ON v2_origin_quest_results
  FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();

-- Personal best + graduation status (qualification is separate from capital).
CREATE TABLE IF NOT EXISTS v2_origin_qualification (
  founder_id UUID PRIMARY KEY REFERENCES v2_founders (founder_id),
  best_score_g INT NOT NULL DEFAULT 0 CHECK (best_score_g >= 0),
  total_credited_g BIGINT NOT NULL DEFAULT 0 CHECK (total_credited_g >= 0),
  best_run_id UUID,
  finalized_runs INT NOT NULL DEFAULT 0 CHECK (finalized_runs >= 0),
  graduated_at TIMESTAMPTZ,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (best_run_id, founder_id) REFERENCES v2_origin_runs (origin_run_id, founder_id)
);

-- Separate v2 operating-capital account. Never mirrors players.balance (v1).
CREATE TABLE IF NOT EXISTS v2_capital_accounts (
  founder_id UUID PRIMARY KEY REFERENCES v2_founders (founder_id),
  balance_g BIGINT NOT NULL DEFAULT 0 CHECK (balance_g >= 0),
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Immutable capital-credit ledger: positive credits only. A zero-delta outcome
-- is recorded in v2_origin_settlements, never as a zero-value credit.
CREATE TABLE IF NOT EXISTS v2_capital_credit_ledger (
  transaction_id UUID PRIMARY KEY,
  founder_id UUID NOT NULL REFERENCES v2_founders (founder_id),
  origin_run_id UUID NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'origin_capital_credit' CHECK (entry_type = 'origin_capital_credit'),
  verified_score_g INT NOT NULL CHECK (verified_score_g >= 0),
  previous_best_g INT NOT NULL CHECK (previous_best_g >= 0),
  credit_delta_g INT NOT NULL CHECK (credit_delta_g > 0),
  best_after_g INT NOT NULL CHECK (best_after_g >= 0),
  balance_after_g BIGINT NOT NULL CHECK (balance_after_g >= 0),
  policy_version TEXT NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 64),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  occurred_at TIMESTAMPTZ NOT NULL,
  UNIQUE (origin_run_id),
  UNIQUE (founder_id, idempotency_key),
  CHECK (best_after_g = previous_best_g + credit_delta_g),
  CHECK (best_after_g <= verified_score_g),
  FOREIGN KEY (origin_run_id, founder_id) REFERENCES v2_origin_runs (origin_run_id, founder_id)
);
DROP TRIGGER IF EXISTS v2_capital_credit_ledger_append_only ON v2_capital_credit_ledger;
CREATE TRIGGER v2_capital_credit_ledger_append_only BEFORE UPDATE OR DELETE ON v2_capital_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();

-- Settlement receipt for EVERY finalized run (credited or no_improvement).
-- UNIQUE(origin_run_id) is the settlement-level duplicate guard.
CREATE TABLE IF NOT EXISTS v2_origin_settlements (
  origin_run_id UUID PRIMARY KEY,
  founder_id UUID NOT NULL,
  verified_score_g INT NOT NULL CHECK (verified_score_g >= 0),
  previous_best_g INT NOT NULL CHECK (previous_best_g >= 0),
  credit_delta_g INT NOT NULL CHECK (credit_delta_g >= 0),
  best_after_g INT NOT NULL CHECK (best_after_g >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('credited', 'no_improvement')),
  transaction_id UUID UNIQUE REFERENCES v2_capital_credit_ledger (transaction_id),
  policy_version TEXT NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 64),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  settled_at TIMESTAMPTZ NOT NULL,
  UNIQUE (founder_id, idempotency_key),
  CHECK ((outcome = 'credited') = (credit_delta_g > 0)),
  CHECK ((outcome = 'credited') = (transaction_id IS NOT NULL)),
  CHECK (best_after_g = previous_best_g + credit_delta_g),
  FOREIGN KEY (origin_run_id, founder_id) REFERENCES v2_origin_runs (origin_run_id, founder_id)
);
DROP TRIGGER IF EXISTS v2_origin_settlements_append_only ON v2_origin_settlements;
CREATE TRIGGER v2_origin_settlements_append_only BEFORE UPDATE OR DELETE ON v2_origin_settlements
  FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();

-- Founder reputation / evidence stream (append-only; corrections are new rows).
CREATE TABLE IF NOT EXISTS v2_reputation_events (
  event_id UUID PRIMARY KEY,
  founder_id UUID NOT NULL REFERENCES v2_founders (founder_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('origin_run_finalized', 'origin_graduated', 'correction', 'revocation')),
  dimension TEXT NOT NULL CHECK (dimension IN ('qualification_performance', 'reliability')),
  schema_version INT NOT NULL CHECK (schema_version >= 1),
  policy_version TEXT CHECK (policy_version IS NULL OR length(policy_version) BETWEEN 1 AND 64),
  subject_ref TEXT NOT NULL CHECK (length(subject_ref) BETWEEN 1 AND 128),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  evidence_digest CHAR(64) NOT NULL CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
  dedupe_key TEXT NOT NULL CHECK (length(dedupe_key) BETWEEN 1 AND 160),
  corrects_event_id UUID REFERENCES v2_reputation_events (event_id),
  occurred_at TIMESTAMPTZ NOT NULL,
  UNIQUE (founder_id, dedupe_key),
  CHECK ((event_type IN ('correction', 'revocation')) = (corrects_event_id IS NOT NULL))
);
DROP TRIGGER IF EXISTS v2_reputation_events_append_only ON v2_reputation_events;
CREATE TRIGGER v2_reputation_events_append_only BEFORE UPDATE OR DELETE ON v2_reputation_events
  FOR EACH ROW EXECUTE FUNCTION v2_reject_mutation();

-- Telemetry (schema v1). Pseudonymous key only; no FK to founders on purpose, so
-- account deletion/unlinking never needs to rewrite analytics. analytics_key,
-- source_ref and dedupe_key are all HMAC-derived: this table alone cannot be
-- joined to founders, runs or Telegram accounts. UPDATE is
-- forbidden; DELETE is allowed for retention purges.
-- first_company_opened / first_operating_loss are intentionally NOT permitted
-- yet: a later migration adds them when the matching gameplay exists.
CREATE TABLE IF NOT EXISTS v2_telemetry_events (
  event_id UUID PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'session_started', 'founder_first_login', 'origin_quest_completed', 'origin_run_finalized',
    'origin_capital_credit_committed', 'founder_entered_v2', 'founder_goal_viewed')),
  schema_version INT NOT NULL CHECK (schema_version >= 1),
  analytics_key CHAR(32) NOT NULL CHECK (analytics_key ~ '^[0-9a-f]{32}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_on DATE NOT NULL,
  cohort_day DATE NOT NULL,
  cohort_kind TEXT NOT NULL CHECK (cohort_kind IN ('new', 'legacy_v1')),
  source_ref CHAR(32) CHECK (source_ref IS NULL OR source_ref ~ '^[0-9a-f]{32}$'),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(properties) = 'object' AND length(properties::text) <= 1024),
  dedupe_key TEXT NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 160)
);
CREATE INDEX IF NOT EXISTS v2_telemetry_by_key ON v2_telemetry_events (analytics_key, event_name, occurred_at);
CREATE OR REPLACE FUNCTION v2_reject_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE on % is not allowed: events are immutable', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS v2_telemetry_no_update ON v2_telemetry_events;
CREATE TRIGGER v2_telemetry_no_update BEFORE UPDATE ON v2_telemetry_events
  FOR EACH ROW EXECUTE FUNCTION v2_reject_update();

-- Idempotency receipts for v2 commands, namespaced by authenticated Telegram identity.
CREATE TABLE IF NOT EXISTS v2_command_receipts (
  telegram_user_id BIGINT NOT NULL CHECK (telegram_user_id > 0),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 96),
  command_hash CHAR(64) NOT NULL CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  response JSONB NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_user_id, idempotency_key)
);

-- Business ownership / category references for later builds. RESERVED: the
-- trigger rejects every insert until build 2.1-B ships its own migration.
CREATE TABLE IF NOT EXISTS v2_businesses (
  business_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_founder_id UUID NOT NULL REFERENCES v2_founders (founder_id),
  business_type_id TEXT NOT NULL CHECK (business_type_id ~ '^[a-z][a-z0-9-]{2,40}$'),
  template_version INT NOT NULL CHECK (template_version >= 1),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('reserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION v2_businesses_reserved() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'v2_businesses is reserved for build 2.1-B; inserts are disabled'
    USING ERRCODE = 'feature_not_supported';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS v2_businesses_insert_disabled ON v2_businesses;
CREATE TRIGGER v2_businesses_insert_disabled BEFORE INSERT ON v2_businesses
  FOR EACH ROW EXECUTE FUNCTION v2_businesses_reserved();

-- Reconciliation: every row returned is a defect. Expected result: zero rows.
CREATE OR REPLACE VIEW v2_origin_reconciliation_issues AS
  SELECT a.founder_id, 'balance_differs_from_credits'::text AS issue
    FROM v2_capital_accounts a
    WHERE a.balance_g <> COALESCE((SELECT sum(l.credit_delta_g) FROM v2_capital_credit_ledger l WHERE l.founder_id = a.founder_id), 0)
  UNION ALL
  SELECT q.founder_id, 'total_credited_differs_from_credits'
    FROM v2_origin_qualification q
    WHERE q.total_credited_g <> COALESCE((SELECT sum(l.credit_delta_g) FROM v2_capital_credit_ledger l WHERE l.founder_id = q.founder_id), 0)
  UNION ALL
  SELECT q.founder_id, 'best_score_differs_from_best_credit_chain'
    FROM v2_origin_qualification q
    WHERE q.best_score_g <> COALESCE((SELECT max(l.best_after_g) FROM v2_capital_credit_ledger l WHERE l.founder_id = q.founder_id), 0)
  UNION ALL
  SELECT r.founder_id, 'finalized_run_without_settlement'
    FROM v2_origin_runs r
    WHERE r.status = 'finalized' AND NOT EXISTS (SELECT 1 FROM v2_origin_settlements s WHERE s.origin_run_id = r.origin_run_id)
  UNION ALL
  SELECT s.founder_id, 'settlement_score_differs_from_run'
    FROM v2_origin_settlements s JOIN v2_origin_runs r USING (origin_run_id)
    WHERE r.verified_score_g IS DISTINCT FROM s.verified_score_g
  UNION ALL
  SELECT l.founder_id, 'credit_without_credited_settlement'
    FROM v2_capital_credit_ledger l
    WHERE NOT EXISTS (SELECT 1 FROM v2_origin_settlements s WHERE s.transaction_id = l.transaction_id AND s.outcome = 'credited')
  UNION ALL
  SELECT q.founder_id, 'finalized_run_count_differs'
    FROM v2_origin_qualification q
    WHERE q.finalized_runs <> (SELECT count(*) FROM v2_origin_runs r WHERE r.founder_id = q.founder_id AND r.status = 'finalized');

-- Day-2 retention cohorts from pseudonymous telemetry only (no founder join).
-- Cohort = founder_first_login UTC day. next_utc_day = a session_started on
-- cohort_day + 1; rolling_24_48h = a session in [first_login+24h, +48h).
-- reportable = cohort_size >= 5 (k-anonymity floor for any shared report).
CREATE OR REPLACE VIEW v2_day2_retention_cohorts AS
  SELECT f.cohort_day, f.cohort_kind,
         count(*)::int AS cohort_size,
         (count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM v2_telemetry_events s
            WHERE s.analytics_key = f.analytics_key AND s.event_name = 'session_started'
              AND s.occurred_on = f.cohort_day + 1)))::int AS returned_next_utc_day,
         (count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM v2_telemetry_events s
            WHERE s.analytics_key = f.analytics_key AND s.event_name = 'session_started'
              AND s.occurred_at >= f.occurred_at + interval '24 hours'
              AND s.occurred_at <  f.occurred_at + interval '48 hours')))::int AS returned_rolling_24_48h,
         (count(*) >= 5) AS reportable
  FROM v2_telemetry_events f
  WHERE f.event_name = 'founder_first_login'
  GROUP BY f.cohort_day, f.cohort_kind;

INSERT INTO v2_schema_meta (migration, contract_versions)
VALUES ('002_v2_founder_entry',
  '{"founderIdentity":1,"originRun":1,"originSettlement":1,"capitalCreditLedger":1,"reputationEvidence":1,"telemetry":1,"goalLadder":1,"businessTemplate":1,"hubSnapshot":1}'::jsonb)
ON CONFLICT (migration) DO NOTHING;

COMMIT;

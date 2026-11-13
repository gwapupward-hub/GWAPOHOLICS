-- REVIEW REQUIRED: PostgreSQL migration draft, NOT applied.
-- This is only a virtual educational coin ledger.
BEGIN;
CREATE TABLE IF NOT EXISTS players (
 telegram_user_id BIGINT PRIMARY KEY,
 balance BIGINT NOT NULL DEFAULT 1000 CHECK (balance>=0),
 seed BIGINT NOT NULL,
 last_recovery_at TIMESTAMPTZ,
 version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quest_runs (
 telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
 case_id TEXT NOT NULL,
 completed_at TIMESTAMPTZ,
 choices JSONB NOT NULL DEFAULT '[]'::jsonb
   CHECK (jsonb_typeof(choices)='array' AND jsonb_array_length(choices)<=4),
 PRIMARY KEY (telegram_user_id,case_id)
);
CREATE TABLE IF NOT EXISTS virtual_ledger (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
 case_id TEXT,
 event_type TEXT NOT NULL CHECK (event_type IN ('welcome','quest_settlement','recovery')),
 amount BIGINT NOT NULL,
 balance_after BIGINT NOT NULL CHECK (balance_after>=0),
 idempotency_key TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(telegram_user_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_settlement_per_player_case
 ON virtual_ledger(telegram_user_id,case_id) WHERE event_type='quest_settlement';
COMMIT;

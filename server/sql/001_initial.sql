-- Run only on a dedicated, empty GWAPOHOLICS development database.
-- Nontransferable educational coins; no token or money custody.
BEGIN;
CREATE TABLE IF NOT EXISTS players (
  telegram_user_id BIGINT PRIMARY KEY CHECK(telegram_user_id>0),
  game_state JSONB NOT NULL CHECK(jsonb_typeof(game_state)='object'),
  balance BIGINT NOT NULL CHECK(balance>=0),
  seed BIGINT NOT NULL CHECK(seed BETWEEN 0 AND 4294967295),
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((game_state->>'balance')::bigint=balance),
  CHECK ((game_state->>'seed')::bigint=seed)
);
CREATE TABLE IF NOT EXISTS quest_runs(
  telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
  case_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  choices JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK(jsonb_typeof(choices)='array' AND jsonb_array_length(choices)<=4),
  PRIMARY KEY(telegram_user_id,case_id)
);
CREATE TABLE IF NOT EXISTS command_receipts(
  telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 96),
  command_hash CHAR(64) NOT NULL CHECK(command_hash ~ '^[0-9a-f]{64}$'),
  response JSONB NOT NULL CHECK(jsonb_typeof(response)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(telegram_user_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS virtual_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL REFERENCES players(telegram_user_id),
  case_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('welcome','quest_settlement','recovery')),
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK(balance_after>=0),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(telegram_user_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_settlement_per_player_case
  ON virtual_ledger(telegram_user_id,case_id) WHERE event_type='quest_settlement';
COMMIT;

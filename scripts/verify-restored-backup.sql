-- GWAPOHOLICS: read-only verification of an actual restored B2 PostgreSQL dump.
-- Use ONLY after pg_restore into a NEW, EMPTY, ISOLATED Neon database.
-- This script intentionally returns only aggregate counts and booleans, never player IDs.
-- Run with: psql -X -v ON_ERROR_STOP=1 "$RESTORE_TEST_DATABASE_URL" -f scripts/verify-restored-backup.sql
BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS restore_db_name,
  current_setting('server_version') AS postgres_version,
  now() AS verified_at_utc;

-- Compare these four counts against the exact source snapshot (NOT current live Preview).
SELECT 'command_receipts' AS table_name, count(*)::bigint AS rows FROM public.command_receipts
UNION ALL SELECT 'players', count(*)::bigint FROM public.players
UNION ALL SELECT 'quest_runs', count(*)::bigint FROM public.quest_runs
UNION ALL SELECT 'virtual_ledger', count(*)::bigint FROM public.virtual_ledger
ORDER BY table_name;

-- These structural checks must all return TRUE.
SELECT
  (SELECT count(*) = 4
     FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('players','quest_runs','virtual_ledger','command_receipts')
      AND table_type = 'BASE TABLE') AS four_expected_tables,
  (SELECT count(*) = 4
     FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'p'
      AND conname IN ('players_pkey','quest_runs_pkey','virtual_ledger_pkey','command_receipts_pkey')
  ) AS four_primary_keys,
  (SELECT count(*) = 1
     FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'virtual_ledger'
      AND indexname = 'one_settlement_per_player_case'
      AND indexdef ILIKE '%UNIQUE%') AS unique_quest_settlement_index_present,
  (pg_get_serial_sequence('public.virtual_ledger','id') IS NOT NULL) AS ledger_identity_sequence_present;

-- Every count below must be ZERO. Exceptions indicate damaged or inconsistent restored state.
WITH ordered_ledger AS (
  SELECT telegram_user_id, id, amount, balance_after,
         lag(balance_after) OVER (PARTITION BY telegram_user_id ORDER BY id) AS previous_balance
    FROM public.virtual_ledger
),
latest_ledger AS (
  SELECT DISTINCT ON (telegram_user_id) telegram_user_id, balance_after
    FROM public.virtual_ledger
   ORDER BY telegram_user_id, id DESC
),
completed_cases AS (
  SELECT telegram_user_id, case_id
    FROM public.quest_runs
   WHERE completed_at IS NOT NULL
)
SELECT
  (SELECT count(*) FROM ordered_ledger
    WHERE balance_after <> coalesce(previous_balance, 0) + amount) AS ledger_chain_mismatches,
  (SELECT count(*)
     FROM public.players p
     LEFT JOIN latest_ledger l USING (telegram_user_id)
    WHERE l.balance_after IS DISTINCT FROM p.balance) AS persisted_balance_mismatches,
  (SELECT count(*)
     FROM public.quest_runs
    WHERE completed_at IS NOT NULL
      AND (jsonb_typeof(choices) <> 'array' OR jsonb_array_length(choices) <> 4)
  ) AS invalid_completed_quests,
  (SELECT count(*)
     FROM public.virtual_ledger
    WHERE event_type = 'quest_settlement'
    GROUP BY telegram_user_id, case_id
   HAVING count(*) > 1
   LIMIT 1) AS duplicate_settlement_group_example,
  (SELECT count(*)
     FROM completed_cases c
    WHERE NOT EXISTS (SELECT 1 FROM public.virtual_ledger l
                       WHERE l.telegram_user_id = c.telegram_user_id
                         AND l.case_id = c.case_id
                         AND l.event_type = 'quest_settlement')
  ) AS completed_quests_missing_settlement;

COMMIT;

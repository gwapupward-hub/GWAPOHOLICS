-- Read-only structural and accounting verification for 002 and 003.
-- Works on a v1-only archive. Pass gwap.require_founder_schema / gwap.require_business_schema
-- as session settings to require a particular version even if every v2 object is missing.
DO $verify$
DECLARE
  required_tables text[] := ARRAY['v2_schema_meta','v2_founders','v2_founder_telegram_accounts','v2_origin_runs',
    'v2_origin_quest_results','v2_origin_qualification','v2_capital_accounts','v2_capital_credit_ledger',
    'v2_origin_settlements','v2_reputation_events','v2_telemetry_events','v2_command_receipts','v2_businesses'];
  guards text[] := ARRAY['v2_origin_runs_finalized_guard','v2_origin_quest_results_append_only',
    'v2_capital_credit_ledger_append_only','v2_origin_settlements_append_only','v2_reputation_events_append_only','v2_telemetry_no_update'];
  item text;
  n bigint;
  has_business boolean;
BEGIN
  IF to_regclass('public.v2_schema_meta') IS NULL THEN
    IF current_setting('gwap.require_operations_schema', true) = 'yes' OR current_setting('gwap.require_founder_schema', true) = 'yes' OR current_setting('gwap.require_business_schema', true) = 'yes'
      OR EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND left(tablename,3)='v2_') THEN
      RAISE EXCEPTION 'Missing founder schema marker';
    END IF;
    RAISE NOTICE 'v1-only schema';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM public.v2_schema_meta WHERE migration='002_v2_founder_entry') THEN
    RAISE EXCEPTION 'Missing founder migration record';
  END IF;
  SELECT EXISTS (SELECT FROM public.v2_schema_meta WHERE migration='003_v2_first_business') INTO has_business;
  IF has_business THEN
    required_tables := required_tables || ARRAY['v2_capital_debit_ledger','v2_founder_decisions'];
    guards := guards || ARRAY['v2_capital_debit_append_only','v2_decision_append_only'];
  ELSIF current_setting('gwap.require_business_schema', true) = 'yes'
      OR to_regclass('public.v2_capital_debit_ledger') IS NOT NULL OR to_regclass('public.v2_founder_decisions') IS NOT NULL THEN
    RAISE EXCEPTION 'Missing business migration record';
  ELSE
    guards := array_append(guards,'v2_businesses_insert_disabled');
  END IF;
  IF EXISTS (SELECT FROM public.v2_schema_meta WHERE migration='004_v2_operating_cycles') THEN
    required_tables := required_tables || ARRAY['v2_operating_cycles','v2_capacity_upgrades'];
    guards := guards || ARRAY['v2_operating_cycles_append_only','v2_capacity_upgrades_append_only'];
  ELSIF current_setting('gwap.require_operations_schema',true)='yes' OR to_regclass('public.v2_operating_cycles') IS NOT NULL OR to_regclass('public.v2_capacity_upgrades') IS NOT NULL THEN
    RAISE EXCEPTION 'Missing operating migration record';
  END IF;
  FOREACH item IN ARRAY required_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',item) INTO n;
    RAISE NOTICE '% rows=%',item,n;
  END LOOP;
  FOREACH item IN ARRAY guards LOOP
    IF NOT EXISTS (SELECT FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace='public'::regnamespace AND tgname=item AND tgenabled IN ('O','A')) THEN
      RAISE EXCEPTION 'Missing enabled guard %',item;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_index WHERE indexrelid=to_regclass('public.v2_one_open_origin_run_per_founder')
      AND indisunique AND indisvalid)
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.v2_capital_credit_ledger'::regclass
      AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (origin_run_id)')
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.v2_origin_settlements'::regclass
      AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (origin_run_id)')
    OR (SELECT count(*) FROM pg_constraint WHERE confrelid='public.v2_origin_runs'::regclass
      AND contype='f' AND cardinality(conkey)=2 AND convalidated) < 4 THEN
    RAISE EXCEPTION 'Missing Origin uniqueness or ownership constraint';
  END IF;
  IF EXISTS (SELECT FROM public.v2_origin_reconciliation_issues) THEN
    RAISE EXCEPTION 'Founder ledger reconciliation failed';
  END IF;
END;
$verify$;

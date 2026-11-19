// Real PostgreSQL integration for v2.1-A Founder Entry. Runs ONLY against a dedicated, disposable
// database named `gwapoholics_ci`; skipped when GWAPOHOLICS_TEST_DATABASE_URL is unset.
// Run it as its own process (it shares the database with postgres-ledger.test.mjs):
//   node --test tests/integration/postgres-founder.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createPostgresFounderStore } from "../../server/v2/postgres-founder-store.mjs";
import { executeFounderCommand } from "../../server/v2/founder-service.mjs";
import { config, defineFounderSuite, operationsFixture } from "../support/founder-suite.mjs";
import { QUEST_IDS, bestPath, harness, worstPath } from "../support/origin-play.mjs";

const database = process.env.GWAPOHOLICS_TEST_DATABASE_URL;
const read = (name) => readFile(new URL(`../../server/sql/${name}`, import.meta.url), "utf8");
const V2_TABLES = "v2_businesses, v2_command_receipts, v2_telemetry_events, v2_reputation_events, v2_origin_settlements, v2_capital_credit_ledger, v2_capital_accounts, v2_origin_qualification, v2_origin_quest_results, v2_origin_runs, v2_founder_telegram_accounts, v2_founders";

let migrated;
async function ensureMigrated() {
  migrated ??= (async () => {
    const pool = new Pool({ connectionString: database, max: 2 });
    try {
      const name = (await pool.query("SELECT current_database() AS name")).rows[0].name;
      assert.equal(name, "gwapoholics_ci", "refusing to run outside the dedicated disposable CI database");
      await pool.query(await read("001_initial.sql"));
      await pool.query(await read("002_v2_founder_entry.sql"));
    } finally { await pool.end(); }
  })();
  return migrated;
}

const ms = (col) => `(floor(extract(epoch from ${col}) * 1000))::bigint`;

async function create({ commandBudget = { limit: 100000, windowSeconds: 60 } } = {}) {
  await ensureMigrated();
  const pools = [];
  const open = (max = 12) => { const p = new Pool({ connectionString: database, max, connectionTimeoutMillis: 5000 }); pools.push(p); return p; };
  const pool = open();
  await pool.query(`TRUNCATE ${V2_TABLES} RESTART IDENTITY CASCADE`);
  const legacyIds = [];
  const q = (text, params) => pool.query(text, params);
  return {
    store: createPostgresFounderStore(pool, { commandBudget }),
    async reconnect() { return createPostgresFounderStore(open(2), { commandBudget }); },
    async close() {
      for (const id of legacyIds) {
        await q("DELETE FROM command_receipts WHERE telegram_user_id=$1", [id]);
        await q("DELETE FROM virtual_ledger WHERE telegram_user_id=$1", [id]);
        await q("DELETE FROM quest_runs WHERE telegram_user_id=$1", [id]);
        await q("DELETE FROM players WHERE telegram_user_id=$1", [id]);
      }
      await Promise.all(pools.map((p) => p.end()));
    },
    async counts() {
      const r = await q(`SELECT (SELECT count(*)::int FROM v2_founders) AS founders, (SELECT count(*)::int FROM v2_origin_runs) AS runs,
        (SELECT count(*)::int FROM v2_origin_quest_results) AS "questResults", (SELECT count(*)::int FROM v2_capital_credit_ledger) AS ledger,
        (SELECT count(*)::int FROM v2_origin_settlements) AS settlements, (SELECT count(*)::int FROM v2_reputation_events) AS reputation,
        (SELECT count(*)::int FROM v2_telemetry_events) AS telemetry`);
      return r.rows[0];
    },
    async ledgerRows() {
      const r = await q(`SELECT transaction_id, origin_run_id, verified_score_g, previous_best_g, credit_delta_g, best_after_g, balance_after_g,
        policy_version, idempotency_key, ${ms("occurred_at")} AS occurred FROM v2_capital_credit_ledger ORDER BY occurred_at, transaction_id`);
      return r.rows.map((x) => ({
        transactionId: x.transaction_id, originRunId: x.origin_run_id, verifiedScoreG: x.verified_score_g, previousBestG: x.previous_best_g,
        creditDeltaG: x.credit_delta_g, bestAfterG: x.best_after_g, balanceAfterG: Number(x.balance_after_g), policyVersion: x.policy_version,
        idempotencyKey: x.idempotency_key, occurredAt: Number(x.occurred)
      }));
    },
    async telemetry() {
      const r = await q(`SELECT event_name, analytics_key, source_ref, properties, dedupe_key, ${ms("occurred_at")} AS occurred,
        to_char(occurred_on, 'YYYY-MM-DD') AS on_day, to_char(cohort_day, 'YYYY-MM-DD') AS cohort_day, cohort_kind
        FROM v2_telemetry_events ORDER BY occurred_at, event_id`);
      return r.rows.map((x) => ({
        eventName: x.event_name, analyticsKey: x.analytics_key, sourceRef: x.source_ref, properties: x.properties, dedupeKey: x.dedupe_key,
        occurredAt: Number(x.occurred), occurredOn: x.on_day, cohortDay: x.cohort_day, cohortKind: x.cohort_kind
      }));
    },
    async founderIdFor(uid) {
      return (await q("SELECT founder_id FROM v2_founder_telegram_accounts WHERE telegram_user_id=$1", [uid])).rows[0]?.founder_id;
    },
    async retentionView() {
      const r = await q(`SELECT to_char(cohort_day, 'YYYY-MM-DD') AS d, cohort_kind, cohort_size, returned_next_utc_day, returned_rolling_24_48h
        FROM v2_day2_retention_cohorts ORDER BY cohort_day, cohort_kind`);
      return r.rows.map((x) => ({ cohortDay: x.d, cohortKind: x.cohort_kind, cohortSize: x.cohort_size, returnedNextUtcDay: x.returned_next_utc_day, returned24To48h: x.returned_rolling_24_48h }));
    },
    async assertReconciled() {
      const r = await q("SELECT * FROM v2_origin_reconciliation_issues");
      assert.deepEqual(r.rows, [], "reconciliation view must report no defects");
    },
    legacy: {
      async seed(uid) {
        legacyIds.push(uid);
        await q(`INSERT INTO players (telegram_user_id, game_state, balance, seed) VALUES ($1, '{"schema":2,"balance":1000,"seed":5,"played":[],"ledger":[]}', 1000, 5)`, [uid]);
        await q(`INSERT INTO virtual_ledger (telegram_user_id, event_type, amount, balance_after, idempotency_key) VALUES ($1, 'welcome', 1000, 1000, 'welcome-fixture')`, [uid]);
      },
      async fingerprint() {
        const r = await q(`SELECT md5(concat_ws('|',
          (SELECT coalesce(string_agg(p::text, ','), '') FROM players p WHERE telegram_user_id IN (SELECT unnest($1::bigint[]))),
          (SELECT coalesce(string_agg(l::text, ','), '') FROM virtual_ledger l WHERE telegram_user_id IN (SELECT unnest($1::bigint[]))),
          (SELECT coalesce(string_agg(c::text, ','), '') FROM quest_runs c WHERE telegram_user_id IN (SELECT unnest($1::bigint[]))),
          (SELECT coalesce(string_agg(c::text, ','), '') FROM command_receipts c WHERE telegram_user_id IN (SELECT unnest($1::bigint[]))))) AS fp`, [legacyIds]);
        return r.rows[0].fp;
      }
    },
    pool, open
  };
}

defineFounderSuite("postgres", { create, skip: !database });

const t = (name, fn) => test(`[postgres] ${name}`, { skip: !database }, async () => {
  const env = await create();
  try { await fn(env); } finally { await env.close(); }
});
const expectDbError = (promise, pattern) => assert.rejects(promise, (e) => pattern.test(`${e.code} ${e.message}`), String(pattern));

async function finishedRun(env, uid = "4200000001", pick = bestPath) {
  const h = harness({ store: env.store, config, telegramUserId: uid });
  const snap = await h.playRun(pick);
  return { h, snap, founderId: await env.founderIdFor(uid), runId: (await env.pool.query("SELECT origin_run_id FROM v2_origin_runs WHERE founder_id=$1 ORDER BY run_number DESC LIMIT 1", [await env.founderIdFor(uid)])).rows[0].origin_run_id };
}

t("settlement, ledger, quest results, reputation and finalized runs are append-only in the database itself", async (env) => {
  const { founderId, runId } = await finishedRun(env);
  const q = (sql, params) => env.pool.query(sql, params);
  await expectDbError(q("UPDATE v2_capital_credit_ledger SET credit_delta_g = credit_delta_g + 1"), /append-only/);
  await expectDbError(q("DELETE FROM v2_capital_credit_ledger"), /append-only/);
  await expectDbError(q("UPDATE v2_origin_settlements SET credit_delta_g = 0"), /append-only/);
  await expectDbError(q("DELETE FROM v2_origin_settlements"), /append-only/);
  await expectDbError(q("UPDATE v2_origin_quest_results SET quest_score_g = 500"), /append-only/);
  await expectDbError(q("DELETE FROM v2_origin_quest_results"), /append-only/);
  await expectDbError(q("UPDATE v2_reputation_events SET payload = '{}'::jsonb"), /append-only/);
  await expectDbError(q("DELETE FROM v2_reputation_events"), /append-only/);
  await expectDbError(q("UPDATE v2_origin_runs SET verified_score_g = 1 WHERE origin_run_id = $1", [runId]), /finalized Origin run/);
  await expectDbError(q("DELETE FROM v2_origin_runs WHERE origin_run_id = $1", [runId]), /finalized Origin run/);
  await expectDbError(q("UPDATE v2_telemetry_events SET properties = '{}'::jsonb"), /immutable/);
  assert.equal((await q("DELETE FROM v2_telemetry_events")).rowCount > 0, true, "telemetry retention purges (DELETE) remain possible");
  await env.assertReconciled();
  assert.ok(founderId);
});

t("unique settlement constraints stop a second credit or settlement for the same run, whatever the application does", async (env) => {
  const { founderId, runId } = await finishedRun(env);
  const q = (sql, params) => env.pool.query(sql, params);
  const ledger = (await q("SELECT * FROM v2_capital_credit_ledger")).rows[0];
  const insertCredit = (key, tx = randomUUID(), delta = ledger.credit_delta_g, best = ledger.best_after_g, prev = ledger.previous_best_g) => q(
    `INSERT INTO v2_capital_credit_ledger (transaction_id, founder_id, origin_run_id, verified_score_g, previous_best_g, credit_delta_g, best_after_g, balance_after_g, policy_version, idempotency_key, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'origin-v1-draft', $8, now())`,
    [tx, founderId, runId, ledger.verified_score_g, prev, delta, best, key]);
  await expectDbError(insertCredit("origin-settle:" + runId), /unique|23505/);   // same idempotency key
  await expectDbError(insertCredit("another-key"), /unique|23505/);               // same run, different key
  await expectDbError(q(
    `INSERT INTO v2_origin_settlements (origin_run_id, founder_id, verified_score_g, previous_best_g, credit_delta_g, best_after_g, outcome, policy_version, idempotency_key, settled_at)
     VALUES ($1, $2, 0, 0, 0, 0, 'no_improvement', 'origin-v1-draft', 'other', now())`, [runId, founderId]), /unique|23505/);
  await expectDbError(insertCredit("zero", randomUUID(), 0, ledger.previous_best_g), /check|23514/); // a zero-value credit can never exist
  await expectDbError(insertCredit("inflated", randomUUID(), ledger.credit_delta_g + 1, ledger.best_after_g + 1), /check|23514/); // best can never exceed the verified score
  await expectDbError(q("UPDATE v2_capital_accounts SET balance_g = -1"), /check|23514/);
  assert.equal((await q("SELECT count(*)::int AS n FROM v2_capital_credit_ledger")).rows[0].n, 1);
});

t("ownership is enforced by composite foreign keys and a single open run per founder", async (env) => {
  const a = await finishedRun(env, "4200000011");
  // A's equal-score replay settles as no_improvement, so that run has NO credit row: only the FK can reject B.
  const replay = await a.h.playRun(bestPath);
  assert.equal(replay.receipts[0].outcome, "no_improvement");
  const creditless = (await env.pool.query("SELECT origin_run_id FROM v2_origin_runs WHERE founder_id=$1 AND run_number=2", [a.founderId])).rows[0].origin_run_id;
  const bH = harness({ store: env.store, config, telegramUserId: "4200000012" });
  await bH.startRun();
  const bId = await env.founderIdFor("4200000012");
  const q = (sql, params) => env.pool.query(sql, params);
  await expectDbError(q(
    `INSERT INTO v2_capital_credit_ledger (transaction_id, founder_id, origin_run_id, verified_score_g, previous_best_g, credit_delta_g, best_after_g, balance_after_g, policy_version, idempotency_key, occurred_at)
     VALUES ($1, $2, $3, 10, 0, 10, 10, 10, 'p', 'k', now())`, [randomUUID(), bId, creditless]), /foreign key|23503/);
  await expectDbError(q(
    `INSERT INTO v2_origin_settlements (origin_run_id, founder_id, verified_score_g, previous_best_g, credit_delta_g, best_after_g, outcome, policy_version, idempotency_key, settled_at)
     VALUES ($1, $2, 0, 0, 0, 0, 'no_improvement', 'p', 'k', now())`, [a.runId, bId]), /unique|foreign key|23505|23503/);
  await expectDbError(q(
    `INSERT INTO v2_origin_quest_results (origin_run_id, founder_id, case_id, path, raw_delta, band, quest_score_g, completed_at)
     VALUES ($1, $2, 'extra-quest', '["a"]', 0, 'rough', 0, now())`, [a.runId, bId]), /foreign key|23503/);
  await expectDbError(q(
    `INSERT INTO v2_origin_runs (origin_run_id, founder_id, run_number, policy_version, seed, status, started_at)
     VALUES ($1, $2, 99, 'p', 1, 'in_progress', now())`, [randomUUID(), bId]), /unique|23505/); // B already has an open run
  // the service never lets one account reach another's run: a store call scoped to B returns nothing of A's
  const stolen = await env.store.transaction("4200000012", (tx) => tx.getRunResults({ founderId: bId, originRunId: a.runId }));
  assert.deepEqual(stolen, []);
  await env.assertReconciled();
});

t("the reserved business table rejects every insert, and future telemetry names are not yet permitted", async (env) => {
  const { founderId } = await finishedRun(env);
  const q = (sql, params) => env.pool.query(sql, params);
  await expectDbError(q("INSERT INTO v2_businesses (owner_founder_id, business_type_id, template_version, lifecycle_status) VALUES ($1, 'barbershop', 1, 'reserved')", [founderId]), /reserved for build 2.1-B/);
  assert.equal((await q("SELECT count(*)::int AS n FROM v2_businesses")).rows[0].n, 0);
  for (const name of ["first_company_opened", "first_operating_loss", "made_up"]) {
    await expectDbError(q(
      `INSERT INTO v2_telemetry_events (event_id, event_name, schema_version, analytics_key, occurred_at, occurred_on, cohort_day, cohort_kind, dedupe_key)
       VALUES ($1, $2, 1, $3, now(), current_date, current_date, 'new', $4)`, [randomUUID(), name, "a".repeat(32), "dk-" + name]), /check|23514/);
  }
  await expectDbError(q(
    `INSERT INTO v2_telemetry_events (event_id, event_name, schema_version, analytics_key, occurred_at, occurred_on, cohort_day, cohort_kind, dedupe_key)
     VALUES ($1, 'session_started', 1, 'not-a-pseudonym-with-raw-id-12345', now(), current_date, current_date, 'new', 'dk')`, [randomUUID()]), /check|22001|23514/);
});

t("reputation corrections are new rows that point at the original; the original stays untouched", async (env) => {
  const { founderId } = await finishedRun(env);
  const q = (sql, params) => env.pool.query(sql, params);
  const original = (await q("SELECT * FROM v2_reputation_events WHERE event_type='origin_run_finalized'")).rows[0];
  const correction = (type, corrects) => q(
    `INSERT INTO v2_reputation_events (event_id, founder_id, event_type, dimension, schema_version, subject_ref, payload, evidence_digest, dedupe_key, corrects_event_id, occurred_at)
     VALUES ($1, $2, $3, 'qualification_performance', 1, $4, '{"reason":"support review"}', $5, $6, $7, now())`,
    [randomUUID(), founderId, type, original.subject_ref, "f".repeat(64), "corr-" + randomUUID(), corrects]);
  await correction("correction", original.event_id);
  await expectDbError(correction("correction", null), /check|23514/);          // a correction must reference something
  await expectDbError(q("UPDATE v2_reputation_events SET payload = '{}'::jsonb WHERE event_id=$1", [original.event_id]), /append-only/);
  assert.equal((await q("SELECT count(*)::int AS n FROM v2_reputation_events")).rows[0].n, 3);
  // no private quest history in stored evidence
  for (const row of (await q("SELECT payload FROM v2_reputation_events")).rows) assert.equal(JSON.stringify(row.payload).includes('"path"'), false);
});

t("separate server instances (separate pools) racing the same settlement credit exactly once", async (env) => {
  const uid = "4200000031";
  const h = harness({ store: env.store, config, telegramUserId: uid });
  await h.startRun();
  for (const id of QUEST_IDS.slice(0, 4)) await h.playQuest(id, bestPath(id, h.seed));
  const last = QUEST_IDS[4], path = bestPath(last, h.seed);
  await h.send("origin_start_quest", { caseId: last });
  for (const c of path.slice(0, 3)) await h.send("origin_choose", { caseId: last, choiceId: c });
  const instances = [env.store, ...Array.from({ length: 3 }, () => createPostgresFounderStore(env.open(4)))];
  const attempts = await Promise.allSettled(Array.from({ length: 16 }, (_, i) => executeFounderCommand({
    store: instances[i % instances.length], config, telegramUserId: uid, command: "origin_choose",
    caseId: last, choiceId: path[3], requestId: i < 8 ? "shared-final" : `unique-${i}`, now: h.now + 10_000
  })));
  const ok = attempts.filter((a) => a.status === "fulfilled");
  assert.ok(ok.length >= 8, "all 8 identical retries succeed (receipt replay) plus exactly one distinct winner or none");
  assert.equal((await env.counts()).settlements, 1);
  assert.equal((await env.ledgerRows()).length, 1);
  for (const a of attempts.filter((x) => x.status === "rejected")) assert.ok(a.reason.status === 409 || a.reason.status === 429, String(a.reason));
  await env.assertReconciled();
});

t("balances, scores and event times round-trip exactly (millisecond precision, no float drift)", async (env) => {
  const { h, snap } = await finishedRun(env, "4200000041");
  const [credit] = await env.ledgerRows();
  assert.equal(credit.occurredAt % 1000, 0); // harness times are whole seconds
  const odd = harness({ store: env.store, config, telegramUserId: "4200000042", startAt: 1_800_000_000_123 });
  await odd.startRun();
  const row = (await env.pool.query(`SELECT ${ms("last_seen_at")} AS seen, ${ms("created_at")} AS created FROM v2_founders ORDER BY created_at DESC LIMIT 1`)).rows[0];
  assert.equal(Number(row.created), 1_800_000_001_123);
  assert.equal(Number(row.seen), 1_800_000_001_123);
  assert.equal(snap.capital.balanceG, credit.balanceAfterG);
  assert.ok(h);
});

t("the reconciliation view detects tampering with the balance (and is empty when healthy)", async (env) => {
  const { founderId } = await finishedRun(env);
  await env.assertReconciled();
  await env.pool.query("UPDATE v2_capital_accounts SET balance_g = balance_g + 5 WHERE founder_id=$1", [founderId]);
  const issues = (await env.pool.query("SELECT issue FROM v2_origin_reconciliation_issues")).rows.map((r) => r.issue);
  assert.deepEqual(issues, ["balance_differs_from_credits"]);
});

// Migration + rollback in a SCRATCH database so the shared CI database is never dropped from.
test("[postgres] migration 002 applies, is re-runnable, rolls back only v2 objects behind a confirmation guard, and re-applies", { skip: !database }, async () => {
  const url = new URL(database);
  const scratch = "gwap_migration_" + randomUUID().replaceAll("-", "").slice(0, 10);
  const admin = new Pool({ connectionString: database, max: 1 });
  try { await admin.query(`CREATE DATABASE ${scratch}`); }
  catch (error) { await admin.end(); assert.fail("needs CREATE DATABASE on the disposable cluster: " + error.message); }
  url.pathname = "/" + scratch;
  const pool = new Pool({ connectionString: url.toString(), max: 2 });
  try {
    const up = await read("002_v2_founder_entry.sql"), down = await read("002_v2_founder_entry.down.sql");
    await assert.rejects(() => pool.query(up), /migration 001 \(v1 schema\) must be applied before 002/);
    await pool.query(await read("001_initial.sql"));
    await pool.query(`INSERT INTO players (telegram_user_id, game_state, balance, seed) VALUES (555, '{"schema":2,"balance":1000,"seed":5}', 1000, 5)`);
    const v1 = async () => (await pool.query("SELECT md5(string_agg(t::text, ',')) AS m FROM players t")).rows[0].m;
    const v1Before = await v1();
    await pool.query(up);
    await pool.query(up); // idempotent
    const objects = async () => (await pool.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'v2\\_%' AND c.relkind IN ('r','v')")).rows[0].n;
    assert.equal(await objects(), 15); // 13 tables + 2 views
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM v2_schema_meta")).rows[0].n, 1);
    await assert.rejects(() => pool.query(down), /rollback refused/);
    assert.equal(await objects(), 15, "a refused rollback changes nothing");
    const client = await pool.connect();
    try { await client.query("SET gwap.confirm_v2_rollback = 'yes'"); await client.query(down); } finally { client.release(); }
    assert.equal(await objects(), 0);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'v2\\_%'")).rows[0].n, 0);
    assert.equal(await v1(), v1Before, "v1 data is byte-identical after apply + rollback");
    for (const table of ["players", "quest_runs", "command_receipts", "virtual_ledger"]) assert.equal((await pool.query("SELECT to_regclass($1) AS r", [table])).rows[0].r, table);
    await pool.query(up);
    assert.equal(await objects(), 15);
    assert.equal(await v1(), v1Before);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${scratch}`);
    await admin.end();
  }
});

t("003/004 transactions preserve ownership, operating capital, XP, upgrades and receipts across retries and rollback", async (env) => {
  const up = await read("003_v2_first_business.sql");
  const down = await read("003_v2_first_business.down.sql");
  const client = await env.pool.connect();
  try {
    // Migrate an already-played 002 founder. All prices are synthetic test inputs.
    const { h, snap } = await finishedRun(env);
    await h.send("enter_hub");
    await client.query(up);
    await client.query(up);
    await assert.rejects(client.query(down), /rollback refused/);
    await client.query("ROLLBACK");
    await client.query("SET gwap.confirm_v2_rollback = 'yes'");
    await client.query(down);
    const restored = await h.snapshot();
    assert.equal(restored.capital.balanceG, snap.capital.balanceG);
    await client.query(up);

    const starterOffer = { businessTypeId: "barbershop", name: "Fixture shop", version: 1, setupCostG: 17, minimumOperatingReserveG: snap.capital.balanceG - 17 };
    const openingConfig = { ...config, businessSchemaEnabled: true, starterOffer };
    const account = (store, settings = openingConfig, telegramUserId = "4200000001") => harness({ store, config: settings, telegramUserId });
    const a = account(env.store);
    const args = { businessTypeId: starterOffer.businessTypeId, templateVersion: 1, choiceId: "scheduled" };
    await assert.rejects(a.send("business_open", { ...args, templateVersion: 2 }), { code: "offer_unavailable" });
    await assert.rejects(a.send("business_open", { ...args, choiceId: "unknown" }), { code: "invalid_supplier_choice" });
    const expensive = account(env.store, { ...openingConfig, starterOffer: { ...starterOffer, minimumOperatingReserveG: starterOffer.minimumOperatingReserveG + 1 } });
    await assert.rejects(expensive.send("business_open", args), { code: "insufficient_capital" });
    assert.equal((await a.snapshot()).capital.balanceG, snap.capital.balanceG);

    const checkSchema = await readFile(new URL("../../scripts/verify-founder-schema.sql", import.meta.url), "utf8");
    await client.query(checkSchema);

    // Failure at the final command-receipt step rolls back the earlier debit and all related rows.
    const exhausted = createPostgresFounderStore(env.pool, { commandBudget: { limit: 0, windowSeconds: 60 } });
    await assert.rejects(account(exhausted).send("business_open", args), { code: "rate_limited" });
    assert.equal((await a.snapshot()).hub.business, null);
    assert.equal((await a.snapshot()).capital.balanceG, snap.capital.balanceG);

    const otherInstance = account(await env.reconnect());
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? a : otherInstance).send("business_open", { ...args, requestId: i < 8 ? "retry-open" : "distinct-" + i })));
    const stored = await otherInstance.snapshot();
    for (const result of attempts) {
      if (result.status === "rejected") assert.equal(result.reason.code, "already_open");
      else assert.deepEqual(result.value.hub.business, stored.hub.business);
    }
    assert.equal(stored.hub.business.decision.choiceId, "scheduled");
    assert.equal(stored.capital.balanceG, starterOffer.minimumOperatingReserveG);
    assert.equal(stored.hub.goals.find(g => g.id === "open_first_company").status, "completed");
    assert.equal((await env.telemetry()).filter(e => e.eventName === "first_company_opened").length, 1);
    for (const table of ["v2_businesses", "v2_founder_decisions", "v2_capital_debit_ledger"])
      assert.equal((await client.query("SELECT count(*)::int AS n FROM "+table)).rows[0].n, 1);
    await expectDbError(client.query("UPDATE v2_capital_debit_ledger SET amount_g = 1"), /append-only/);
    await expectDbError(client.query("DELETE FROM v2_founder_decisions"), /append-only/);

    await client.query(checkSchema);
    // A mock counterparty can inspect only its own assets. The read-only seam moves no G.
    const stranger = account(env.store, openingConfig, "4200000002");
    await stranger.playRun(bestPath);
    assert.equal((await stranger.send("enter_hub")).hub.business, null);
    const replay = await a.playRun(bestPath);
    assert.equal(replay.receipts[0].creditDeltaG, 0);
    assert.equal(replay.capital.balanceG, stored.capital.balanceG);
    assert.deepEqual(replay.hub.business, stored.hub.business);
    await env.assertReconciled();
    const operationsUp = await read("004_v2_operating_cycles.sql");
    const operationsDown = await read("004_v2_operating_cycles.down.sql");
    await client.query(operationsUp);
    await client.query(operationsUp);
    await client.query(operationsDown);
    assert.deepEqual((await a.snapshot()).hub.business,stored.hub.business);
    await client.query(operationsUp);
    const active = { ...openingConfig, operationsSchemaEnabled:true, operatingPolicy:operationsFixture };
    const operator = account(env.store,active);
    const otherOperator = account(await env.reconnect(),active);
    const sell = { cycleNumber:1, policyVersion:1, choiceId:"small", requestId:"first-cycle" };
    const poorTerms = { ...operationsFixture, options:operationsFixture.options.map(o=>({...o,overheadG:snap.capital.balanceG})) };
    await assert.rejects(account(env.store,{...active,operatingPolicy:poorTerms}).send("operate",sell), {code:"insufficient_capital"});
    await assert.rejects(account(exhausted,active).send("operate",sell), {code:"rate_limited"});
    assert.equal((await operator.snapshot()).hub.operations.history.length,0);
    const [first, retry] = await Promise.all([operator.send("operate",sell),otherOperator.send("operate",sell)]);
    assert.deepEqual(first,retry);
    assert.equal(first.capital.balanceG,stored.capital.balanceG+8);
    assert.equal(first.hub.operations.totalXp,7);
    await assert.rejects(operator.send("operate",{...sell,requestId:"stale"}),{code:"cycle_changed"});
    const stockUp = {cycleNumber:2, policyVersion:1, choiceId:"large"};
    await assert.rejects(operator.send("operate",stockUp),{code:"cycle_wait"});
    operator.advance(60000);
    const loss = await operator.send("operate",stockUp);
    assert.equal(loss.hub.operations.history[0].netG,-18);
    assert.equal(loss.capital.balanceG,first.capital.balanceG-18);
    assert.equal(loss.hub.operations.totalXp,7);
    assert.equal(loss.hub.goals.find(g=>g.id==="profitable_decision").status,"completed");
    assert.equal((await env.telemetry()).filter(e=>e.eventName==="first_operating_loss").length,1);
    await assert.rejects(client.query(operationsDown),/rollback refused/);
    await client.query("ROLLBACK");
    const reopened = await otherOperator.snapshot();
    assert.deepEqual(reopened.hub.operations.history,loss.hub.operations.history);
    const afterReplay = await operator.playRun(bestPath);
    assert.equal(afterReplay.capital.balanceG,loss.capital.balanceG);
    assert.equal(afterReplay.hub.operations.totalXp,7);
    const expand={choiceId:"capacity",policyVersion:1};
    const expansion=await operator.send("reinvest",{...expand,requestId:"expand"});
    const expansionRetry=await otherOperator.send("reinvest",{...expand,requestId:"expand"});
    assert.deepEqual(expansion,expansionRetry);
    assert.equal(expansion.hub.operations.offer.capacity,6);
    assert.equal(expansion.capital.balanceG,afterReplay.capital.balanceG-9);
    await assert.rejects(otherOperator.send("reinvest",expand),{code:"already_upgraded"});
    assert.equal((await operator.snapshot()).hub.operations.upgrades.length,1);
    // Non-live agreement seam. Resolve each side from its own authenticated store context.
    const inspectParty = uid => env.store.transaction(uid,async tx => {
      const founder = await tx.findFounder();
      const business = await tx.getBusiness(founder.founderId);
      const {balanceG} = await tx.getCapital(founder.founderId);
      return {founderId:founder.founderId,businessId:business?.businessId ?? null,balanceG};
    });
    const parties = await Promise.all(["4200000001","4200000002"].map(inspectParty));
    const [owner,counterparty] = parties;
    assert.notEqual(owner.founderId,counterparty.founderId);
    const mockTerms = {businessId:stored.hub.business.businessId,requiredG:owner.balanceG};
    const assesses = party => party.businessId === mockTerms.businessId && party.balanceG >= mockTerms.requiredG;
    assert.equal(assesses(owner),true);
    assert.equal(assesses(counterparty),false);
    assert.deepEqual(await Promise.all(["4200000001","4200000002"].map(inspectParty)),parties);
    await env.assertReconciled();
    await client.query(checkSchema);
    await assert.rejects(client.query(down), /rollback refused/);
    await client.query("ROLLBACK");
    assert.deepEqual((await otherInstance.snapshot()).hub.business, stored.hub.business);
  } finally { client.release(); }
});

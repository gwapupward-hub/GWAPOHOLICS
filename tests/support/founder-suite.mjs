// TEST SUPPORT: one behavioural suite, run against BOTH the in-memory twin and real PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../../cases.mjs";
import { isShifted } from "../../game-core.mjs";
import { loadV2Config } from "../../server/v2/config.mjs";
import { executeFounderCommand, FounderError, SESSION_GAP_MS } from "../../server/v2/founder-service.mjs";
import { computeDay2Retention, ACTIVE_EVENT_NAMES } from "../../server/v2/telemetry-contract.mjs";
import { QUEST_IDS, bestPath, harness, medianPath, worstPath } from "./origin-play.mjs";

const ANALYTICS_KEY = "a".repeat(48);
export const baseEnv = {
  GWAP_V2_FOUNDER_HUB: "1", GWAP_V2_ORIGIN_POLICY: "origin-v1-draft",
  GWAP_V2_ALLOW_UNAPPROVED_POLICY: "isolated-preview-only", GWAP_V2_ANALYTICS_KEY: ANALYTICS_KEY
};
export const config = loadV2Config(baseEnv);
const HOUR = 3_600_000;

/** A seed whose evidence regimes let every quest reach its policy minimum (a true 0 G run exists). */
function zeroScoreSeed() {
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));
  for (let seed = 0; seed < 100000; seed += 1) {
    if (!isShifted(byId["streaming-pivot"], seed) && !isShifted(byId["founder-runway"], seed)) return seed;
  }
  throw new Error("no zero-score seed found");
}
const ZERO_SEED = zeroScoreSeed();

function assertNoLeaks(value, { founderId = null, telegramUserId = null, runIds = [] } = {}) {
  const text = JSON.stringify(value);
  for (const needle of [telegramUserId, founderId, ...runIds].filter(Boolean)) assert.equal(text.includes(needle), false, "leaked " + needle);
  for (const banned of ["seed", "idempotency", "rawDelta", "raw_delta", "telegramUserId", "telegram_user_id", "founderId", "originRunId", "initData"]) {
    assert.equal(text.includes(`"${banned}"`), false, "leaked field " + banned);
  }
}

export function defineFounderSuite(label, factory) {
  const t = (name, fn) => test(`[${label}] ${name}`, { skip: factory.skip }, async () => {
    const env = await factory.create();
    try { await fn(env); } finally { await env.close(); }
  });
  const hx = (env, opts = {}) => harness({ store: env.store, config, ...opts });
  const settledScores = async (env) => (await env.ledgerRows()).map((r) => r.creditDeltaG);

  t("zero-capital onboarding: a new account starts at 0 G, nothing is created by merely looking", async (env) => {
    const h = hx(env);
    const before = await h.snapshot();
    assert.equal(before.enrolled, false);
    assert.equal(before.origin.available, true);
    assert.equal(before.capital.balanceG, 0);
    assert.equal(before.nextStep.action.kind, "origin_start_run");
    assert.deepEqual(await env.counts(), { founders: 0, runs: 0, questResults: 0, ledger: 0, settlements: 0, reputation: 0, telemetry: 0 });

    const started = await h.startRun();
    assert.equal(started.enrolled, true);
    assert.equal(started.capital.balanceG, 0);
    assert.equal(started.capital.status, "zero");
    assert.equal(started.origin.graduation.status, "qualifying");
    assert.equal(started.origin.openRun.runNumber, 1);
    assert.equal(started.hub, undefined, "the hub is not reachable before graduation");
    assert.equal(started.nextStep.id, "continue_origin");
    assert.equal(started.founder.cohort, "new");
    const counts = await env.counts();
    assert.equal(counts.founders, 1);
    assert.equal(counts.ledger, 0);
    assert.equal(counts.settlements, 0);
  });

  t("five-quest qualification: verified score, one atomic credit with every required field, graduation", async (env) => {
    const h = hx(env);
    const final = await h.playRun(bestPath);
    assert.equal(final.quest.status, "finalized");
    assert.equal(final.quest.completed.length, 5);
    assert.equal(final.origin.graduation.status, "graduated");
    const score = final.origin.personalBestScoreG;
    assert.ok(score > 0 && score <= 2500);
    assert.equal(final.capital.balanceG, score);
    assert.equal(final.capital.status, "unclassified");
    assert.equal(final.origin.lifetimeCreditedG, score);
    assert.equal(final.nextStep.id, "enter_hub");

    const [credit, ...rest] = await env.ledgerRows();
    assert.equal(rest.length, 0);
    assert.match(credit.transactionId, /^[0-9a-f-]{36}$/);
    assert.match(credit.originRunId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(
      { verifiedScoreG: credit.verifiedScoreG, previousBestG: credit.previousBestG, creditDeltaG: credit.creditDeltaG, bestAfterG: credit.bestAfterG, balanceAfterG: credit.balanceAfterG, policyVersion: credit.policyVersion },
      { verifiedScoreG: score, previousBestG: 0, creditDeltaG: score, bestAfterG: score, balanceAfterG: score, policyVersion: "origin-v1-draft" });
    assert.ok(Number.isFinite(credit.occurredAt) && credit.occurredAt > 0);
    assert.match(credit.idempotencyKey, /^origin-settle:/);
    assert.equal(final.receipts[0].transactionId, credit.transactionId);
    assert.equal((await env.counts()).reputation, 2); // origin_run_finalized + origin_graduated
    await env.assertReconciled();
  });

  t("incomplete runs award no capital and keep the run resumable", async (env) => {
    const h = hx(env);
    await h.startRun();
    for (const id of QUEST_IDS.slice(0, 4)) await h.playQuest(id, bestPath(id, h.seed));
    const mid = await h.snapshot();
    assert.equal(mid.capital.balanceG, 0);
    assert.equal(mid.origin.openRun.questsCompleted, 4);
    assert.equal(mid.quest.provisionalScoreG > 0, true);
    assert.equal(mid.origin.graduation.status, "qualifying");
    assert.equal((await env.counts()).ledger, 0);
    assert.equal((await env.counts()).settlements, 0);
    await assert.rejects(() => h.startRun(), (e) => e.code === "run_already_open");
    // the run survives a brand-new connection / instance
    const resumed = await executeFounderCommand({ store: await env.reconnect(), config, telegramUserId: "4100000001", command: "snapshot", now: h.now + 5000 });
    assert.equal(resumed.origin.openRun.questsCompleted, 4);
  });

  t("quest rules: no repeats inside a run, no hopping mid-chain, no choosing before starting, unknown choices change nothing", async (env) => {
    const h = hx(env);
    await h.startRun();
    await assert.rejects(() => h.send("origin_choose", { caseId: QUEST_IDS[0], choiceId: "all-in" }), (e) => e.code === "quest_not_started");
    await h.send("origin_start_quest", { caseId: QUEST_IDS[0] });
    await assert.rejects(() => h.send("origin_choose", { caseId: QUEST_IDS[0], choiceId: "fake-option" }), (e) => e.code === "invalid_choice");
    await assert.rejects(() => h.send("origin_choose", { caseId: QUEST_IDS[1], choiceId: "x" }), (e) => ["invalid_choice"].includes(e.code));
    const first = bestPath(QUEST_IDS[0], h.seed);
    await h.send("origin_choose", { caseId: QUEST_IDS[0], choiceId: first[0] });
    await assert.rejects(() => h.send("origin_start_quest", { caseId: QUEST_IDS[1] }), (e) => e.code === "finish_current_chain");
    for (const id of first.slice(1)) await h.send("origin_choose", { caseId: QUEST_IDS[0], choiceId: id });
    await assert.rejects(() => h.send("origin_start_quest", { caseId: QUEST_IDS[0] }), (e) => e.code === "quest_already_completed");
    await assert.rejects(() => h.send("origin_start_quest", { caseId: "not-a-quest" }), (e) => e.code === "unknown_quest");
    const snap = await h.snapshot();
    assert.equal(snap.origin.openRun.questsCompleted, 1);
  });

  t("0 G is a valid outcome: a real five-quest completion with no capital still graduates, enters the hub and can replay", async (env) => {
    const h = hx(env, { seed: ZERO_SEED });
    const final = await h.playRun(worstPath);
    assert.equal(final.origin.personalBestScoreG, 0);
    assert.equal(final.capital.balanceG, 0);
    assert.equal(final.capital.status, "zero");
    assert.equal(final.origin.graduation.status, "graduated");
    assert.equal(final.receipts[0].outcome, "no_improvement");
    assert.equal(final.receipts[0].creditDeltaG, 0);
    assert.equal((await env.counts()).ledger, 0, "a zero-delta outcome is a receipt, never a zero-value credit");
    assert.equal((await env.counts()).settlements, 1);
    const hub = await h.send("enter_hub");
    assert.equal(hub.founder.enteredHub, true);
    assert.equal(hub.hub.goals.length, 5);
    assert.equal(hub.nextStep.id, "replay_origin");
    assert.equal(hub.origin.replay.eligible, true);
    assert.equal(hub.hub.recovery.replayAvailable, true);
    const replay = await h.startRun();
    assert.equal(replay.origin.openRun.runNumber, 2);
    await env.assertReconciled();
  });

  t("replays: higher pays only the improvement, equal and lower pay nothing and never reduce the best", async (env) => {
    const h = hx(env);
    const first = await h.playRun(medianPath);
    const mid = first.origin.personalBestScoreG;
    assert.ok(mid > 0, "the first run must earn something for this scenario to be meaningful");
    assert.equal(first.receipts[0].creditDeltaG, mid);
    const high = await h.playRun(bestPath);
    const top = high.origin.personalBestScoreG;
    assert.ok(top > mid);
    assert.equal(high.capital.balanceG, top);
    assert.equal(high.receipts[0].creditDeltaG, top - mid, "only the amount above the previously credited best is paid");
    assert.equal(high.receipts[0].previousBestG, mid);
    const equal = await h.playRun(bestPath);
    assert.equal(equal.receipts[0].outcome, "no_improvement");
    assert.equal(equal.receipts[0].verifiedScoreG, top);
    assert.equal(equal.receipts[0].creditDeltaG, 0);
    const lower = await h.playRun(medianPath);
    assert.equal(lower.receipts[0].outcome, "no_improvement");
    assert.equal(lower.receipts[0].verifiedScoreG, mid);
    const floor = await h.playRun(worstPath);
    assert.equal(floor.receipts[0].outcome, "no_improvement");
    assert.ok(floor.receipts[0].verifiedScoreG < mid);
    assert.equal(floor.origin.personalBestScoreG, top);
    assert.equal(floor.capital.balanceG, top, "a worse replay never removes G");
    assert.deepEqual(await settledScores(env), [mid, top - mid]);
    assert.equal((await env.counts()).settlements, 5);
    assert.equal(floor.origin.finalizedRuns, 5);
    assert.equal(floor.origin.lifetimeCreditedG, top, "lifetime grants equal the personal best, not the sum of replays");
    // capital telemetry: exactly one event per settlement, outcome-consistent with the ledger, never duplicated
    const capitalEvents = (await env.telemetry()).filter((e) => e.eventName === "origin_capital_credit_committed");
    assert.equal(capitalEvents.length, 5, "one capital event per finalized run, zero-delta runs included");
    assert.equal(capitalEvents.filter((e) => e.properties.outcome === "credited").length, (await env.ledgerRows()).length, "credited events == ledger rows");
    assert.equal(capitalEvents.filter((e) => e.properties.outcome === "no_improvement").length, 3);
    assert.equal(capitalEvents.reduce((sum, e) => sum + e.properties.creditDeltaG, 0), top, "event deltas sum to the personal best");
    assert.equal(new Set(capitalEvents.map((e) => e.dedupeKey)).size, 5);
    assert.equal(new Set(capitalEvents.map((e) => e.sourceRef)).size, 5, "each event points at a different (pseudonymous) run");
    await env.assertReconciled();
  });

  t("duplicate-safe: a retried final request returns the stored answer; a fresh request id after settlement is rejected", async (env) => {
    const h = hx(env);
    await h.startRun();
    for (const id of QUEST_IDS.slice(0, 4)) await h.playQuest(id, bestPath(id, h.seed));
    const last = QUEST_IDS[4];
    const path = bestPath(last, h.seed);
    await h.send("origin_start_quest", { caseId: last });
    for (const c of path.slice(0, 3)) await h.send("origin_choose", { caseId: last, choiceId: c });
    const args = { caseId: last, choiceId: path[3], requestId: "final-choice-req" };
    const first = await h.send("origin_choose", args);
    const eventsAfterSettlement = (await env.telemetry()).length;
    const retry = await h.send("origin_choose", args);
    assert.deepEqual(retry, first);
    assert.equal((await env.telemetry()).length, eventsAfterSettlement, "a retried request emits no telemetry");
    assert.equal((await env.ledgerRows()).length, 1);
    await assert.rejects(() => h.send("origin_choose", { caseId: last, choiceId: path[3] }), (e) => e.code === "no_open_run");
    await assert.rejects(() => h.send("origin_start_quest", { caseId: last }), (e) => e.code === "no_open_run");
    await assert.rejects(() => h.send("origin_choose", { ...args, choiceId: path[2] }), (e) => e.code === "request_id_conflict");
    assert.equal((await env.telemetry()).length, eventsAfterSettlement, "rejected duplicates emit no telemetry");
    assert.equal((await env.ledgerRows()).length, 1);
    assert.equal((await env.counts()).settlements, 1);
    await env.assertReconciled();
  });

  t("concurrency: identical and distinct simultaneous final requests settle exactly once", async (env) => {
    const h = hx(env);
    await h.startRun();
    for (const id of QUEST_IDS.slice(0, 4)) await h.playQuest(id, bestPath(id, h.seed));
    const last = QUEST_IDS[4];
    const path = bestPath(last, h.seed);
    await h.send("origin_start_quest", { caseId: last });
    for (const c of path.slice(0, 3)) await h.send("origin_choose", { caseId: last, choiceId: c });

    const same = await Promise.all(Array.from({ length: 6 }, () => h.send("origin_choose", { caseId: last, choiceId: path[3], requestId: "same-final" })));
    for (const r of same) assert.deepEqual(r, same[0]);
    assert.equal((await env.ledgerRows()).length, 1);

    // Fresh run; this time every duplicate carries a DIFFERENT request id (a buggy or hostile client).
    await h.startRun();
    for (const id of QUEST_IDS.slice(0, 4)) await h.playQuest(id, worstPath(id, h.seed));
    await h.send("origin_start_quest", { caseId: last });
    for (const c of worstPath(last, h.seed).slice(0, 3)) await h.send("origin_choose", { caseId: last, choiceId: c });
    const wp = worstPath(last, h.seed);
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => h.send("origin_choose", { caseId: last, choiceId: wp[3], requestId: `distinct-${i}` })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    for (const r of results.filter((x) => x.status === "rejected")) assert.ok(r.reason instanceof FounderError, String(r.reason));
    const settlements = await env.counts();
    assert.equal(settlements.settlements, 2, "exactly one settlement per finalized run");
    assert.equal((await env.ledgerRows()).length, 1, "the worse replay credited nothing");
    await env.assertReconciled();
  });

  t("concurrent first logins create one founder, one run and one first-login event", async (env) => {
    const h = hx(env);
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => h.send("origin_start_run")));
    assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
    for (const a of attempts.filter((x) => x.status === "rejected")) assert.equal(a.reason.code, "run_already_open");
    const counts = await env.counts();
    assert.equal(counts.founders, 1);
    assert.equal(counts.runs, 1);
    const events = await env.telemetry();
    assert.equal(events.filter((e) => e.eventName === "founder_first_login").length, 1);
    const snaps = await Promise.all(Array.from({ length: 6 }, () => h.snapshot()));
    assert.equal((await env.telemetry()).filter((e) => e.eventName === "session_started").length, 1, "parallel opens from several devices are one session");
    assert.ok(snaps.every((s) => s.origin.openRun.runNumber === 1));
  });

  t("cross-session persistence: the hub, best score and capital survive new connections and new sessions", async (env) => {
    const h = hx(env);
    await h.playRun(bestPath);
    const hub = await h.send("enter_hub");
    const again = await h.send("enter_hub");
    assert.equal(again.founder.enteredHub, true);
    assert.equal((await env.telemetry()).filter((e) => e.eventName === "founder_entered_v2").length, 1, "entering twice emits once");
    const later = await executeFounderCommand({ store: await env.reconnect(), config, telegramUserId: "4100000001", command: "snapshot", now: h.now + 3 * HOUR });
    assert.equal(later.capital.balanceG, hub.capital.balanceG);
    assert.equal(later.origin.personalBestScoreG, hub.origin.personalBestScoreG);
    assert.deepEqual(later.hub.goals, hub.hub.goals);
    assert.equal(later.founder.code, hub.founder.code);
    assert.equal((await env.telemetry()).filter((e) => e.eventName === "session_started").length, 2);
  });

  t("legacy v1 compatibility: a legacy tester gets a separate 0 G v2 account and v1 data is never touched", async (env) => {
    await env.legacy.seed("4100000002");
    const before = await env.legacy.fingerprint();
    const h = hx(env, { telegramUserId: "4100000002" });
    const final = await h.playRun(bestPath);
    await h.send("enter_hub");
    assert.equal(final.founder.cohort, "legacy_v1");
    assert.equal(final.capital.balanceG, final.origin.personalBestScoreG, "v2 capital comes only from verified Origin credit, not the v1 balance");
    assert.notEqual(final.capital.balanceG, 1000);
    assert.equal(await env.legacy.fingerprint(), before, "v1 players / quest_runs / virtual_ledger / receipts unchanged");
    assert.ok((await env.telemetry()).every((e) => e.cohortKind === "legacy_v1"));
    // a brand-new account is tagged separately
    const fresh = await hx(env, { telegramUserId: "4100000003" }).startRun();
    assert.equal(fresh.founder.cohort, "new");
  });

  t("authentication and ownership boundaries: accounts are isolated and identities must be valid Telegram ids", async (env) => {
    const a = hx(env, { telegramUserId: "4100000011" });
    const b = hx(env, { telegramUserId: "4100000012" });
    const finalA = await a.playRun(bestPath);
    assert.equal((await b.snapshot()).enrolled, false);
    const startB = await b.send("origin_start_run", { requestId: "shared-request-id" });
    assert.equal(startB.capital.balanceG, 0);
    assert.equal(startB.origin.personalBestScoreG, 0);
    // request ids are namespaced per account: B reusing A's id gets B's own result, never A's stored response
    const sameIdA = await a.send("enter_hub", { requestId: "shared-request-id" });
    assert.equal(sameIdA.capital.balanceG, finalA.capital.balanceG);
    assert.equal(startB.founder.code === sameIdA.founder.code, false);
    await assert.rejects(() => b.send("enter_hub"), (e) => e.code === "not_graduated");
    for (const bad of ["", "abc", "0", "-5", "1.5", "12345678901234567890123", null, undefined]) {
      await assert.rejects(() => executeFounderCommand({ store: env.store, config, telegramUserId: bad, command: "snapshot" }), (e) => e.code === "identity_required" && e.status === 401);
    }
    assert.equal((await env.counts()).founders, 2);
  });

  t("telemetry: deduplicated, bounded sessions, source-linked, with no re-identifying data", async (env) => {
    const h = hx(env, { telegramUserId: "4100000021" });
    const final = await h.playRun(bestPath);
    await h.snapshot(); await h.snapshot(); await h.snapshot();
    h.advance(SESSION_GAP_MS + 1000);
    await h.snapshot();
    await h.send("enter_hub");
    await h.snapshot();
    const events = await env.telemetry();
    const names = events.map((e) => e.eventName);
    assert.deepEqual(events.filter((e) => e.eventName === "session_started").map((e) => e.properties.sessionOrdinal), [1, 2]);
    assert.equal(names.filter((n) => n === "founder_first_login").length, 1);
    assert.equal(names.filter((n) => n === "origin_quest_completed").length, 5);
    assert.equal(names.filter((n) => n === "origin_run_finalized").length, 1);
    assert.equal(names.filter((n) => n === "origin_capital_credit_committed").length, 1);
    assert.equal(names.filter((n) => n === "founder_entered_v2").length, 1);
    assert.equal(names.filter((n) => n === "founder_goal_viewed").length, 1, "one goal impression per session");
    assert.ok(names.every((n) => ACTIVE_EVENT_NAMES.includes(n)), "reserved events are never emitted");
    assert.equal(names.includes("first_company_opened") || names.includes("first_operating_loss"), false);
    const credit = events.find((e) => e.eventName === "origin_capital_credit_committed");
    assert.deepEqual({ ...credit.properties }, { runNumber: 1, outcome: "credited", scoreG: final.origin.personalBestScoreG, previousBestG: 0, creditDeltaG: final.origin.personalBestScoreG, policyVersion: "origin-v1-draft" });
    assert.ok(new Set(events.map((e) => e.dedupeKey)).size === events.length);
    // pseudonymity: one stable key per founder, different across founders, nothing joinable
    assert.equal(new Set(events.map((e) => e.analyticsKey)).size, 1);
    const other = await hx(env, { telegramUserId: "4100000022" }).startRun();
    const otherKey = (await env.telemetry()).find((e) => e.eventName === "founder_first_login" && e.analyticsKey !== events[0].analyticsKey);
    assert.ok(otherKey);
    const rows = JSON.stringify(await env.telemetry());
    const runIds = (await env.ledgerRows()).map((r) => r.originRunId);
    for (const needle of ["4100000021", "4100000022", ...runIds, final.receipts[0].transactionId]) assert.equal(rows.includes(needle), false, "telemetry leaked " + needle);
    assert.ok(other.enrolled);
  });

  t("telemetry cohorts feed the day-2 retention definition (UTC cohort day, next-day and rolling 24-48h)", async (env) => {
    const d0 = Date.UTC(2026, 10, 20, 22);
    const h = hx(env, { telegramUserId: "4100000031", startAt: d0 });
    await h.startRun();
    const next = await executeFounderCommand({ store: env.store, config, telegramUserId: "4100000031", command: "snapshot", now: d0 + 6 * HOUR }); // 04:00 UTC next day, <24h later
    assert.equal(next.enrolled, true);
    const g = hx(env, { telegramUserId: "4100000032", startAt: d0 });
    await g.startRun();
    await executeFounderCommand({ store: env.store, config, telegramUserId: "4100000032", command: "snapshot", now: d0 + 30 * HOUR });
    const h3 = hx(env, { telegramUserId: "4100000033", startAt: d0 });
    await h3.startRun();
    const rows = computeDay2Retention(await env.telemetry(), { minCohortSize: 1 });
    assert.equal(rows.length, 1);
    // 031 returns 6h later (next UTC day, <24h); 032 returns 30h later (cohort day + 2, inside 24-48h); 033 never returns.
    assert.deepEqual({ ...rows[0] }, { cohortDay: "2026-11-20", cohortKind: "new", cohortSize: 3, returnedNextUtcDay: 1, returned24To48h: 1, reportable: true });
    assert.deepEqual(await env.retentionView(), [{ cohortDay: "2026-11-20", cohortKind: "new", cohortSize: 3, returnedNextUtcDay: 1, returned24To48h: 1 }]);
  });

  t("without an analytics key the game still works and nothing is recorded", async (env) => {
    const noKey = loadV2Config({ ...baseEnv, GWAP_V2_ANALYTICS_KEY: "" });
    assert.equal(noKey.analyticsKey, null);
    const h = harness({ store: env.store, config: noKey, telegramUserId: "4100000041" });
    const final = await h.playRun(bestPath);
    assert.ok(final.capital.balanceG > 0);
    assert.equal((await env.counts()).telemetry, 0);
  });

  t("disabled and unapproved states fail closed: hub flag off, no policy, unknown/business commands", async (env) => {
    const calls = [];
    const spy = { transaction: (...args) => { calls.push(args); return env.store.transaction(...args); } };
    const off = loadV2Config({});
    await assert.rejects(() => executeFounderCommand({ store: spy, config: off, telegramUserId: "4100000051", command: "snapshot" }), (e) => e.status === 404);
    await assert.rejects(() => executeFounderCommand({ store: spy, config: off, telegramUserId: "4100000051", command: "origin_start_run", requestId: "x" }), (e) => e.status === 404);
    assert.equal(calls.length, 0, "a disabled feature never reaches the store");

    const noPolicy = loadV2Config({ GWAP_V2_FOUNDER_HUB: "1", GWAP_V2_ORIGIN_POLICY: "origin-v1-draft", GWAP_V2_ANALYTICS_KEY: ANALYTICS_KEY });
    const closed = await executeFounderCommand({ store: spy, config: noPolicy, telegramUserId: "4100000051", command: "snapshot" });
    assert.equal(closed.origin.available, false);
    assert.equal(closed.origin.unavailableReason, "policy_unapproved");
    assert.equal(closed.nextStep.action, null);
    await assert.rejects(() => executeFounderCommand({ store: spy, config: noPolicy, telegramUserId: "4100000051", command: "origin_start_run", requestId: "y" }), (e) => e.code === "origin_unavailable");
    assert.equal((await env.counts()).founders, 0);

    for (const command of ["open_business", "buy_business", "credit_capital", "set_score", "grant_g", "origin_finalize", "convert_g_to_stars", "directory_opt_in"]) {
      await assert.rejects(() => executeFounderCommand({ store: env.store, config, telegramUserId: "4100000051", command, requestId: "z" }), (e) => e.code === "invalid_command" && e.status === 400, command);
    }
    const h = hx(env, { telegramUserId: "4100000052" });
    await h.playRun(bestPath);
    const hub = await h.send("enter_hub");
    assert.equal(hub.features.business_opening, false);
    assert.equal(hub.features.founder_directory, false);
    assert.equal(hub.features.external_reputation_linking, false);
    assert.ok(hub.hub.businessPreviews.length === 3 && hub.hub.businessPreviews.every((p) => p.purchasable === false && p.status === "upcoming"));
    assert.equal(JSON.stringify(hub.hub.businessPreviews).includes("setupCostG"), false, "unapproved prices stay hidden by default");
  });

  t("the snapshot never leaks identifiers, seeds, raw results or idempotency data", async (env) => {
    const h = hx(env, { telegramUserId: "4100000061", seed: 424242 });
    await h.startRun();
    const mid = await h.snapshot();
    assertNoLeaks(mid, { telegramUserId: "4100000061" });
    const final = await h.playRun(bestPath).catch(() => null);
    const hub = (final && (await h.send("enter_hub"))) || (await h.snapshot());
    const runIds = (await env.ledgerRows()).map((r) => r.originRunId);
    const founderId = (await env.founderIdFor("4100000061"));
    assertNoLeaks(hub, { telegramUserId: "4100000061", founderId, runIds });
    assert.equal(JSON.stringify(hub).includes("424242"), false, "the run seed never reaches the client");
  });

  t("the durable write budget limits command floods but never blocks read-only snapshots or receipt replays", async (env) => {
    const small = await factory.create({ commandBudget: { limit: 3, windowSeconds: 60 } });
    try {
      const h = harness({ store: small.store, config, telegramUserId: "4100000071" });
      await h.startRun();
      await assert.rejects(() => h.startRun(), (e) => e.code === "run_already_open");
      await h.send("origin_start_quest", { caseId: QUEST_IDS[0] });
      await h.send("origin_start_quest", { caseId: QUEST_IDS[0], requestId: "r-4" }).catch(() => null);
      await assert.rejects(() => h.send("origin_start_quest", { caseId: QUEST_IDS[0] }), (e) => e.code === "rate_limited" && e.status === 429);
      await h.snapshot();
      const replay = await h.send("origin_start_quest", { caseId: QUEST_IDS[0], requestId: "r-4" }).catch((e) => e);
      assert.ok(replay);
    } finally { await small.close(); }
  });
}

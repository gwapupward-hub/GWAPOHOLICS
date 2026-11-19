import { createHash, randomUUID } from "node:crypto";
import { FounderError, applyChoice, finishQuest, generateRunSeed, isChainComplete, startQuest } from "./origin-engine.mjs";
import { computeCredit, scoreBand, scoreRun, questScoreBand } from "./origin-policy.mjs";
import { buildFounderSnapshot, buildNotEnrolledSnapshot } from "./hub-view.mjs";
import { buildTelemetryEvent, utcDay } from "./telemetry-contract.mjs";
import { buildReputationEvent } from "./reputation-contract.mjs";
import { classifyCapital, entryCapitalThresholdG } from "./business-templates.mjs";
import { GOAL_LADDER_VERSION, GOAL_DEFINITIONS } from "./goals.mjs";

export { FounderError };

/**
 * Server-authoritative Founder / Origin command service (Sprint 1).
 *
 * The client may send only: command, requestId, caseId, choiceId. It can never
 * send a score, a run id, a founder id, a balance or an event. Identity comes
 * from the verified session; every score is recomputed here from the stored
 * decisions and the server-issued seed.
 *
 * Store contract: store.transaction(telegramUserId, fn) must serialize all work
 * for that Telegram identity (per-player lock) and commit/rollback atomically.
 */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const PRESENCE_WRITE_INTERVAL_MS = 60 * 1000;
export const COMMANDS = Object.freeze(["snapshot", "origin_start_run", "origin_start_quest", "origin_choose", "enter_hub"]);

function requireIdentity(userId) {
  if (!/^[1-9][0-9]{0,18}$/.test(String(userId || ""))) throw new FounderError("identity_required", "Valid Telegram identity required", 401);
  return String(userId);
}
function requireId(value, name, max = 96) {
  if (typeof value !== "string" || !value.length || value.length > max || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new FounderError("invalid_request", "Invalid " + name, 400);
  }
  return value;
}

async function emit(ctx, name, { sourceId = null, properties, dedupeParts = [] }) {
  if (!ctx.config.analyticsKey) return false; // privacy fail-closed: no key, no analytics
  const f = ctx.founder;
  const event = buildTelemetryEvent({
    name, eventId: randomUUID(), founderId: f.founderId, secret: ctx.config.analyticsKey,
    occurredAt: ctx.now, cohortDay: utcDay(f.createdAt), cohortKind: f.cohortKind, sourceId, properties, dedupeParts
  });
  return ctx.tx.addTelemetryEvent(event);
}

async function recordPresence(ctx) {
  const f = ctx.founder;
  const gap = ctx.now - f.lastSeenAt;
  if (f.sessionOrdinal === 0 || gap >= SESSION_GAP_MS) {
    const ordinal = f.sessionOrdinal + 1;
    await ctx.tx.touchFounder({ founderId: f.founderId, sessionOrdinal: ordinal, lastSeenAt: ctx.now, now: ctx.now });
    f.sessionOrdinal = ordinal;
    f.lastSeenAt = ctx.now;
    await emit(ctx, "session_started", {
      properties: { sessionOrdinal: ordinal }, dedupeParts: [ordinal]
    });
  } else if (gap >= PRESENCE_WRITE_INTERVAL_MS) {
    await ctx.tx.touchFounder({ founderId: f.founderId, sessionOrdinal: f.sessionOrdinal, lastSeenAt: ctx.now, now: ctx.now });
    f.lastSeenAt = ctx.now;
  }
}

async function loadBundle(ctx) {
  const { tx, founder } = ctx;
  const qualification = await tx.getQualification(founder.founderId);
  const capital = await tx.getCapital(founder.founderId);
  const latest = await tx.getLatestRun(founder.founderId);
  const settlements = await tx.listSettlements(founder.founderId, 10);
  return { founder, qualification, capital, latest, settlements };
}

function capitalStatusOf(config, balanceG) {
  return classifyCapital(balanceG, entryCapitalThresholdG({ showIllustrativeEconomics: config.showIllustrativeEconomics }));
}

async function snapshotOf(ctx, { impression = false } = {}) {
  const bundle = await loadBundle(ctx);
  if (impression && ctx.founder.enteredV2At && bundle.qualification.graduatedAt) {
    await emit(ctx, "founder_goal_viewed", {
      properties: { goalsVersion: GOAL_LADDER_VERSION, goalCount: GOAL_DEFINITIONS.length, basis: "server_snapshot" },
      dedupeParts: [ctx.founder.sessionOrdinal, GOAL_LADDER_VERSION]
    });
  }
  return buildFounderSnapshot({ config: ctx.config, bundle });
}

async function enroll(ctx) {
  const cohortKind = (await ctx.tx.hasLegacyV1Player()) ? "legacy_v1" : "new";
  const founder = await ctx.tx.createFounder({ founderId: randomUUID(), cohortKind, now: ctx.now });
  ctx.founder = founder;
  await emit(ctx, "founder_first_login", { properties: { cohortKind }, dedupeParts: [] });
  await emit(ctx, "session_started", {
    properties: { sessionOrdinal: founder.sessionOrdinal }, dedupeParts: [founder.sessionOrdinal]
  });
}

async function startRun(ctx, newSeed) {
  if (!ctx.founder) await enroll(ctx);
  else await recordPresence(ctx);
  const open = await ctx.tx.getOpenRun(ctx.founder.founderId);
  if (open) throw new FounderError("run_already_open", "Finish your current Origin run first", 409);
  await ctx.tx.createRun({
    founderId: ctx.founder.founderId, originRunId: randomUUID(), policyVersion: ctx.config.policy.version,
    seed: newSeed(), now: ctx.now
  });
}

async function requireOpenRun(ctx) {
  const run = await ctx.tx.getOpenRun(ctx.founder.founderId);
  if (!run) throw new FounderError("no_open_run", "Start an Origin run first", 409);
  if (run.policyVersion !== ctx.config.policy.version) throw new FounderError("policy_changed", "This run belongs to a different scoring policy", 409);
  return run;
}

async function startQuestCommand(ctx, caseId) {
  requireId(caseId, "caseId", 60);
  await recordPresence(ctx);
  const run = await requireOpenRun(ctx);
  const results = await ctx.tx.getRunResults({ founderId: ctx.founder.founderId, originRunId: run.originRunId });
  const draft = startQuest({ policy: ctx.config.policy, results, draft: run.draft, caseId });
  await ctx.tx.setDraft({ founderId: ctx.founder.founderId, originRunId: run.originRunId, draft });
}

async function chooseCommand(ctx, caseId, choiceId) {
  requireId(caseId, "caseId", 60);
  requireId(choiceId, "choiceId", 60);
  await recordPresence(ctx);
  const { config, tx } = ctx;
  const policy = config.policy;
  const run = await requireOpenRun(ctx);
  if (!run.draft) throw new FounderError("quest_not_started", "Start this scenario first", 409);
  const draft = applyChoice({ policy, draft: run.draft, caseId, choiceId });
  if (!isChainComplete(policy, draft)) {
    await tx.setDraft({ founderId: ctx.founder.founderId, originRunId: run.originRunId, draft });
    return;
  }

  // The quest is complete: score it on the server, then (if it is the fifth)
  // finalize the run and settle capital in this same transaction.
  const done = finishQuest({ policy, seed: run.seed, caseId, path: draft.path });
  await tx.insertQuestResult({ originRunId: run.originRunId, founderId: ctx.founder.founderId, ...done, completedAt: ctx.now });
  await tx.setDraft({ founderId: ctx.founder.founderId, originRunId: run.originRunId, draft: null });
  const results = await tx.getRunResults({ founderId: ctx.founder.founderId, originRunId: run.originRunId });
  await emit(ctx, "origin_quest_completed", {
    sourceId: run.originRunId,
    properties: {
      questId: caseId, runNumber: run.runNumber, questOrder: results.length, scoreBand: questScoreBand(policy, done.questScoreG)
    },
    dedupeParts: [caseId]
  });
  if (results.length < policy.questIds.length) return;
  await settleFinalizedRun(ctx, run, results);
}

/** Single-transaction finalization + settlement. Called exactly once per run. */
async function settleFinalizedRun(ctx, run, results) {
  const { tx, config, founder, now } = ctx;
  const policy = config.policy;
  const questScores = Object.fromEntries(results.map((r) => [r.caseId, r.questScoreG]));
  const verifiedScoreG = scoreRun(policy, questScores);
  const qualification = await tx.getQualification(founder.founderId);
  const credit = computeCredit(policy, { verifiedScoreG, previousBestG: qualification.bestScoreG });
  const idempotencyKey = `origin-settle:${run.originRunId}`;
  const wasGraduated = Boolean(qualification.graduatedAt);

  await tx.finalizeRun({ founderId: founder.founderId, originRunId: run.originRunId, verifiedScoreG, finalizedAt: now });

  let transactionId = null;
  if (credit.creditDeltaG > 0) {
    transactionId = randomUUID();
    const balanceAfterG = await tx.creditCapital({ founderId: founder.founderId, deltaG: credit.creditDeltaG, now });
    await tx.insertCapitalCredit({
      transactionId, founderId: founder.founderId, originRunId: run.originRunId, verifiedScoreG,
      previousBestG: qualification.bestScoreG, creditDeltaG: credit.creditDeltaG, bestAfterG: credit.bestAfterG,
      balanceAfterG, policyVersion: policy.version, idempotencyKey, occurredAt: now
    });
  }
  await tx.insertSettlement({
    originRunId: run.originRunId, founderId: founder.founderId, verifiedScoreG,
    previousBestG: qualification.bestScoreG, creditDeltaG: credit.creditDeltaG, bestAfterG: credit.bestAfterG,
    outcome: credit.outcome, transactionId, policyVersion: policy.version, idempotencyKey, settledAt: now
  });
  await tx.recordFinalization({
    founderId: founder.founderId, bestScoreG: credit.bestAfterG, creditDeltaG: credit.creditDeltaG,
    bestRunId: credit.creditDeltaG > 0 ? run.originRunId : null, graduatedAt: now, now
  });

  await tx.addReputationEvent({ founderId: founder.founderId, ...buildReputationEvent({
    eventId: randomUUID(), type: "origin_run_finalized", subjectRef: run.originRunId, policyVersion: policy.version,
    payload: { originRunId: run.originRunId, runNumber: run.runNumber, verifiedScoreG, questScoresG: questScores, policyVersion: policy.version },
    occurredAt: now, dedupeKey: `origin_run_finalized:${run.originRunId}`
  }) });
  if (!wasGraduated) {
    await tx.addReputationEvent({ founderId: founder.founderId, ...buildReputationEvent({
      eventId: randomUUID(), type: "origin_graduated", subjectRef: run.originRunId, policyVersion: policy.version,
      payload: { originRunId: run.originRunId, runNumber: run.runNumber, verifiedScoreG, policyVersion: policy.version },
      occurredAt: now, dedupeKey: `origin_graduated:${founder.founderId}`
    }) });
  }

  await emit(ctx, "origin_run_finalized", {
    sourceId: run.originRunId,
    properties: { runNumber: run.runNumber, scoreBand: scoreBand(policy, verifiedScoreG), isReplay: run.runNumber > 1 },
    dedupeParts: []
  });
  await emit(ctx, "origin_capital_credit_committed", {
    sourceId: run.originRunId,
    properties: {
      runNumber: run.runNumber, outcome: credit.outcome, scoreG: verifiedScoreG,
      previousBestG: qualification.bestScoreG, creditDeltaG: credit.creditDeltaG, policyVersion: policy.version
    },
    dedupeParts: []
  });
}

async function enterHubCommand(ctx) {
  await recordPresence(ctx);
  const qualification = await ctx.tx.getQualification(ctx.founder.founderId);
  if (!qualification.graduatedAt) throw new FounderError("not_graduated", "Complete all five Origin quests first", 409);
  if (ctx.founder.enteredV2At) return;
  await ctx.tx.markEnteredV2({ founderId: ctx.founder.founderId, now: ctx.now });
  ctx.founder.enteredV2At = ctx.now;
  const capital = await ctx.tx.getCapital(ctx.founder.founderId);
  await emit(ctx, "founder_entered_v2", {
    properties: { capitalStatus: capitalStatusOf(ctx.config, capital.balanceG) },
    dedupeParts: []
  });
}

export async function executeFounderCommand({
  store, config, telegramUserId, command, requestId, caseId, choiceId, now = Date.now(), newSeed = generateRunSeed
} = {}) {
  if (!config?.founderHubEnabled) throw new FounderError("not_found", "Not found", 404);
  const uid = requireIdentity(telegramUserId);
  if (!store || typeof store.transaction !== "function") throw new FounderError("service_unavailable", "Authoritative store unavailable", 503);
  if (!COMMANDS.includes(command)) throw new FounderError("invalid_command", "Unknown command", 400);
  if (!Number.isSafeInteger(now) || now < 0) throw new FounderError("invalid_request", "Invalid server time", 400);
  const mutating = command !== "snapshot";
  if (mutating) {
    requestId = requireId(requestId, "requestId", 96);
    if (!config.policy) throw new FounderError("origin_unavailable", "Origin qualification is not open", 409);
  }
  const hash = mutating
    ? createHash("sha256").update(JSON.stringify({ command, caseId: caseId ?? null, choiceId: choiceId ?? null })).digest("hex")
    : null;

  return store.transaction(uid, async (tx) => {
    if (mutating) {
      const receipt = await tx.getReceipt(requestId, hash);
      if (receipt) return receipt;
    }
    const ctx = { tx, config, now, founder: await tx.findFounder() };

    if (command === "snapshot") {
      if (!ctx.founder) return buildNotEnrolledSnapshot({ config });
      await recordPresence(ctx);
      return snapshotOf(ctx, { impression: true });
    }

    if (command === "origin_start_run") await startRun(ctx, newSeed);
    else {
      if (!ctx.founder) throw new FounderError("not_enrolled", "Start your Origin first", 409);
      if (command === "origin_start_quest") await startQuestCommand(ctx, caseId);
      else if (command === "origin_choose") await chooseCommand(ctx, caseId, choiceId);
      else await enterHubCommand(ctx);
    }
    const result = await snapshotOf(ctx, { impression: command === "enter_hub" });
    await tx.setReceipt(requestId, result, hash);
    return result;
  });
}

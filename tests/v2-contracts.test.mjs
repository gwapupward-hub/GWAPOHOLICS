import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_EVENT_NAMES, EVENT_DEFINITIONS, RESERVED_EVENT_NAMES, analyticsKeyFor, buildTelemetryEvent,
  computeDay2Retention, sourceRefFor, validateEventProperties
} from "../server/v2/telemetry-contract.mjs";
import { GOAL_DEFINITIONS, deriveGoals } from "../server/v2/goals.mjs";
import {
  BUSINESS_TEMPLATES, classifyCapital, entryCapitalThresholdG, approvedStarterOffer, previewBusinessTemplates
} from "../server/v2/business-templates.mjs";
import {
  EXTERNAL_LINKING_APPROVED, buildAttestationPreview, buildReputationEvent, canonicalJson, evidenceDigest
} from "../server/v2/reputation-contract.mjs";
import { DEFAULT_VISIBILITY, PUBLIC_CARD_FIELDS, isValidAlias, projectPublicFounderCard } from "../server/v2/visibility-contract.mjs";

const SECRET = "s".repeat(40);
const FOUNDER = "11111111-1111-4111-8111-111111111111";
const UUID = "22222222-2222-4222-8222-222222222222";

test("business opening has a verified event and operating losses remain reserved", () => {
  assert.deepEqual(ACTIVE_EVENT_NAMES, [
    "session_started", "founder_first_login", "origin_quest_completed", "origin_run_finalized",
    "origin_capital_credit_committed", "founder_entered_v2", "founder_goal_viewed", "first_company_opened"
  ]);
  assert.deepEqual(RESERVED_EVENT_NAMES, ["first_operating_loss"]);
  for (const name of RESERVED_EVENT_NAMES) {
    assert.throws(() => validateEventProperties(name, {}), /reserved and cannot be emitted yet/);
    assert.throws(() => buildTelemetryEvent({
      name, eventId: UUID, founderId: FOUNDER, secret: SECRET, occurredAt: 1, cohortDay: "2026-11-19", cohortKind: "new", properties: {}
    }), /reserved/);
  }
  assert.throws(() => validateEventProperties("made_up_event", {}), /Unknown telemetry event/);
});

test("telemetry property allow-list rejects ids, free text, extra and missing keys", () => {
  const ok = { runNumber: 2, outcome: "credited", scoreG: 900, previousBestG: 500, creditDeltaG: 400, policyVersion: "origin-v1-draft" };
  assert.doesNotThrow(() => validateEventProperties("origin_capital_credit_committed", ok));
  for (const bad of [
    { ...ok, telegramUserId: "123456789" }, { ...ok, quizAnswers: ["a"] }, { ...ok, walletAddress: "So1ana" },
    { ...ok, outcome: "free text about a player" }, { ...ok, scoreG: 1.5 }, { ...ok, scoreG: -1 }, { ...ok, creditDeltaG: "400" }
  ]) assert.throws(() => validateEventProperties("origin_capital_credit_committed", bad));
  const { runNumber, ...missing } = ok;
  assert.throws(() => validateEventProperties("origin_capital_credit_committed", missing), /Missing telemetry property/);
  assert.throws(() => validateEventProperties("session_started", null));
  // every active event's property specs contain only enum/int/bool: free text cannot be expressed
  for (const name of ACTIVE_EVENT_NAMES) {
    for (const spec of Object.values(EVENT_DEFINITIONS[name].properties)) assert.ok(["int", "enum", "bool"].includes(spec.type));
  }
});

test("analytics key is pseudonymous, stable per founder, secret-dependent and never a Telegram id", () => {
  const a = analyticsKeyFor(FOUNDER, SECRET);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(a, analyticsKeyFor(FOUNDER, SECRET));
  assert.notEqual(a, analyticsKeyFor(UUID, SECRET));
  assert.notEqual(a, analyticsKeyFor(FOUNDER, "t".repeat(40)));
  assert.throws(() => analyticsKeyFor(FOUNDER, "short"), /Analytics key unavailable/);
  assert.throws(() => analyticsKeyFor("1234567890", SECRET), /Invalid founder id/);
  const RUN = "33333333-3333-4333-8333-333333333333";
  const event = buildTelemetryEvent({
    name: "origin_run_finalized", eventId: UUID, founderId: FOUNDER, secret: SECRET, occurredAt: Date.UTC(2026, 10, 19, 12),
    cohortDay: "2026-11-19", cohortKind: "new", sourceId: RUN, properties: { runNumber: 1, scoreBand: "q3", isReplay: false }
  });
  const serialized = JSON.stringify(event);
  // The analytics row alone must not be joinable to a founder or a run: no raw UUIDs anywhere in it.
  assert.equal(serialized.includes(FOUNDER), false);
  assert.equal(serialized.includes(RUN), false);
  assert.match(event.sourceRef, /^[0-9a-f]{32}$/);
  assert.equal(event.sourceRef, sourceRefFor(RUN, SECRET));
  assert.notEqual(event.sourceRef, sourceRefFor(RUN, "t".repeat(40)));
  assert.equal(event.dedupeKey, ["origin_run_finalized", event.analyticsKey, event.sourceRef].join(":"));
  assert.throws(() => buildTelemetryEvent({ name: "session_started", eventId: UUID, founderId: FOUNDER, secret: SECRET, occurredAt: 1, cohortDay: "2026-11-19", cohortKind: "new", properties: { sessionOrdinal: 1 }, dedupeParts: [FOUNDER] }), /Invalid dedupe parts/);
  assert.equal(event.occurredOn, "2026-11-19");
  assert.equal(event.schemaVersion, 1);
  assert.ok(Object.isFrozen(event) && Object.isFrozen(event.properties));
  for (const key of ["telegram", "initData", "username", "firstname", "lastname", "wallet", "answer", "path", "founderid", "balance"]) {
    assert.equal(Object.keys(event).concat(Object.keys(event.properties)).some((k) => k.toLowerCase().includes(key.toLowerCase())), false, key);
  }
});

test("day-2 retention: cohort = first-login UTC day; next-UTC-day and rolling 24-48h are separate measures", () => {
  const day = (d, h = 12) => Date.UTC(2026, 10, d, h);
  const mk = (key, name, at, cohortDay = "2026-11-10", kind = "new") => ({
    eventName: name, analyticsKey: key, occurredAt: at, occurredOn: new Date(at).toISOString().slice(0, 10), cohortDay, cohortKind: kind
  });
  const events = [
    mk("a", "founder_first_login", day(10, 23)), mk("a", "session_started", day(10, 23)), mk("a", "session_started", day(11, 1)), // next UTC day, only 2h later
    mk("b", "founder_first_login", day(10, 8)), mk("b", "session_started", day(11, 9)),                                            // next day AND within 24-48h
    mk("c", "founder_first_login", day(10, 8)), mk("c", "session_started", day(12, 9)),                                            // day 3: neither
    mk("d", "founder_first_login", day(10, 8)), mk("d", "session_started", day(10, 20)),                                          // same-day only
    mk("e", "founder_first_login", day(10, 8), "2026-11-10", "legacy_v1")
  ];
  const rows = computeDay2Retention(events);
  const fresh = rows.find((r) => r.cohortKind === "new");
  assert.deepEqual({ ...fresh }, { cohortDay: "2026-11-10", cohortKind: "new", cohortSize: 4, returnedNextUtcDay: 2, returned24To48h: 1, reportable: false });
  assert.equal(rows.find((r) => r.cohortKind === "legacy_v1").cohortSize, 1);
  assert.equal(computeDay2Retention(events, { minCohortSize: 4 }).find((r) => r.cohortKind === "new").reportable, true);
});

test("goal ladder: 3-5 named goals, only Origin is derivable, business goals stay upcoming (never falsely complete)", () => {
  assert.ok(GOAL_DEFINITIONS.length >= 3 && GOAL_DEFINITIONS.length <= 5);
  const fresh = deriveGoals({ graduated: false, openRunQuestsCompleted: 0, questCount: 5 });
  assert.equal(fresh[0].status, "available");
  assert.deepEqual(deriveGoals({ graduated: false, openRunQuestsCompleted: 3, questCount: 5 })[0].progress, { current: 3, total: 5 });
  assert.equal(deriveGoals({ graduated: false, openRunQuestsCompleted: 3, questCount: 5 })[0].status, "in_progress");
  const done = deriveGoals({ graduated: true, openRunQuestsCompleted: 0, questCount: 5 });
  assert.equal(done[0].status, "completed");
  for (const g of done.slice(1)) {
    assert.equal(g.status, "upcoming");
    assert.match(g.nextAction, /^Unlocks in /);
    assert.equal(g.progress, null);
  }
  // a client cannot assert completion: only server-verified receipt kinds count, and none exist yet
  assert.equal(deriveGoals({ graduated: true, openRunQuestsCompleted: 0, questCount: 5, receipts: ["made_up"] })[1].status, "upcoming");
  assert.equal(deriveGoals({ graduated: true, openRunQuestsCompleted: 0, questCount: 5, receipts: ["company_opened"] })[1].status, "completed");
  for (const g of done) { assert.equal("reward" in g, false); assert.equal(JSON.stringify(g).includes("XP"), false); }
});

test("business templates: three inactive non-purchasable categories, economics unapproved, prices hidden by default", () => {
  assert.deepEqual(BUSINESS_TEMPLATES.map((t) => [t.businessTypeId, t.category]), [
    ["food-market-stall", "retail"], ["online-fashion-shop", "commerce"], ["barbershop", "services"]
  ]);
  for (const t of BUSINESS_TEMPLATES) {
    assert.equal(t.status, "inactive");
    assert.equal(t.purchasable, false);
    assert.equal(t.economics.status, "unapproved");
    assert.ok(Object.entries(t.economics).filter(([k]) => k !== "status").every(([, v]) => v === null), "approved economics stay null");
    assert.equal(t.illustrativeEconomics.approved, false);
  }
  const hidden = previewBusinessTemplates();
  assert.equal(JSON.stringify(hidden).includes("setupCostG"), false);
  assert.ok(hidden.every((p) => p.status === "upcoming" && p.purchasable === false));
  const shown = previewBusinessTemplates({ showIllustrativeEconomics: true });
  assert.equal(shown.find((p) => p.businessTypeId === "barbershop").pricing.setupCostG, 850);
  assert.match(shown[0].pricing.label, /Not final/);
  assert.equal(entryCapitalThresholdG(), null);
  assert.equal(entryCapitalThresholdG({ showIllustrativeEconomics: true }), 325);
  assert.throws(() => BUSINESS_TEMPLATES[0].status = "active", TypeError);
});

test("opening a business is impossible in Sprint 1", () => {
  assert.equal(approvedStarterOffer(), null, "draft prices cannot create a spendable opening offer");
});

test("capital classification: zero / insufficient / unclassified, never 'sufficient' on unapproved prices", () => {
  assert.equal(classifyCapital(0, null), "zero");
  assert.equal(classifyCapital(0, 325), "zero");
  assert.equal(classifyCapital(100, 325), "insufficient");
  assert.equal(classifyCapital(325, 325), "unclassified");
  assert.equal(classifyCapital(5000, null), "unclassified");
  assert.throws(() => classifyCapital(-1, null));
  assert.throws(() => classifyCapital(1.5, null));
});

test("reputation evidence is append-only, digest-stable, dimension-separated and path-free", () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  const payload = { originRunId: UUID, runNumber: 1, verifiedScoreG: 900, questScoresG: { a: 1 }, policyVersion: "origin-v1-draft" };
  const event = buildReputationEvent({ eventId: UUID, type: "origin_run_finalized", subjectRef: UUID, policyVersion: "origin-v1-draft", payload, occurredAt: 5, dedupeKey: "k" });
  assert.equal(event.dimension, "qualification_performance");
  assert.equal(event.evidenceDigest, evidenceDigest({ ...payload, questScoresG: { a: 1 } }));
  assert.match(event.evidenceDigest, /^[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(event.payload));
  assert.throws(() => buildReputationEvent({ eventId: UUID, type: "origin_run_finalized", subjectRef: UUID, policyVersion: "p", payload: { ...payload, path: ["a"] }, occurredAt: 5, dedupeKey: "k" }), /payload shape invalid/);
  assert.throws(() => buildReputationEvent({ eventId: UUID, type: "origin_run_finalized", dimension: "reliability", subjectRef: UUID, policyVersion: "p", payload, occurredAt: 5, dedupeKey: "k" }), /Only qualification evidence/);
  assert.throws(() => buildReputationEvent({ eventId: UUID, type: "correction", subjectRef: UUID, policyVersion: "p", payload: { reason: "x" }, occurredAt: 5, dedupeKey: "k" }), /not emittable yet/);
  assert.throws(() => buildReputationEvent({ eventId: UUID, type: "made_up", subjectRef: UUID, policyVersion: "p", payload, occurredAt: 5, dedupeKey: "k" }), /Unknown reputation event type/);
});

test("GwapScore-compatible attestation needs affirmative consent and is non-deliverable until linking is approved", () => {
  assert.equal(EXTERNAL_LINKING_APPROVED, false);
  const e = (n, score, extra = {}) => ({ eventId: String(n), type: "origin_run_finalized", evidenceDigest: "d".repeat(64), policyVersion: "origin-v1-draft", payload: { verifiedScoreG: score }, occurredAt: n, ...extra });
  const events = [e(1, 400), e(2, 900), { eventId: "r", type: "revocation", correctsEventId: "2", payload: {}, occurredAt: 3 }];
  for (const consent of [undefined, null, {}, { granted: false, scope: ["origin_summary"] }, { granted: true, scope: [] }, { granted: "yes", scope: ["origin_summary"] }]) {
    assert.deepEqual({ ...buildAttestationPreview(events, consent) }, { allowed: false, reason: "consent_required" });
  }
  const preview = buildAttestationPreview(events, { granted: true, scope: ["origin_summary"] });
  assert.equal(preview.allowed, true);
  assert.equal(preview.deliverable, false);
  assert.equal(preview.bestVerifiedScoreG, 400, "a revoked event no longer counts");
  assert.equal(JSON.stringify(preview).includes("path"), false);
  assert.equal(JSON.stringify(preview).includes("telegram"), false);
});

test("founder visibility is private by default and exposes only alias, milestone and activity bucket", () => {
  const now = Date.UTC(2026, 10, 19);
  const founder = { alias: "Ada Lovelace", graduated: true, lastSeenAt: now - 3600_000 };
  assert.equal(DEFAULT_VISIBILITY.mode, "private");
  assert.equal(projectPublicFounderCard(founder, now), null);
  assert.equal(projectPublicFounderCard({ ...founder, visibility: { mode: "listed", optedInAt: null } }, now), null);
  assert.equal(projectPublicFounderCard({ ...founder, visibility: { mode: "private", optedInAt: 1 } }, now), null);
  const card = projectPublicFounderCard({ ...founder, visibility: { mode: "listed", optedInAt: 1 }, telegramUserId: "99", balanceG: 5000, founderId: FOUNDER }, now);
  assert.deepEqual({ ...card }, { alias: "Ada Lovelace", milestone: "origin_graduate", activity: "active_today" });
  assert.deepEqual(Object.keys(card).sort(), [...PUBLIC_CARD_FIELDS].sort());
  assert.equal(isValidAlias("123456789"), false);
  assert.equal(isValidAlias("Founder 1234567"), false, "alias must not carry id-like digit runs");
  assert.equal(projectPublicFounderCard({ ...founder, alias: "12345678", visibility: { mode: "listed", optedInAt: 1 } }, now), null);
});

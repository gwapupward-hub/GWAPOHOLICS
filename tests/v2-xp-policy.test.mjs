import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuthoritativeXpEvent as grant, createXpState, isValidXpState,
  isGraduatedXpState, levelFromXp, xpThreshold, V1_QUEST_IDS
} from "../server/v2-xp-policy.mjs";
import { evaluateV2AccessFromXpState } from "../server/v2-exchange-policy.mjs";

const NOW = Date.UTC(2026, 10, 18, 15);
const apply = (state, kind, extra = {}, now = NOW) => grant(state, { kind, ...extra }, now);
function graduate() {
  let state = createXpState();
  for (const questId of V1_QUEST_IDS) {
    state = apply(state, "v1_quest_first_completion", { questId }).state;
  }
  return apply(state, "v1_graduation").state;
}
const account = {
  telegramSessionVerified: true,
  graduatedV1: true,
  level: 999, // must be ignored by derived-state access helper
  accountAgeDays: 40, distinctActiveDays: 20,
  fraudHold: false, accountRestricted: false,
  paymentDisputeOpen: false, rateLimited: false
};
const flags = {
  businessEnabled: true, starsCosmeticsEnabled: true,
  marketplacePreviewEnabled: true, exchangeWaitlistEnabled: true,
  starsPaymentIntegrationApproved: true
};

test("new players start with 0 XP at level 1", () => {
  const state = createXpState();
  assert.equal(state.xp, 0);
  assert.equal(levelFromXp(0), 1);
  assert.equal(isValidXpState(state), true);
  assert.equal(isGraduatedXpState(state), false);
});
test("five unique quests and graduation give precisely 775 XP and unlock level 5", () => {
  const state = graduate();
  assert.equal(state.xp, 775);
  assert.equal(levelFromXp(state.xp), 5);
  assert.equal(xpThreshold(5), 700);
  assert.equal(isGraduatedXpState(state), true);
});
test("graduation cannot be obtained before all five quests", () => {
  const result = apply(createXpState(), "v1_graduation");
  assert.equal(result.reason, "complete_five_quests_first");
  assert.equal(result.awarded, 0);
});
test("replays, higher best capital and spending G never create XP", () => {
  const state = graduate();
  for (const kind of ["v1_replay_completed", "v1_personal_best_improved", "g_earned",
    "g_spent", "stars_purchased", "peer_trade", "tap_reward", "passive_income"]) {
    const r = apply(state, kind);
    assert.equal(r.awarded, 0, kind);
    assert.equal(r.reason, "event_not_rewardable");
    assert.equal(r.state, state);
  }
  assert.equal(apply(state, "v1_quest_first_completion", { questId: V1_QUEST_IDS[0] }).reason,
    "already_awarded");
  assert.equal(apply(state, "v1_graduation").reason, "already_awarded");
});
test("duplicate quest IDs or client-invented quest names cannot mint XP", () => {
  const state = createXpState();
  assert.equal(apply(state, "v1_quest_first_completion", { questId: "not-a-quest" }).reason, "invalid_quest");
  const first = apply(state, "v1_quest_first_completion", { questId: V1_QUEST_IDS[0] });
  assert.equal(apply(first.state, "v1_quest_first_completion", { questId: V1_QUEST_IDS[0] }).awarded, 0);
});
test("v2 first-time milestones are single awards and require graduation", () => {
  const state = createXpState();
  assert.equal(apply(state, "v2_first_business_opened").reason, "graduation_required");
  const initial = graduate();
  const a = apply(initial, "v2_first_business_opened");
  assert.equal(a.awarded, 200);
  assert.equal(apply(a.state, "v2_first_business_opened").reason, "already_awarded");
  const b = apply(a.state, "v2_first_contract_fulfilled");
  assert.equal(b.awarded, 160);
  const c = apply(b.state, "v2_first_positive_cashflow_cycle");
  assert.equal(c.awarded, 100);
  assert.equal(isValidXpState(c.state), true);
});
test("daily learning pays at most once per UTC day, even with new client IDs", () => {
  const state = graduate();
  const a = apply(state, "daily_learning_completed", { sourceId: "one" });
  assert.equal(a.awarded, 40);
  const b = apply(a.state, "daily_learning_completed", { sourceId: "another" });
  assert.equal(b.reason, "already_awarded");
  const c = apply(a.state, "daily_learning_completed", {}, NOW + 86400000);
  assert.equal(c.awarded, 40);
  assert.equal(c.state.xp, 855);
});
test("weekly review pays once per ISO UTC week including year boundaries", () => {
  const state = graduate();
  const first = apply(state, "weekly_financial_review", {}, Date.UTC(2026, 11, 31));
  const second = apply(first.state, "weekly_financial_review", {}, Date.UTC(2027, 0, 1));
  assert.equal(first.awarded, 120);
  assert.equal(second.awarded, 0);
  assert.equal(second.reason, "already_awarded");
  const third = apply(first.state, "weekly_financial_review", {}, Date.UTC(2027, 0, 4));
  assert.equal(third.awarded, 120);
});
test("malformed XP totals, duplicate receipts and unrecognized award types fail validation", () => {
  const state = graduate();
  assert.equal(isValidXpState({ ...state, xp: 999999 }), false);
  assert.equal(isValidXpState({ ...state, awards: [...state.awards, state.awards[0]] }), false);
  assert.equal(isValidXpState({ ...state, awards: [...state.awards, { key: "fake", kind: "fake", xp: 1, atMs: NOW }], xp: state.xp + 1 }), false);
  assert.throws(() => grant({ ...state, xp: 4000 }, { kind: "daily_learning_completed" }, NOW));
});
test("invalid XP/time and level thresholds are rejected", () => {
  assert.throws(() => levelFromXp(-1), RangeError);
  assert.throws(() => levelFromXp(1.5), RangeError);
  assert.throws(() => xpThreshold(0), RangeError);
  assert.throws(() => apply(createXpState(), "v1_graduation", {}, -1));
  for (let level = 1; level <= 30; level++) {
    assert.equal(levelFromXp(xpThreshold(level)), level);
    if (level > 1) assert.equal(levelFromXp(xpThreshold(level) - 1), level - 1);
  }
});
test("derived access ignores spoofed level and graduation and requires genuine XP ledger", () => {
  const empty = createXpState();
  assert.equal(evaluateV2AccessFromXpState("v2_business", account, empty, flags).reason,
    "v1_graduation_required");
  const tampered = { ...graduate(), xp: 100000 };
  assert.equal(evaluateV2AccessFromXpState("v2_business", account, tampered, flags).reason,
    "xp_state_invalid");
  const state = graduate();
  assert.equal(evaluateV2AccessFromXpState("v2_business", account, state, flags).allowed, true);
  assert.equal(evaluateV2AccessFromXpState("stars_cosmetic_purchase", account, state, flags).reason,
    "level_required");
  assert.equal(evaluateV2AccessFromXpState("g_to_stars", account, state, flags).reason,
    "value_exchange_disabled");
});
test("age, fraud and rate flags still gate access after level verification", () => {
  const state = graduate();
  assert.equal(evaluateV2AccessFromXpState("v2_business", { ...account, fraudHold: true }, state, flags).reason,
    "account_restricted");
  assert.equal(evaluateV2AccessFromXpState("v2_business", { ...account, telegramSessionVerified: false }, state, flags).reason,
    "session_not_verified");
  assert.equal(evaluateV2AccessFromXpState("v2_business", { ...account, rateLimited: true }, state, flags).reason,
    "rate_limited");
});

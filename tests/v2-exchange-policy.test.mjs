import test from "node:test";
import assert from "node:assert/strict";
import { evaluateV2Access, PERMANENTLY_BLOCKED_ACTIONS, V2_ACCESS_LEVELS } from "../server/v2-exchange-policy.mjs";

const qualified = Object.freeze({
  telegramSessionVerified: true, graduatedV1: true, level: 30,
  accountAgeDays: 45, distinctActiveDays: 20, fraudHold: false,
  accountRestricted: false, paymentDisputeOpen: false, rateLimited: false
});
const flags = Object.freeze({
  businessEnabled: true, starsCosmeticsEnabled: true,
  marketplacePreviewEnabled: true, exchangeWaitlistEnabled: true,
  starsPaymentIntegrationApproved: true
});
test("all real-value G and peer trade routes are hard-denied even at maximum level and with flags on", () => {
  for (const action of PERMANENTLY_BLOCKED_ACTIONS) {
    assert.deepEqual(evaluateV2Access(action, { ...qualified, level: 999 }, flags),
      { allowed: false, reason: "value_exchange_disabled" }, action);
  }
});
test("unknown actions fail closed", () => {
  assert.equal(evaluateV2Access("peer_market_order", qualified, flags).reason, "unknown_action");
});
test("unauthenticated, restricted and pre-graduation accounts are denied", () => {
  assert.equal(evaluateV2Access("v2_business", { ...qualified, telegramSessionVerified: false }, flags).reason, "session_not_verified");
  assert.equal(evaluateV2Access("v2_business", { ...qualified, fraudHold: true }, flags).reason, "account_restricted");
  assert.equal(evaluateV2Access("v2_business", { ...qualified, paymentDisputeOpen: true }, flags).reason, "account_restricted");
  assert.equal(evaluateV2Access("v2_business", { ...qualified, graduatedV1: false }, flags).reason, "v1_graduation_required");
});
test("level requirements cannot be bypassed", () => {
  for (const [action, level] of [
    ["v2_business", V2_ACCESS_LEVELS.business],
    ["stars_cosmetic_purchase", V2_ACCESS_LEVELS.starsCosmetics],
    ["marketplace_preview", V2_ACCESS_LEVELS.marketplacePreview],
    ["exchange_waitlist", V2_ACCESS_LEVELS.exchangeWaitlist]
  ]) {
    assert.equal(evaluateV2Access(action, { ...qualified, level: level - 1 }, flags).reason, "level_required");
    assert.equal(evaluateV2Access(action, { ...qualified, level }, flags).allowed, true);
  }
});
test("all feature flags default off", () => {
  for (const action of ["v2_business", "stars_cosmetic_purchase", "marketplace_preview", "exchange_waitlist"]) {
    assert.equal(evaluateV2Access(action, qualified).reason, "feature_disabled");
  }
});
test("premium items need approved Stars integration, account history and active days", () => {
  assert.equal(evaluateV2Access("stars_cosmetic_purchase", qualified,
    { ...flags, starsPaymentIntegrationApproved: false }).reason, "payment_integration_not_approved");
  assert.equal(evaluateV2Access("stars_cosmetic_purchase", { ...qualified, accountAgeDays: 6 }, flags).reason, "account_age_required");
  assert.equal(evaluateV2Access("stars_cosmetic_purchase", { ...qualified, distinctActiveDays: 2 }, flags).reason, "activity_history_required");
});
test("marketplace preview has higher history requirements; no payment authority", () => {
  assert.equal(evaluateV2Access("marketplace_preview", { ...qualified, accountAgeDays: 13 }, flags).reason, "account_age_required");
  assert.equal(evaluateV2Access("marketplace_preview", { ...qualified, distinctActiveDays: 4 }, flags).reason, "activity_history_required");
  assert.equal(evaluateV2Access("marketplace_preview", qualified, flags).allowed, true);
  assert.equal(evaluateV2Access("peer_g_for_gram", qualified, flags).allowed, false);
});
test("invalid, missing and fractional levels fail closed", () => {
  for (const level of [undefined, null, -1, 29.5, Infinity, "30"]) {
    assert.equal(evaluateV2Access("v2_business", { ...qualified, level }, flags).reason, "level_required");
  }
});
test("rate-limited accounts cannot transact or enter preview", () => {
  assert.equal(evaluateV2Access("stars_cosmetic_purchase", { ...qualified, rateLimited: true }, flags).reason, "rate_limited");
  assert.equal(evaluateV2Access("marketplace_preview", { ...qualified, rateLimited: true }, flags).reason, "rate_limited");
});

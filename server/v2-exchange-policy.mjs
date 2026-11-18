/**
 * GWAPOHOLICS v2 access policy (design-phase, unused by production).
 *
 * IMPORTANT: Calling this function does NOT perform a purchase or transfer.
 * All context must come from authenticated, server-verified records, never
 * the Telegram Mini App/client payload.
 *
 * Real-value G conversion and P2P G sales are intentionally hard-disabled.
 */
export const V2_ACCESS_LEVELS = Object.freeze({
  business: 5,
  starsCosmetics: 10,
  marketplacePreview: 20,
  exchangeWaitlist: 30
});

export const PERMANENTLY_BLOCKED_ACTIONS = Object.freeze([
  "g_to_stars",
  "stars_to_g",
  "g_to_gram",
  "gram_to_g",
  "peer_g_for_stars",
  "peer_g_for_gram",
  "peer_g_transfer",
  "g_cashout",
  "g_token_withdrawal"
]);
const blocked = new Set(PERMANENTLY_BLOCKED_ACTIONS);

const policies = Object.freeze({
  v2_business: { level: V2_ACCESS_LEVELS.business, flag: "businessEnabled", age: 0, activeDays: 0 },
  stars_cosmetic_purchase: { level: V2_ACCESS_LEVELS.starsCosmetics, flag: "starsCosmeticsEnabled", age: 7, activeDays: 3 },
  marketplace_preview: { level: V2_ACCESS_LEVELS.marketplacePreview, flag: "marketplacePreviewEnabled", age: 14, activeDays: 5 },
  exchange_waitlist: { level: V2_ACCESS_LEVELS.exchangeWaitlist, flag: "exchangeWaitlistEnabled", age: 30, activeDays: 10 }
});

function deny(reason) { return Object.freeze({ allowed: false, reason }); }

/**
 * Evaluates a non-financial access request.
 * Only stars_cosmetic_purchase is a potential *digital goods purchase* gate;
 * actual checkout must separately use Telegram XTR, successful_payment
 * verification, refunds and anti-fraud review. Default flags deny all actions.
 */
export function evaluateV2Access(action, player, serverFlags = {}) {
  if (blocked.has(action)) return deny("value_exchange_disabled");
  if (!Object.hasOwn(policies, action)) return deny("unknown_action");
  const p = policies[action];
  if (player?.telegramSessionVerified !== true) return deny("session_not_verified");
  if (player?.fraudHold === true || player?.accountRestricted === true ||
      player?.paymentDisputeOpen === true) return deny("account_restricted");
  if (player?.graduatedV1 !== true) return deny("v1_graduation_required");
  if (!Number.isSafeInteger(player?.level) || player.level < p.level) return deny("level_required");
  if (serverFlags[p.flag] !== true) return deny("feature_disabled");
  if (!Number.isSafeInteger(player?.accountAgeDays) ||
      player.accountAgeDays < p.age) return deny("account_age_required");
  if (!Number.isSafeInteger(player?.distinctActiveDays) ||
      player.distinctActiveDays < p.activeDays) return deny("activity_history_required");
  if (player?.rateLimited === true) return deny("rate_limited");
  if (action === "stars_cosmetic_purchase" &&
      serverFlags.starsPaymentIntegrationApproved !== true) return deny("payment_integration_not_approved");
  return Object.freeze({ allowed: true, reason: "eligible" });
}

import { getOriginPolicy, isPolicyApproved } from "./origin-policy.mjs";

/**
 * Server-side v2 configuration. Everything defaults to OFF/unavailable.
 *
 *   GWAP_V2_FOUNDER_HUB=1                       enable /api/v2/founder (else 404)
 *   GWAP_V2_ORIGIN_POLICY=<version>             policy used for Origin scoring
 *   GWAP_V2_ALLOW_UNAPPROVED_POLICY=isolated-preview-only
 *                                               explicit acknowledgement required to
 *                                               run a draft policy; never honoured when
 *                                               VERCEL_ENV=production
 *   GWAP_V2_ANALYTICS_KEY=<>=32 bytes>          HMAC key for pseudonymous analytics
 *                                               keys; telemetry is skipped without it
 *   GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS=isolated-preview-only
 *                                               show unapproved illustrative business
 *                                               prices in previews (default: hidden)
 */
import { approvedStarterOffer } from "./business-templates.mjs";

const ACK = "isolated-preview-only";

export function loadV2Config(env = process.env) {
  const production = env.VERCEL_ENV === "production";
  const founderHubEnabled = env.GWAP_V2_FOUNDER_HUB === "1";
  const requested = typeof env.GWAP_V2_ORIGIN_POLICY === "string" ? env.GWAP_V2_ORIGIN_POLICY.trim() : "";
  const acknowledged = env.GWAP_V2_ALLOW_UNAPPROVED_POLICY === ACK && !production;

  let policy = null;
  let policyUnavailableReason = "policy_not_configured";
  if (requested) {
    const found = getOriginPolicy(requested);
    if (!found) policyUnavailableReason = "policy_unknown";
    else if (!isPolicyApproved(found) && !acknowledged) policyUnavailableReason = "policy_unapproved";
    else { policy = found; policyUnavailableReason = null; }
  }

  const key = env.GWAP_V2_ANALYTICS_KEY;
  const analyticsKey = typeof key === "string" && Buffer.byteLength(key, "utf8") >= 32 ? key : null;

  return Object.freeze({
    founderHubEnabled,
    businessSchemaEnabled: env.GWAP_V2_FIRST_BUSINESS_SCHEMA === "1",
    starterOffer: env.GWAP_V2_FIRST_BUSINESS_SCHEMA === "1" && !production ? approvedStarterOffer() : null,
    policy,
    policyUnavailableReason,
    analyticsKey,
    showIllustrativeEconomics: env.GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS === ACK && !production,
    production
  });
}

import { deepFreeze } from "./versions.mjs";

/**
 * Versioned, server-authoritative Origin scoring policy.
 *
 * Every numeric setting here is CONFIGURATION. The only registered policy,
 * `origin-v1-draft`, copies the numbers proposed in draft PR #47
 * (docs/V2_ZERO_TO_EMPIRE_ECONOMY.md). They are NOT approved: the policy is
 * marked `unapproved`, and server/v2/config.mjs refuses to activate an
 * unapproved policy outside an explicitly acknowledged, non-production,
 * isolated Preview. To approve a policy, a reviewed commit must add a new
 * versioned entry (or flip `approval.status`) citing the founder decision.
 *
 * The raw bounds are the minimum/maximum four-decision chain results from
 * cases.mjs across BOTH evidence regimes (shifted and unshifted). They are
 * re-derived from the live engine in tests/v2-origin-policy.test.mjs.
 */
export const ORIGIN_POLICIES = deepFreeze({
  "origin-v1-draft": {
    version: "origin-v1-draft",
    approval: {
      status: "unapproved",
      reference: null,
      note: "Numbers proposed in draft PR #47; awaiting founder balancing and approval."
    },
    questIds: ["streaming-pivot", "brand-backlash", "supply-shock", "founder-runway", "inflation-trap"],
    perQuestMaxG: 500,
    lifetimeCapG: 2500,
    rawBounds: {
      "streaming-pivot": { min: -430, max: 580 },
      "brand-backlash": { min: -400, max: 550 },
      "supply-shock": { min: -910, max: 700 },
      "founder-runway": { min: -890, max: 730 },
      "inflation-trap": { min: -960, max: 640 }
    }
  }
});

export function getOriginPolicy(version) {
  return Object.hasOwn(ORIGIN_POLICIES, version) ? ORIGIN_POLICIES[version] : null;
}

export function isPolicyApproved(policy) {
  return policy?.approval?.status === "approved";
}

function requireQuest(policy, caseId) {
  const bounds = Object.hasOwn(policy.rawBounds, caseId) ? policy.rawBounds[caseId] : null;
  if (!bounds || !policy.questIds.includes(caseId)) throw new Error("Quest is not part of this Origin policy");
  return bounds;
}

/**
 * Score one completed quest, 0..perQuestMaxG, from its raw simulated result.
 * Integer arithmetic only (round half up), so scoring is exactly reproducible.
 */
export function scoreQuest(policy, caseId, rawDelta) {
  if (!Number.isInteger(rawDelta)) throw new Error("Quest result must be an integer");
  const { min, max } = requireQuest(policy, caseId);
  const span = max - min;
  const clamped = Math.min(max, Math.max(min, rawDelta));
  return Math.floor((2 * policy.perQuestMaxG * (clamped - min) + span) / (2 * span));
}

export function maxRunScoreG(policy) {
  return Math.min(policy.lifetimeCapG, policy.perQuestMaxG * policy.questIds.length);
}

/** Sum of the five per-quest scores. A partial run has no score. */
export function scoreRun(policy, questScores) {
  const ids = Object.keys(questScores ?? {});
  if (ids.length !== policy.questIds.length || !policy.questIds.every((id) => Object.hasOwn(questScores, id))) {
    throw new Error("A verified Origin Score needs all five quests");
  }
  let total = 0;
  for (const id of policy.questIds) {
    const value = questScores[id];
    if (!Number.isInteger(value) || value < 0 || value > policy.perQuestMaxG) throw new Error("Invalid quest score");
    total += value;
  }
  return total;
}

/**
 * credit = max(0, min(S, cap) - B); best_after = max(B, min(S, cap)).
 * Equal or lower scores credit nothing and never reduce the stored best.
 */
export function computeCredit(policy, { verifiedScoreG, previousBestG }) {
  if (!Number.isInteger(verifiedScoreG) || verifiedScoreG < 0) throw new Error("Invalid verified score");
  if (!Number.isInteger(previousBestG) || previousBestG < 0) throw new Error("Invalid previous best");
  const eligible = Math.min(verifiedScoreG, policy.lifetimeCapG);
  const creditDeltaG = Math.max(0, eligible - previousBestG);
  return Object.freeze({
    eligibleScoreG: eligible,
    creditDeltaG,
    bestAfterG: previousBestG + creditDeltaG,
    outcome: creditDeltaG > 0 ? "credited" : "no_improvement"
  });
}

/** Coarse, privacy-safe band for telemetry: q1 (lowest) .. q5 (highest). */
export function scoreBand(policy, scoreG) {
  const max = maxRunScoreG(policy);
  if (!Number.isInteger(scoreG) || scoreG < 0 || max <= 0) throw new Error("Invalid score");
  return "q" + (Math.min(4, Math.floor((Math.min(scoreG, max) * 5) / max)) + 1);
}

export function questScoreBand(policy, scoreG) {
  if (!Number.isInteger(scoreG) || scoreG < 0) throw new Error("Invalid score");
  return "q" + (Math.min(4, Math.floor((Math.min(scoreG, policy.perQuestMaxG) * 5) / policy.perQuestMaxG)) + 1);
}

/** What the client may know about the active policy (never the raw bounds). */
export function describePolicy(policy) {
  return Object.freeze({
    version: policy.version,
    approvalStatus: policy.approval.status,
    perQuestMaxG: policy.perQuestMaxG,
    maxScoreG: maxRunScoreG(policy),
    questCount: policy.questIds.length
  });
}

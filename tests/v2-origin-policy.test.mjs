import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../cases.mjs";
import { isShifted } from "../game-core.mjs";
import {
  ORIGIN_POLICIES, computeCredit, describePolicy, getOriginPolicy, isPolicyApproved, maxRunScoreG,
  questScoreBand, scoreBand, scoreQuest, scoreRun
} from "../server/v2/origin-policy.mjs";
import { loadV2Config } from "../server/v2/config.mjs";
import { allPaths } from "./support/origin-play.mjs";

const policy = ORIGIN_POLICIES["origin-v1-draft"];

test("frozen raw bounds equal the real engine's min/max across BOTH evidence regimes (all 81 paths x 2)", () => {
  for (const quest of CASES) {
    let shifted = null, unshifted = null;
    for (let seed = 0; seed < 5000 && (shifted === null || unshifted === null); seed += 1) {
      if (isShifted(quest, seed)) shifted ??= seed; else unshifted ??= seed;
    }
    assert.notEqual(shifted, null, quest.id);
    assert.notEqual(unshifted, null, quest.id);
    const deltas = [shifted, unshifted].flatMap((seed) => allPaths(quest.id, seed).map((x) => x.delta));
    assert.equal(deltas.length, 162);
    assert.deepEqual(policy.rawBounds[quest.id], { min: Math.min(...deltas), max: Math.max(...deltas) }, quest.id);
  }
});

test("policy pins exactly the five approved quests and is deeply frozen and unapproved", () => {
  assert.deepEqual(policy.questIds, CASES.map((c) => c.id));
  assert.equal(isPolicyApproved(policy), false);
  assert.throws(() => { policy.perQuestMaxG = 1; }, TypeError);
  assert.throws(() => { policy.rawBounds["streaming-pivot"].min = 0; }, TypeError);
  assert.equal(getOriginPolicy("nope"), null);
  assert.equal(getOriginPolicy("__proto__"), null);
});

test("quest scoring hits the exact 0 and max endpoints, is monotonic and clamps out-of-range values", () => {
  for (const id of policy.questIds) {
    const { min, max } = policy.rawBounds[id];
    assert.equal(scoreQuest(policy, id, min), 0, id);
    assert.equal(scoreQuest(policy, id, max), policy.perQuestMaxG, id);
    assert.equal(scoreQuest(policy, id, min - 5000), 0);
    assert.equal(scoreQuest(policy, id, max + 5000), policy.perQuestMaxG);
    let previous = -1;
    for (let raw = min; raw <= max; raw += 10) {
      const score = scoreQuest(policy, id, raw);
      assert.ok(score >= previous && Number.isInteger(score));
      previous = score;
    }
  }
  assert.equal(scoreQuest(policy, "streaming-pivot", 75), 250); // golden: midpoint of -430..580 rounds half up
  assert.throws(() => scoreQuest(policy, "streaming-pivot", 1.5));
  assert.throws(() => scoreQuest(policy, "not-a-quest", 0), /not part of this Origin policy/);
  assert.throws(() => scoreQuest(policy, "__proto__", 0));
});

test("verified run score needs all five quests and is their sum (0..2500)", () => {
  const all = Object.fromEntries(policy.questIds.map((id) => [id, 500]));
  assert.equal(scoreRun(policy, all), 2500);
  assert.equal(maxRunScoreG(policy), 2500);
  assert.equal(scoreRun(policy, Object.fromEntries(policy.questIds.map((id) => [id, 0]))), 0);
  const four = { ...all }; delete four["inflation-trap"];
  assert.throws(() => scoreRun(policy, four), /all five quests/);
  assert.throws(() => scoreRun(policy, { ...all, extra: 1 }), /all five quests/);
  assert.throws(() => scoreRun(policy, { ...all, "inflation-trap": 501 }), /Invalid quest score/);
  assert.throws(() => scoreRun(policy, { ...all, "inflation-trap": -1 }), /Invalid quest score/);
});

test("credit = max(0, min(S, cap) - B): the roadmap replay sequence pays exactly once per improvement", () => {
  let best = 0, total = 0;
  const credits = [];
  for (const score of [650, 400, 1100, 950, 1600]) {
    const c = computeCredit(policy, { verifiedScoreG: score, previousBestG: best });
    credits.push(c.creditDeltaG);
    best = c.bestAfterG; total += c.creditDeltaG;
    assert.equal(c.outcome, c.creditDeltaG > 0 ? "credited" : "no_improvement");
  }
  assert.deepEqual(credits, [650, 0, 450, 0, 500]);
  assert.equal(total, 1600);
  assert.equal(best, 1600); // lifetime grants equal the personal best, never the sum of replays
});

test("equal and lower scores award nothing and never reduce the best; the lifetime cap binds", () => {
  assert.equal(computeCredit(policy, { verifiedScoreG: 900, previousBestG: 900 }).creditDeltaG, 0);
  assert.equal(computeCredit(policy, { verifiedScoreG: 100, previousBestG: 900 }).bestAfterG, 900);
  assert.deepEqual(
    { ...computeCredit(policy, { verifiedScoreG: 9999, previousBestG: 2400 }) },
    { eligibleScoreG: 2500, creditDeltaG: 100, bestAfterG: 2500, outcome: "credited" });
  assert.equal(computeCredit(policy, { verifiedScoreG: 9999, previousBestG: 2500 }).creditDeltaG, 0);
  // A lowered cap in a future policy can never claw back an earlier best.
  assert.equal(computeCredit({ ...policy, lifetimeCapG: 1000 }, { verifiedScoreG: 2000, previousBestG: 1500 }).bestAfterG, 1500);
  assert.throws(() => computeCredit(policy, { verifiedScoreG: -1, previousBestG: 0 }));
  assert.throws(() => computeCredit(policy, { verifiedScoreG: 5, previousBestG: 1.5 }));
});

test("score bands are coarse (q1..q5) and the client policy description hides raw bounds", () => {
  assert.equal(scoreBand(policy, 0), "q1");
  assert.equal(scoreBand(policy, 2500), "q5");
  assert.equal(scoreBand(policy, 1250), "q3");
  assert.equal(questScoreBand(policy, 500), "q5");
  const described = describePolicy(policy);
  assert.deepEqual(described, { version: "origin-v1-draft", approvalStatus: "unapproved", perQuestMaxG: 500, maxScoreG: 2500, questCount: 5 });
  assert.equal(JSON.stringify(described).includes("rawBounds"), false);
});

test("everything defaults OFF: no hub, no policy, no analytics, no illustrative prices", () => {
  const config = loadV2Config({});
  assert.equal(config.founderHubEnabled, false);
  assert.equal(config.policy, null);
  assert.equal(config.policyUnavailableReason, "policy_not_configured");
  assert.equal(config.analyticsKey, null);
  assert.equal(config.showIllustrativeEconomics, false);
  assert.equal(loadV2Config({ GWAP_V2_FOUNDER_HUB: "true" }).founderHubEnabled, false); // only the literal "1"
});

test("an unapproved draft policy cannot go live without an explicit isolated-preview acknowledgement", () => {
  const base = { GWAP_V2_FOUNDER_HUB: "1", GWAP_V2_ORIGIN_POLICY: "origin-v1-draft" };
  assert.equal(loadV2Config(base).policy, null);
  assert.equal(loadV2Config(base).policyUnavailableReason, "policy_unapproved");
  assert.equal(loadV2Config({ ...base, GWAP_V2_ALLOW_UNAPPROVED_POLICY: "yes" }).policy, null);
  assert.equal(loadV2Config({ ...base, GWAP_V2_ALLOW_UNAPPROVED_POLICY: "isolated-preview-only" }).policy?.version, "origin-v1-draft");
  // ...and never in production, even with the acknowledgement.
  const prod = loadV2Config({ ...base, GWAP_V2_ALLOW_UNAPPROVED_POLICY: "isolated-preview-only", VERCEL_ENV: "production" });
  assert.equal(prod.policy, null);
  assert.equal(prod.policyUnavailableReason, "policy_unapproved");
  assert.equal(loadV2Config({ ...base, GWAP_V2_ORIGIN_POLICY: "made-up" }).policyUnavailableReason, "policy_unknown");
});

test("analytics key must be >= 32 bytes; illustrative prices are never shown in production", () => {
  assert.equal(loadV2Config({ GWAP_V2_ANALYTICS_KEY: "short" }).analyticsKey, null);
  assert.equal(loadV2Config({ GWAP_V2_ANALYTICS_KEY: "k".repeat(32) }).analyticsKey, "k".repeat(32));
  assert.equal(loadV2Config({ GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS: "isolated-preview-only" }).showIllustrativeEconomics, true);
  assert.equal(loadV2Config({ GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS: "isolated-preview-only", VERCEL_ENV: "production" }).showIllustrativeEconomics, false);
});

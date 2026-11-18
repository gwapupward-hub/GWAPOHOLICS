import test from "node:test";
import assert from "node:assert/strict";
import { CASES } from "../cases.mjs";
import { dailyChallengeFor, dailyResult } from "../daily-challenge.mjs";

test("Daily Challenge selects one stable case per date", () => {
  const morning = dailyChallengeFor(Date.UTC(2026, 1, 12, 8));
  const evening = dailyChallengeFor(Date.UTC(2026, 1, 12, 20));
  const nextDay = dailyChallengeFor(Date.UTC(2026, 1, 13, 8));
  assert.equal(morning.challengeId, evening.challengeId);
  assert.ok(CASES.some((entry) => entry.id === morning.caseData.id));
  assert.notEqual(morning.challengeId, nextDay.challengeId);
});

test("Daily Challenge scoring is bounded and does not need the player economy", () => {
  const challenge = dailyChallengeFor(Date.UTC(2026, 1, 12));
  const path = challenge.caseData.stages.map((stage) => stage.options[0].id);
  const result = dailyResult(challenge, path);
  assert.ok(result.score >= 0 && result.score <= 1000);
  assert.equal(result.challengeId, challenge.challengeId);
  assert.equal(result.steps.length, 4);
});

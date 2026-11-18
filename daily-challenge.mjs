import { CASES } from "./cases.mjs";
import { chainResult, stageView } from "./game-core.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_ANCHOR = Date.UTC(2024, 0, 1);

function asTime(value) {
  const time = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(time)) throw new Error("A valid date is required.");
  return time;
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailyChallengeFor(value = Date.now()) {
  const time = asTime(value);
  const date = new Date(time);
  const dateKey = date.toISOString().slice(0, 10);
  const day = Math.floor((time - CYCLE_ANCHOR) / DAY_MS);
  const entry = CASES[((day % CASES.length) + CASES.length) % CASES.length];
  return {
    dateKey,
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
    caseId: entry.id,
    caseData: entry,
    seed: hashText(`daily:${dateKey}`),
    challengeId: `daily:${dateKey}:${entry.id}`
  };
}

export function dailyStage(challenge, path) {
  return stageView(challenge.caseData, path, challenge.seed);
}

export function dailyResult(challenge, path) {
  const result = chainResult(challenge.caseData, path, challenge.seed);
  return {
    ...result,
    score: Math.max(0, Math.min(1000, 500 + result.delta)),
    challengeId: challenge.challengeId
  };
}

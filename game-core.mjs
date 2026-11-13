import { CASES, DIMENSIONS, RECOVERY_QUESTIONS } from "./cases.mjs";

export const STARTING_COINS = 1000;
export const MIN_PLAY_BALANCE = 100;
export const RECOVERY_REWARD = 60;
export const RECOVERY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const STORAGE_KEY = "gwap.telegram.business-sim.demo.v1";
export const SCHEMA_VERSION = 2;

// A new save gets a random 32-bit seed from the platform's crypto API. Saves live
// on this device, so the seed is not tamper-proof and must not back a shared economy.
export function randomSeed() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0];
}

export function createGame(now = Date.now(), seed = randomSeed()) {
  return {
    schema: SCHEMA_VERSION,
    seed,
    createdAt: now,
    balance: STARTING_COINS,
    played: [],
    draft: null,
    ledger: [{ id: `welcome-${now}`, type: "welcome", label: "Founder's starting capital", amount: STARTING_COINS, balanceAfter: STARTING_COINS, at: now }],
    profile: Object.fromEntries(DIMENSIONS.map(({ key }) => [key, 0])),
    lastRecoveryAt: null
  };
}

export function isLocked(state) {
  return state.balance < MIN_PLAY_BALANCE;
}

export function playableCases(state) {
  if (isLocked(state)) return [];
  return CASES.filter((entry) => !state.played.some((run) => run.caseId === entry.id));
}

function findCase(caseId) {
  return CASES.find((entry) => entry.id === caseId);
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// The evidence value this player sees for a scenario. Deterministic for a given seed.
export function driverValue(caseData, seed) {
  const { min, max } = caseData.driver;
  return min + (hashText(`${seed}:${caseData.id}`) % (max - min + 1));
}

export function isShifted(caseData, seed) {
  if (!caseData.driver) return false;
  const value = driverValue(caseData, seed);
  const { shiftWhen, threshold } = caseData.driver;
  return shiftWhen === "below" ? value < threshold : value >= threshold;
}

// Returns the option with its shifted outcome applied when this player's evidence crosses the threshold.
export function resolveChoice(caseData, choice, seed) {
  return choice.shifted && isShifted(caseData, seed) ? { ...choice, ...choice.shifted } : choice;
}

export function evidenceFor(caseData, seed) {
  if (!caseData.driver) return caseData.evidence;
  const { evidenceIndex, suffix } = caseData.driver;
  return caseData.evidence.map((item, index) => index === evidenceIndex
    ? { ...item, value: `${driverValue(caseData, seed)}${suffix}` }
    : item);
}

// Tags that the decisions before this stage have established in the chain.
function tagsBefore(caseData, path, index) {
  const tags = new Set();
  for (let i = 0; i < index; i += 1) {
    const earlier = caseData.stages[i].options.find((entry) => entry.id === path[i]);
    for (const tag of earlier.tags) tags.add(tag);
  }
  return tags;
}

// One option at a stage, with its shift applied and every link to an earlier decision that matches.
export function optionAt(caseData, index, optionId, path, seed) {
  const option = caseData.stages[index].options.find((entry) => entry.id === optionId);
  const shifted = resolveChoice(caseData, option, seed);
  const tags = tagsBefore(caseData, path, index);
  const matched = (shifted.links || []).filter((link) => tags.has(link.tag));
  const linkTotal = matched.reduce((sum, link) => sum + link.amount, 0);
  return {
    ...shifted,
    delta: shifted.delta + linkTotal,
    reasons: matched.map(({ amount, note }) => ({ amount, note }))
  };
}

// Options at one stage, given the decisions made before it.
export function stageChoices(caseData, index, seed, path = []) {
  return caseData.stages[index].options.map((option) => optionAt(caseData, index, option.id, path, seed));
}

// Options are shown in a per-stage shuffled order, so the same slot never signals
// the same kind of option across stages or cases. Stable across reloads.
export function displayOrder(caseData, index, options) {
  return [...options].sort((a, b) =>
    hashText(`${caseData.id}:${index}:${a.id}`) - hashText(`${caseData.id}:${index}:${b.id}`));
}

// The resolved option for each decision made so far, in order.
export function resolvedPath(caseData, path, seed) {
  return path.map((optionId, index) => optionAt(caseData, index, optionId, path, seed));
}

// What the player sees at the next decision. Links and hidden payoffs are never sent to the view.
export function stageView(caseData, path, seed) {
  const index = path.length;
  if (index >= caseData.stages.length) throw new Error("This chain is already complete.");
  const steps = resolvedPath(caseData, path, seed);
  const stage = caseData.stages[index];
  return {
    index,
    total: caseData.stages.length,
    opening: index > 0 ? steps[index - 1].outcome : null,
    setup: stage.setup ?? null,
    prompt: stage.prompt,
    choices: displayOrder(caseData, index, stageChoices(caseData, index, seed, path))
      .map(({ id, label, detail, risk }) => ({ id, label, detail, risk }))
  };
}

export function verdictBand(delta) {
  if (delta >= 400) return "strong";
  if (delta >= 100) return "steady";
  if (delta >= -150) return "rough";
  return "collapse";
}

export function chainResult(caseData, path, seed) {
  const steps = resolvedPath(caseData, path, seed);
  const delta = steps.reduce((sum, step) => sum + step.delta, 0);
  const band = verdictBand(delta);
  return {
    delta,
    band,
    verdict: caseData.verdicts[band],
    narrative: steps.map((step) => step.outcome),
    steps: steps.map((step, index) => ({
      prompt: caseData.stages[index].prompt,
      label: step.label,
      delta: step.delta,
      reasons: step.reasons,
      outcome: step.outcome
    }))
  };
}

const clampProfile = (value) => Math.max(-10, Math.min(10, value));

// Opens a chain. Only one chain can be open at a time, and a chain with a committed
// decision cannot be abandoned, so coins cannot be farmed by trying paths and keeping the best.
export function startCase(state, caseId) {
  if (isLocked(state)) throw new Error("Your balance is below the minimum. Complete recovery first.");
  const caseData = findCase(caseId);
  if (!caseData) throw new Error("Unknown scenario.");
  if (state.played.some((run) => run.caseId === caseId)) throw new Error("Scenario already completed. Replays can't mint coins.");
  if (state.draft?.caseId === caseId) return state;
  if (state.draft && state.draft.path.length > 0) throw new Error("Finish your current chain first.");
  return { ...state, draft: { caseId, path: [] } };
}

export function chooseStep(state, caseId, choiceId) {
  const caseData = findCase(caseId);
  const draft = state.draft;
  if (!caseData || !draft || draft.caseId !== caseId) throw new Error("Start this scenario first.");
  const index = draft.path.length;
  if (index >= caseData.stages.length) throw new Error("This chain is already complete.");
  if (!caseData.stages[index].options.some((option) => option.id === choiceId)) throw new Error("Unknown decision.");
  return { ...state, draft: { ...draft, path: [...draft.path, choiceId] } };
}

// Coins change only here, once all decisions are made.
export function completeChain(state, caseId, now = Date.now()) {
  const caseData = findCase(caseId);
  const draft = state.draft;
  if (!caseData || !draft || draft.caseId !== caseId) throw new Error("Start this scenario first.");
  if (draft.path.length !== caseData.stages.length) throw new Error("Make every decision before completing the chain.");
  if (state.played.some((run) => run.caseId === caseId)) throw new Error("Scenario already completed. Replays can't mint coins.");

  const steps = resolvedPath(caseData, draft.path, state.seed);
  const result = chainResult(caseData, draft.path, state.seed);
  const nextBalance = Math.max(0, state.balance + result.delta);
  const appliedDelta = nextBalance - state.balance;
  const run = { caseId, path: draft.path, delta: appliedDelta, balanceAfter: nextBalance, band: result.band, at: now };
  return {
    ...state,
    balance: nextBalance,
    played: [...state.played, run],
    draft: null,
    ledger: [...state.ledger, {
      id: `case-${caseId}-${now}`,
      type: "case",
      label: caseData.title,
      amount: appliedDelta,
      balanceAfter: nextBalance,
      at: now
    }],
    profile: Object.fromEntries(DIMENSIONS.map(({ key }) => [key, clampProfile((state.profile[key] || 0) + steps.reduce((sum, step) => sum + (step.profile[key] || 0), 0))]))
  };
}

export function recoveryAvailable(state, now = Date.now()) {
  if (!isLocked(state)) return false;
  return state.lastRecoveryAt === null || now - state.lastRecoveryAt >= RECOVERY_COOLDOWN_MS;
}

export function completeRecovery(state, answers, now = Date.now()) {
  if (!recoveryAvailable(state, now)) throw new Error("Recovery is unavailable during the cooldown.");
  if (!Array.isArray(answers) || answers.length !== RECOVERY_QUESTIONS.length ||
      !answers.every((answer, index) => answer === RECOVERY_QUESTIONS[index].correct)) {
    throw new Error("Review the lessons and answer both questions correctly.");
  }
  const newBalance = state.balance + RECOVERY_REWARD;
  return {
    ...state,
    balance: newBalance,
    lastRecoveryAt: now,
    ledger: [...state.ledger, {
      id: `recovery-${now}`,
      type: "recovery",
      label: "Learning recovery • nonwithdrawable",
      amount: RECOVERY_REWARD,
      balanceAfter: newBalance,
      at: now
    }]
  };
}

export function getDecisionStyle(state) {
  if (!state.played.length) return { title: "Unwritten story", subtitle: "Your first business decision starts your profile.", traits: [] };
  const top = DIMENSIONS.map((dimension) => ({ ...dimension, score: state.profile[dimension.key] || 0 }))
    .filter((dimension) => dimension.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return {
    title: top[0]?.key === "riskAppetite" ? "Bold mover" : top[0]?.key === "timeHorizon" ? "Long-game builder" : top[0]?.key === "concentration" ? "Risk balancer" : top[0]?.key === "decisionStyle" ? "Evidence hunter" : "Emerging strategist",
    subtitle: "A description of your simulated choices, not a measure of real-life ability.",
    traits: top
  };
}

function validPath(caseData, path, complete) {
  if (!Array.isArray(path) || path.length > caseData.stages.length) return false;
  if (complete && path.length !== caseData.stages.length) return false;
  return path.every((choiceId, index) => caseData.stages[index].options.some((option) => option.id === choiceId));
}

export function isValidGame(state) {
  if (!state || state.schema !== SCHEMA_VERSION || !Number.isSafeInteger(state.seed)) return false;
  if (!Number.isInteger(state.balance) || state.balance < 0 || !Array.isArray(state.played) || !Array.isArray(state.ledger) || !state.profile) return false;
  if (state.played.length > CASES.length) return false;
  const playedIds = state.played.map((run) => run?.caseId);
  if (new Set(playedIds).size !== playedIds.length) return false;
  const playedValid = state.played.every((run) => {
    const caseData = findCase(run?.caseId);
    return Boolean(caseData) && validPath(caseData, run.path, true) && Number.isInteger(run.delta) && Number.isInteger(run.balanceAfter);
  });
  if (!playedValid) return false;
  if (state.draft !== null) {
    const caseData = findCase(state.draft?.caseId);
    if (!caseData || playedIds.includes(caseData.id) || !validPath(caseData, state.draft.path, false)) return false;
    if (state.draft.path.length >= caseData.stages.length) return false;
  }
  return DIMENSIONS.every(({ key }) => Number.isInteger(state.profile[key]) && Math.abs(state.profile[key]) <= 10);
}

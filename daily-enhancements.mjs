const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_ANCHOR = Date.UTC(2024, 0, 1);

export const MINI_GAMES = [
  { id: "flash-pitch", title: "FLASH PITCH", label: "Pick the promise that earns trust fastest.", prompt: "What is the one sentence you lead with?", choices: [{ id: "focus", label: "A focused promise", detail: "Ship one valuable result before adding scope.", points: 100 }, { id: "hype", label: "A giant vision", detail: "Make the future sound impossible to ignore.", points: 35 }, { id: "discount", label: "A cheaper price", detail: "Remove friction before explaining the value.", points: 55 }], answer: "focus" },
  { id: "risk-radar", title: "RISK RADAR", label: "Find the risk closest to the cash register.", prompt: "Which signal deserves the first review?", choices: [{ id: "headline", label: "A competitor headline", detail: "Interesting, but not yet a customer behavior.", points: 20 }, { id: "margin", label: "A shrinking margin", detail: "A small leak can become a runway problem.", points: 100 }, { id: "likes", label: "A spike in likes", detail: "Attention is not the same as demand.", points: 35 }], answer: "margin" },
  { id: "negotiation-duel", title: "NEGOTIATION DUEL", label: "Keep optionality without giving away the farm.", prompt: "How do you answer the new supplier?", choices: [{ id: "hardball", label: "Take it or leave it", detail: "Protect price, even if the relationship breaks.", points: 30 }, { id: "flex", label: "Trade flexibility for proof", detail: "Offer volume only after a smaller test works.", points: 100 }, { id: "yield", label: "Accept every term", detail: "Move quickly and hope the upside arrives.", points: 45 }], answer: "flex" },
  { id: "signal-noise", title: "SIGNAL OR NOISE", label: "Separate a headline from a decision metric.", prompt: "Which number proves customers are getting value?", choices: [{ id: "mentions", label: "Press mentions", detail: "Reach can be useful, but it is indirect.", points: 35 }, { id: "retention", label: "Repeat usage", detail: "Behavior after the first try is the stronger signal.", points: 100 }, { id: "followers", label: "Follower count", detail: "A broad audience may never convert.", points: 20 }], answer: "retention" },
  { id: "runway-countdown", title: "RUNWAY COUNTDOWN", label: "Spend attention like it is scarce capital.", prompt: "What gets protected first?", choices: [{ id: "proof", label: "The customer proof loop", detail: "Keep learning what earns the next purchase.", points: 100 }, { id: "perks", label: "Team perks", detail: "Morale matters, but timing matters too.", points: 50 }, { id: "polish", label: "A perfect rebrand", detail: "Polish can wait for a clearer signal.", points: 25 }], answer: "proof" },
  { id: "boardroom-poll", title: "BOARDROOM POLL", label: "Choose the stakeholder that needs clarity now.", prompt: "Who gets the next honest update?", choices: [{ id: "investors", label: "Investors", detail: "Explain the numbers and the next test.", points: 65 }, { id: "customers", label: "Customers", detail: "Protect the people who decide whether value is real.", points: 100 }, { id: "competitors", label: "Competitors", detail: "Their reaction is not your operating plan.", points: 20 }], answer: "customers" },
  { id: "market-memory", title: "MARKET MEMORY", label: "Hold the important signal in your head.", prompt: "Which detail should survive the noise?", choices: [{ id: "constraint", label: "The binding constraint", detail: "The bottleneck determines the next useful move.", points: 100 }, { id: "rumor", label: "The loudest rumor", detail: "Volume does not make a signal true.", points: 25 }, { id: "vanity", label: "The prettiest chart", detail: "A clean chart can still hide a weak metric.", points: 30 }], answer: "constraint" },
  { id: "crisis-triage", title: "CRISIS TRIAGE", label: "You cannot solve every fire at once.", prompt: "What gets attention first?", choices: [{ id: "churn", label: "A customer about to leave", detail: "A real decision is already in motion.", points: 100 }, { id: "launch", label: "A launch headline", detail: "Visibility is not the immediate constraint.", points: 30 }, { id: "office", label: "An office upgrade", detail: "Comfort can wait for stability.", points: 15 }], answer: "churn" }
];

export const MODIFIERS = [
  { id: "cash-tight", label: "CASH IS TIGHT", description: "Short-term survival matters more than decorative upside.", multiplier: 0.92 },
  { id: "trust-fragile", label: "TRUST IS FRAGILE", description: "Customer-facing choices carry extra weight today.", multiplier: 1.04 },
  { id: "second-order", label: "THINK TWO MOVES AHEAD", description: "Delayed-payoff choices receive a small score lift.", multiplier: 1.02 },
  { id: "no-regrets", label: "NO REGRETS RUN", description: "The run is scored once; make the cleanest call you can.", multiplier: 1 },
  { id: "signal-hunt", label: "SIGNAL HUNT", description: "Evidence quality matters more than dramatic headlines.", multiplier: 1.03 }
];

export const ACHIEVEMENTS = [
  { id: "first-call", title: "FIRST CALL", description: "Complete your first Daily Challenge." },
  { id: "boardroom-ready", title: "BOARDROOM READY", description: "Score 800 or higher on a Daily Challenge." },
  { id: "bonus-hunter", title: "BONUS HUNTER", description: "Earn the full 100-point bonus from a mini-game." },
  { id: "score-chaser", title: "SCORE CHASER", description: "Beat your previous score for the same daily case." },
  { id: "three-day-operator", title: "THREE-DAY OPERATOR", description: "Complete three consecutive Daily Challenges." },
  { id: "week-one", title: "WEEK ONE", description: "Complete seven Daily Challenges." },
  { id: "signal-reader", title: "SIGNAL READER", description: "Answer a signal-focused mini-game correctly." },
  { id: "modifier-master", title: "MODIFIER MASTER", description: "Complete a run under every daily modifier." },
  { id: "top-of-board", title: "TOP OF THE BOARD", description: "Finish first on the local leaderboard." },
  { id: "month-in-room", title: "MONTH IN THE ROOM", description: "Complete thirty Daily Challenges." }
];

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function asDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(time)) throw new Error("A valid date is required.");
  return new Date(time).toISOString().slice(0, 10);
}

export function enhancementsFor(value = Date.now()) {
  const dateKey = asDateKey(value);
  const day = Math.floor((Date.parse(`${dateKey}T00:00:00Z`) - CYCLE_ANCHOR) / DAY_MS);
  const miniGame = MINI_GAMES[((day % MINI_GAMES.length) + MINI_GAMES.length) % MINI_GAMES.length];
  const modifier = MODIFIERS[((hashText(`modifier:${dateKey}`) % MODIFIERS.length) + MODIFIERS.length) % MODIFIERS.length];
  return { dateKey, miniGame, modifier };
}

export function evaluateMiniGame(miniGame, choiceId) {
  const choice = miniGame.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error("Unknown mini-game choice.");
  return { choiceId, points: choice.points, correct: choice.id === miniGame.answer, maxPoints: 100 };
}

export function enhancedScore(baseScore, bonusPoints, modifier) {
  const bonus = Math.max(0, Math.min(100, Number(bonusPoints) || 0));
  return Math.max(0, Math.min(1000, Math.round((Number(baseScore) + bonus) * modifier.multiplier)));
}

function consecutiveDays(history) {
  const keys = [...new Set(history.map((entry) => entry.dateKey))].sort().reverse();
  let count = 0;
  for (let i = 0; i < keys.length; i += 1) {
    if (i === 0 || Date.parse(`${keys[i - 1]}T00:00:00Z`) - Date.parse(`${keys[i]}T00:00:00Z`) === DAY_MS) count += 1;
    else break;
  }
  return count;
}

export function unlockAchievements(state = { unlocked: [], history: [] }, event) {
  const history = [...(state.history || []), { ...event }].slice(-100);
  const unlocked = new Set(state.unlocked || []);
  const priorSameDay = history.filter((entry) => entry.challengeId === event.challengeId).slice(0, -1).sort((a, b) => b.score - a.score)[0];
  const completedModifiers = new Set(history.map((entry) => entry.modifierId));
  const unlock = (id) => unlocked.add(id);
  if (history.length >= 1) unlock("first-call");
  if (event.score >= 800) unlock("boardroom-ready");
  if (event.bonusPoints >= 100) unlock("bonus-hunter");
  if (priorSameDay && event.score > priorSameDay.score) unlock("score-chaser");
  if (consecutiveDays(history) >= 3) unlock("three-day-operator");
  if (new Set(history.map((entry) => entry.dateKey)).size >= 7) unlock("week-one");
  if (event.miniGameCorrect) unlock("signal-reader");
  if (MODIFIERS.every((modifier) => completedModifiers.has(modifier.id))) unlock("modifier-master");
  if (event.rank === 1) unlock("top-of-board");
  if (new Set(history.map((entry) => entry.dateKey)).size >= 30) unlock("month-in-room");
  return { unlocked: [...unlocked], history };
}

// Opt-in transition API: existing callers and persisted state keep their shape.
export function evaluateAchievementUnlocks(state, event) {
  const previous = new Set(state?.unlocked || []);
  const nextState = unlockAchievements(state, event);
  return {
    state: nextState,
    newlyUnlocked: nextState.unlocked.filter((id) => !previous.has(id))
  };
}

export function allEnhancements() {
  return { miniGames: MINI_GAMES.map((item) => ({ ...item, choices: item.choices.map((choice) => ({ ...choice })) })), modifiers: MODIFIERS.map((item) => ({ ...item })), achievements: ACHIEVEMENTS.map((item) => ({ ...item })) };
}

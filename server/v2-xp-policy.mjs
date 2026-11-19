/**
 * GWAPOHOLICS v2: deterministic, server-authoritative XP policy.
 *
 * Design-phase pure module: no database or HTTP wiring, no payments.
 * Events MUST be emitted only after the server has independently verified a
 * canonical quest settlement, a graduation, or a real v2 milestone.
 *
 * An idempotency key derived here is NOT proof an event occurred. Persistence
 * must serialize XP grants per Telegram account and store an immutable,
 * unique (player, award_key) receipt in the same transaction as total XP.
 */
export const XP_POLICY_VERSION = 1;
export const XP_LEVEL_CAP = 30;
export const XP_TOTAL_HARD_CAP = 100000000;
export const V1_QUEST_IDS = Object.freeze([
  "streaming-pivot",
  "brand-backlash",
  "supply-shock",
  "founder-runway",
  "inflation-trap"
]);

const QUEST_IDS = new Set(V1_QUEST_IDS);
const QUEST_XP = 75;
const GRADUATION_XP = 400;
const MILESTONES = Object.freeze({
  v2_first_business_opened: 200,
  v2_first_contract_fulfilled: 160,
  v2_first_positive_cashflow_cycle: 100
});
const DAY_MS = 86400000;
const MAX_LEDGER_ENTRIES = 20000;

/**
 * Level 5 requires 700 XP. All five unique quest completions (375 XP)
 * plus the one-time v1 graduation (400 XP) yield 775 XP.
 * This prevents the v2 business unlock from depending on a payment or replay.
 */
export function xpThreshold(level) {
  if (!Number.isSafeInteger(level) || level < 1 || level > XP_LEVEL_CAP) {
    throw new RangeError("Invalid XP level");
  }
  const n = level - 1;
  return 25 * n * n + 75 * n;
}

export function levelFromXp(xp) {
  if (!Number.isSafeInteger(xp) || xp < 0 || xp > XP_TOTAL_HARD_CAP) {
    throw new RangeError("Invalid XP balance");
  }
  let low = 1;
  let high = XP_LEVEL_CAP;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (xp >= xpThreshold(middle)) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function createXpState() {
  return { version: XP_POLICY_VERSION, xp: 0, awards: [] };
}

function fail(reason, state) {
  return Object.freeze({
    awarded: 0,
    reason,
    level: levelFromXp(state.xp),
    state
  });
}

function isSafeAward(award) {
  return award && typeof award === "object" &&
    typeof award.key === "string" && award.key.length >= 1 &&
    typeof award.kind === "string" && award.kind.length >= 1 &&
    Number.isSafeInteger(award.xp) && award.xp > 0 &&
    Number.isSafeInteger(award.atMs) && award.atMs >= 0 &&
    award.atMs <= 8640000000000000;
}

/** Validates totals, uniqueness and known award keys (no client state trusted). */
export function isValidXpState(state) {
  if (!state || state.version !== XP_POLICY_VERSION ||
    !Number.isSafeInteger(state.xp) || state.xp < 0 ||
    state.xp > XP_TOTAL_HARD_CAP || !Array.isArray(state.awards) ||
    state.awards.length > MAX_LEDGER_ENTRIES) return false;
  const keys = new Set();
  let summed = 0;
  for (const award of state.awards) {
    if (!isSafeAward(award) || keys.has(award.key)) return false;
    keys.add(award.key);
    summed += award.xp;
    if (!Number.isSafeInteger(summed) || summed > XP_TOTAL_HARD_CAP) return false;
    const { key, kind, xp } = award;
    if (kind === "v1_quest_first_completion") {
      if (!key.startsWith("quest:") || !QUEST_IDS.has(key.slice(6)) || xp !== QUEST_XP) return false;
    } else if (kind === "v1_graduation") {
      if (key !== "v1:graduated" || xp !== GRADUATION_XP) return false;
    } else if (Object.hasOwn(MILESTONES, kind)) {
      if (key !== "milestone:" + kind || xp !== MILESTONES[kind]) return false;
    } else if (kind === "daily_learning_completed") {
      if (!/^daily:\d{4}-\d{2}-\d{2}$/.test(key) || xp !== 40) return false;
      if (new Date(award.atMs).toISOString().slice(0, 10) !== key.slice(6)) return false;
    } else if (kind === "weekly_financial_review") {
      if (!/^weekly:\d{4}-W\d{2}$/.test(key) || xp !== 120) return false;
      if ("weekly:" + isoWeek(award.atMs) !== key) return false;
    } else return false;
  }
  return summed === state.xp;
}

export function isGraduatedXpState(state) {
  return isValidXpState(state) &&
    V1_QUEST_IDS.every(id => state.awards.some(a => a.key === "quest:" + id)) &&
    state.awards.some(a => a.key === "v1:graduated");
}

function isoWeek(ms) {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil((((d.getTime() - yearStart) / DAY_MS) + 1) / 7);
  return String(year) + "-W" + String(week).padStart(2, "0");
}

/**
 * Pure award decision. The caller must supply server-originated event.kind and
 * confirmed evidence; never expose this directly as a player-request command.
 * nowMs MUST be the server timestamp, not the client timestamp.
 */
export function applyAuthoritativeXpEvent(state, event, nowMs) {
  if (!isValidXpState(state)) throw new Error("Invalid authoritative XP state");
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8640000000000000) {
    throw new Error("Invalid server time");
  }
  if (!event || typeof event !== "object") return fail("invalid_event", state);
  const kind = event.kind;
  let key;
  let amount;
  if (kind === "v1_quest_first_completion") {
    if (!QUEST_IDS.has(event.questId)) return fail("invalid_quest", state);
    key = "quest:" + event.questId;
    amount = QUEST_XP;
  } else if (kind === "v1_graduation") {
    if (!V1_QUEST_IDS.every(id => state.awards.some(a => a.key === "quest:" + id))) {
      return fail("complete_five_quests_first", state);
    }
    key = "v1:graduated";
    amount = GRADUATION_XP;
  } else if (Object.hasOwn(MILESTONES, kind)) {
    if (!isGraduatedXpState(state)) return fail("graduation_required", state);
    key = "milestone:" + kind;
    amount = MILESTONES[kind];
  } else if (kind === "daily_learning_completed") {
    if (!isGraduatedXpState(state)) return fail("graduation_required", state);
    key = "daily:" + new Date(nowMs).toISOString().slice(0, 10);
    amount = 40;
  } else if (kind === "weekly_financial_review") {
    if (!isGraduatedXpState(state)) return fail("graduation_required", state);
    key = "weekly:" + isoWeek(nowMs);
    amount = 120;
  } else {
    // No XP for v1 reruns, v1 personal-best improvements, transactions,
    // purchases, gifts, passive income, taps, transfers or trading volume.
    return fail("event_not_rewardable", state);
  }
  if (state.awards.some(a => a.key === key)) return fail("already_awarded", state);
  if (state.awards.length >= MAX_LEDGER_ENTRIES || state.xp + amount > XP_TOTAL_HARD_CAP) {
    return fail("xp_capacity_reached", state);
  }
  const next = {
    version: XP_POLICY_VERSION,
    xp: state.xp + amount,
    awards: [...state.awards, { key, kind, xp: amount, atMs: nowMs }]
  };
  return Object.freeze({
    awarded: amount,
    reason: "awarded",
    level: levelFromXp(next.xp),
    state: next
  });
}

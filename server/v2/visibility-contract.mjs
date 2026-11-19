import { deepFreeze } from "./versions.mjs";

/**
 * Read-only founder visibility (interface contract only — no endpoint, no
 * storage, no directory in Sprint 1). Private by default; a founder appears
 * only after an explicit opt-in, and only these fields can ever leave the
 * server. No Telegram IDs, founder IDs, balances, wallet addresses, quest
 * histories or authentication data are representable here.
 */
export const VISIBILITY_MODES = Object.freeze(["private", "listed"]);
export const PUBLIC_CARD_FIELDS = Object.freeze(["alias", "milestone", "activity"]);
export const MILESTONES = deepFreeze(["origin_graduate"]);
export const ACTIVITY_BUCKETS = deepFreeze(["active_today", "active_this_week", "away"]);

export const DEFAULT_VISIBILITY = deepFreeze({ mode: "private", optedInAt: null });

export function isValidAlias(alias) {
  return typeof alias === "string" && /^[A-Za-z][A-Za-z0-9 _-]{2,19}$/.test(alias) && !/\d{6,}/.test(alias);
}

export function activityBucket(lastSeenAt, now) {
  const age = now - lastSeenAt;
  return age < 86_400_000 ? "active_today" : age < 7 * 86_400_000 ? "active_this_week" : "away";
}

/** Returns null for anyone who has not explicitly opted in. */
export function projectPublicFounderCard({ visibility = DEFAULT_VISIBILITY, alias, graduated, lastSeenAt }, now) {
  if (visibility?.mode !== "listed" || !visibility.optedInAt) return null;
  if (!isValidAlias(alias)) return null;
  return Object.freeze({
    alias,
    milestone: graduated ? "origin_graduate" : null,
    activity: activityBucket(lastSeenAt, now)
  });
}

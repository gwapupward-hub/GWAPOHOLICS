export const LEADERBOARD_LIMIT = 10;

export function upsertScore(entries, scoreEntry, limit = LEADERBOARD_LIMIT) {
  const sameRun = entries.find((entry) => entry.challengeId === scoreEntry.challengeId);
  const normalized = { ...scoreEntry, score: Math.max(0, Math.min(1000, Number(scoreEntry.score) || 0)) };
  const best = sameRun && sameRun.score >= normalized.score ? sameRun : normalized;
  const next = [...entries.filter((entry) => entry.challengeId !== scoreEntry.challengeId), best];
  return next
    .sort((a, b) => b.score - a.score || String(a.at).localeCompare(String(b.at)))
    .slice(0, Math.max(1, limit));
}

export function rankedForDate(entries, dateKey, limit = LEADERBOARD_LIMIT) {
  return entries
    .filter((entry) => entry.dateKey === dateKey)
    .sort((a, b) => b.score - a.score || String(a.at).localeCompare(String(b.at)))
    .slice(0, Math.max(1, limit))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

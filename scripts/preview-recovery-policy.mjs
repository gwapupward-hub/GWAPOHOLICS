/**
 * Read-only preview-recovery decision helper. It NEVER runs SQL or writes data.
 * Input is an abstract snapshot; do not log actual player IDs or raw game JSON.
 * A "candidate" still requires a separate founder approval and app replay QA.
 */
const candidate = 'HISTORICAL_BASELINE_CANDIDATE';
const review = 'MANUAL_RECONCILIATION_REQUIRED';

function verdict(status, reason) {
  return { status, reason, mayWritePreview: false, mayMergeReceipts: false };
}
function eventKey(e) {
  return JSON.stringify([e.eventType, e.caseId ?? null, e.amount, e.balanceAfter]);
}
export function assessPreviewRecovery(historical, current) {
  if (!historical || !current) {
    return verdict(review, 'missing_user_state');
  }
  const hq = historical.completedQuests, cq = current.completedQuests;
  const hl = historical.ledger, cl = current.ledger;
  if (![hq, cq, hl, cl].every(Array.isArray) ||
      !Number.isSafeInteger(historical.balance) ||
      !Number.isSafeInteger(current.balance)) {
    return verdict(review, 'incomplete_snapshot');
  }
  if (hq.length < cq.length || hl.length < cl.length) {
    return verdict(review, 'current_has_more_activity');
  }
  const historicalQuests = new Map();
  for (const q of hq) {
    if (!q.caseId || !q.choicesDigest || historicalQuests.has(q.caseId)) {
      return verdict(review, 'invalid_historical_quest_set');
    }
    historicalQuests.set(q.caseId, q.choicesDigest);
  }
  const seenCurrent = new Set();
  for (const q of cq) {
    if (!q.caseId || !q.choicesDigest || seenCurrent.has(q.caseId) ||
        !historicalQuests.has(q.caseId)) {
      return verdict(review, 'unique_or_duplicate_post_reset_quest');
    }
    seenCurrent.add(q.caseId);
    if (historicalQuests.get(q.caseId) !== q.choicesDigest) {
      return verdict(review, 'divergent_quest_choices');
    }
  }
  const historicalEvents = new Map();
  for (const event of hl) {
    const key = eventKey(event);
    historicalEvents.set(key, (historicalEvents.get(key) ?? 0) + 1);
  }
  for (const event of cl) {
    const key = eventKey(event), remaining = historicalEvents.get(key) ?? 0;
    if (!remaining) return verdict(review, 'new_or_divergent_ledger_event');
    historicalEvents.set(key, remaining - 1);
  }
  return verdict(candidate, 'current_gameplay_is_subset_of_historical_state');
}

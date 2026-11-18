import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPreviewRecovery } from '../scripts/preview-recovery-policy.mjs';

// All fixtures are fictional. Never commit Telegram IDs, receipts, or actual game states.
const welcome = { eventType: 'welcome', caseId: null, amount: 1000, balanceAfter: 1000 };
const opening = { eventType: 'quest_settlement', caseId: 'case-1', amount: 230, balanceAfter: 1230 };
const followup = { eventType: 'quest_settlement', caseId: 'case-2', amount: 480, balanceAfter: 1710 };

function baseline() {
  return {
    historical: {
      balance: 1710,
      completedQuests: [
        { caseId: 'case-1', choicesDigest: 'synthetic-a' },
        { caseId: 'case-2', choicesDigest: 'synthetic-b' }
      ],
      ledger: [welcome, opening, followup]
    },
    current: {
      balance: 1230,
      completedQuests: [{ caseId: 'case-1', choicesDigest: 'synthetic-a' }],
      ledger: [welcome, opening]
    }
  };
}

test('replayed overlapping activity permits only a historical baseline candidate, never a write', () => {
  const { historical, current } = baseline();
  const r = assessPreviewRecovery(historical, current);
  assert.equal(r.status, 'HISTORICAL_BASELINE_CANDIDATE');
  assert.equal(r.reason, 'current_gameplay_is_subset_of_historical_state');
  assert.equal(r.mayWritePreview, false);
  assert.equal(r.mayMergeReceipts, false);
});

test('different choices in the same quest require manual review', () => {
  const { historical, current } = baseline();
  current.completedQuests[0].choicesDigest = 'divergent';
  assert.equal(assessPreviewRecovery(historical, current).reason, 'divergent_quest_choices');
});

test('new post-reset quest requires manual review', () => {
  const { historical, current } = baseline();
  current.completedQuests.push({ caseId: 'case-new', choicesDigest: 'new' });
  assert.equal(assessPreviewRecovery(historical, current).status, 'MANUAL_RECONCILIATION_REQUIRED');
});

test('same quest but changed settlement requires manual review', () => {
  const { historical, current } = baseline();
  current.ledger[1] = { ...opening, amount: 300, balanceAfter: 1300 };
  assert.equal(assessPreviewRecovery(historical, current).reason, 'new_or_divergent_ledger_event');
});

test('missing user state and invalid snapshots never authorize Preview writes', () => {
  const { historical } = baseline();
  for (const badCurrent of [null, {}, { balance: 0, completedQuests: [], ledger: null }]) {
    const r = assessPreviewRecovery(historical, badCurrent);
    assert.equal(r.status, 'MANUAL_RECONCILIATION_REQUIRED');
    assert.equal(r.mayWritePreview, false);
  }
});

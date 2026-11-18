# Daily Challenge Expansion

- [x] Rotate all eight proposed mini-games deterministically across Daily Challenge dates.
- [x] Apply one deterministic daily modifier to the enhanced challenge score.
- [x] Persist completed bonus results without changing G coins or Season 01 progress.
- [x] Persist and display achievements from Daily Challenge behavior.
- [x] Show the enhanced score on the existing local leaderboard.
- [x] Validate deterministic selection, score bounds, achievements, syntax, regression tests, and live preview.
- [x] Keep cross-device leaderboard explicitly out of scope until server/database scoring validation is designed.

## Achievement unit tests

- [x] Cover achievement thresholds, replay idempotency, unique-date milestones, modifier coverage, and state immutability using the real unlock engine.
- [x] Expose newly unlocked IDs without breaking the existing saved-state/API shape, and test that previously unlocked badges are not re-announced.
- [x] Add a UI-independent notification queue with fake-clock tests for FIFO ordering, one-at-a-time display, duplicate/unknown IDs, dismissal, and timer cleanup.
- [x] Run the focused tests and existing checks; keep visual rarity styling, production deployment, databases, and G coins unchanged.

Verified: `npm run test:achievements` passes 36 tests; `npm test` passes all 155 tests; `npm run check` and `git diff --check` pass. The modifier-coverage regression also fixed unknown IDs counting toward Modifier Master. Notification toast presentation remains unwired, as documented in the README.

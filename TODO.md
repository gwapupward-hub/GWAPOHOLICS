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

Verified in the unit-test update: 36 focused tests and 155 full-suite tests passed. The modifier-coverage regression also fixed unknown IDs counting toward Modifier Master. Toast presentation was subsequently integrated below.

## Achievement toast UI and end-to-end test

- [x] On daily-run completion, persist new achievements, then show only newly unlocked badges in the existing FIFO notification queue without interrupting errors or other screens.
- [x] Present a dismissible, accessible, animated badge toast with rarity labels/colors, mobile safe-area support, and reduced-motion behavior; preserve the existing sound settings and G coin economy.
- [x] Exercise a real local Daily Challenge in Chromium and WebKit with Playwright: unlock, display, queue order, dismissal, persistence, navigation/reload, no duplicate notifications, and unchanged game balance.
- [x] Run unit tests, syntax checks, and the relevant browser tests without accessing live player data or deploying production.

Verified: `npm run test:e2e:daily` passes all 7 Playwright tests; the 5 existing mobile, full-season, and mocked authenticated browser tests also pass; `npm test` passes all 158 unit/regression tests; `npm run check` and `git diff --check` pass. Playwright covers muted audio state, normal and reduced motion, keyboard focus, pending badges after reload, storage failure and recovery, hidden pages, and Story Mode deferral.

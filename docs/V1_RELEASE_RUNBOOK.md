# GWAPOHOLICS v1 — Release-Readiness Runbook

**Status:** Fully implemented v1 private-beta candidate in Preview; NOT a public release. The official `@GwapoholicsBot`, the production domain, and `main` remain unchanged. Production promotion requires separate explicit founder approval.

## v1 release scope — frozen
- Five cinematic business quests, 45 illustrated scenes, full-screen narration, staged props, tap-to-complete typing and reduced-motion support.
- Telegram-native signed identity; session cookies with HttpOnly, Secure and SameSite=Strict.
- One thousand nontransferable virtual G coins at registration. Business decision rewards/losses, 100-coin lockout, cooldown-limited educational recovery and cross-device resume.
- Persistent Postgres player profile, completed quest runs, virtual ledger and idempotent command receipts.
- No Solana token, cash-out, wallet connection, DEX swapping or real-money rewards in v1.

## Gate 1 — GitHub protections: VERIFIED
Active ruleset [GWAPOHOLICS Main Protection](https://github.com/gwapupward-hub/GWAPOHOLICS/rules/27241887) targets the default branch. It blocks force pushes and deletion, requires PRs, and requires current `baseline`, `mobile-engines` and `postgres-ledger` checks. No bypass actors are configured. No positive reviewer count is required; keep separate founder release approval mandatory.

## Gate 2 — Isolated Preview database and authenticated server: VERIFIED
Dedicated Neon project `gwapoholics-v1-preview` (`square-mode-74279855`) and Vercel Preview branch `preview/feat/v1-private-beta-release-candidate` exist. The four public tables (`players`, `quest_runs`, `command_receipts`, `virtual_ledger`) have been migrated. Preview-only `TELEGRAM_BOT_TOKEN`, `GWAP_SESSION_SECRET` and Neon-provided database settings are configured for `feat/v1-private-beta-release-candidate`. Never paste tokens or URLs containing database credentials into Git or chat.

The test bot is `@TestGwap_bot`. Launch the Preview in Telegram **without** `?demo=1`. Browser demo is deliberately independent and cannot mutate authenticated balances.

The authenticated Streaming Pivot has been played end to end, resulting in 1,230 G (+230 exactly once, without duplicate settlements). This is one test result, not proof that every device or quest has been manually exercised.

### Server safeguards
- Verify raw Telegram `initData` HMAC and freshness on the server.
- Signed, one-hour, HttpOnly sessions; existing sessions can be honored during signing-key rotation with optional `GWAP_SESSION_SECRET_PREVIOUS` for at most their remaining one-hour lifetime.
- Same-origin and custom-header check on all mutations; no client-supplied balance, seed, result band or settlement value.
- Atomic Postgres per-player locks, database unique settlement index, and persisted idempotency receipts.
- **30 new game commands/player/rolling 60 seconds**, enforced in PostgreSQL across instances. Exact retries return their prior receipt without consuming a new command; over-limit commands return `429` with `Retry-After: 60`. This is an application command budget, **not a substitute for ingress IP rate limiting**.

### Automated verification
- `npm run check` and `npm test` for syntax, game logic, authentication, security and API responses.
- `mobile-engines` GitHub check for Chromium/WebKit responsive input.
- `postgres-ledger` GitHub check for actual disposable Postgres concurrency, idempotency, cross-instance restore, throttling and settlements across all five quests.
- `npm run db:check` is read-only and should run only from a trusted environment with the isolated Preview connection.

## Gate 3 — Real Telegram WebView acceptance: OPEN
On physical iPhone **and** Android phones, launch `@TestGwap_bot` into the authenticated Preview. Record device class and pass/fail, without copying Telegram `initData` or personal identifiers.

1. Complete all five missions, four decisions each. Confirm every intro, decision scene and ending band displays, including smaller screens.
2. Confirm typewriter tap-to-complete, staged prop order, fades, camera zoom and reduced-motion preference. Controls must remain visible above Telegram safe areas.
3. Force-stop/reopen Telegram and reload midway through each quest; confirm server resume and identical coin balance across two devices on the same Telegram account.
4. Retry an already-committed final decision, simulate a failed network response, and send simultaneous final commands: only one settlement.
5. Validate 100-coin lockout, cooldown-limited recovery, no free repeated mint, and poor-network errors.
6. Confirm secure signup/logout, session expiry and key-rotation behavior, no exposure of protected data, and no real-coin/withdrawal claims.

## Gate 4 — Operational security: PARTIAL; BACKUP BLOCKER
The app has secure cookies, Postgres idempotency and distributed per-player write throttling. **Ingress/IP throttling for `/api/session` still requires WAF or equivalent configuration** before public launch.

Neon snapshot APIs refused both scheduling on this project and snapshotting the non-root Preview branch. **No automatic Preview backup is verified.** Before inviting a cohort, use an explicitly approved, secured Postgres logical backup process, validate restoration in an isolated disposable database, define retention and test recovery. Keep backups and export files out of Git and public logs. Configure secret-rotation ownership, monitoring and incident response before release.

To rotate the session signing key: set the prior key as `GWAP_SESSION_SECRET_PREVIOUS` only on the correct deployment environment; set an independently generated new `GWAP_SESSION_SECRET`; redeploy; allow one hour for previous cookies to expire; then remove the previous key and redeploy. Rotate the Telegram bot token separately through BotFather and replace the matching Vercel Preview secret without exposing it.

## Gate 5 — Private beta: NOT STARTED
After Gates 3–4 pass, invite 10–15 consenting testers on iOS and Android. Collect minimal metrics (first-choice time, quest completion, interrupted sessions and return use). Record issues without raw Telegram credentials. Exit requires zero unresolved critical auth, duplicate-settlement, integrity, data-loss or accessibility defects.

## Gate 6 — Public release: NOT AUTHORIZED
Freeze a specific tested Git commit SHA. Verify all three required CI checks, staged production build and separate production database configuration. Obtain explicit founder approval before merging `main`, promoting a Vercel production deployment, changing `@GwapoholicsBot` or wiring `gwapoholics.ton`. Preview readiness alone does not authorize release.

## V2 parking lot
User-submitted ideas, multiplayer commerce, Solana token issuance and withdrawals stay outside this release and require separate security, tokenomics and legal review.

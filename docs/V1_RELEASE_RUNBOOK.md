# GWAPOHOLICS v1 — Release-Readiness Runbook

**Status:** Preview release candidate, NOT public v1. Do not merge to main, promote a production deployment, or reconfigure @GwapoholicsBot without the owner's separate release approval.

## Delivered in source
- 5 complete cinematic quests (45 distinct scene backgrounds) with layered props and typed character dialogue.
- Playable browser demo with simulated nontransferable G coins.
- Telegram HMAC validation, signed HttpOnly strict sessions, same-origin and CSRF safeguards.
- Server-authoritative missions and recovery; player-specific PostgreSQL transactions and idempotency.
- No client-submitted seed, balance, settlement band, or payoff accepted.
- Automated five-quest playthrough, phone-size Chromium/WebKit, and mocked authenticated Telegram flow.

## Gate 1 — GitHub owner action (still required)
Open https://github.com/gwapupward-hub/GWAPOHOLICS/settings/rules and create an enforced branch ruleset targeting `main`.

Configure:
- Require pull request before merge with review.
- Require passing **baseline** and **mobile-engines** CI checks before merge.
- Block force pushes and deletion.
- Limit bypass users.
- Verify the ruleset is actually active; a written policy in the repo is not sufficient.

The connected GitHub App does not expose administration permission to set this rule directly. Issue #6 tracks completion.

## Gate 2 — Vercel + isolated Neon (still required)
Open https://vercel.com/bigdaddygwaps-projects/gwap-telegram-business-sim and create a **new** GWAPOHOLICS Preview Postgres database through Storage / Marketplace → Neon. Do not select, clone, or overwrite any existing GWAP database.

Direct Neon API project creation is blocked by the Vercel-managed organization. The owner must provision the new database through Vercel's integration flow.

- Keep the database connected to **Preview only**, region US East if available.
- Review the project-provided `DATABASE_URL` credentials without copying them into Git or chat.
- Apply `server/sql/001_initial.sql` only to that empty database after review.
- Set **Preview-only** Vercel secrets `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, and `GWAP_SESSION_SECRET` (at least 32 unpredictable bytes). Never use `NEXT_PUBLIC_` or `VITE_` prefixes.
- Set session secret independently of the Telegram bot token.
- Verify network/TLS and row locks; run `npm run db:check` from a trusted environment with the Preview connection available.
- Add operational backup, rotation and restoration checks. Never paste a connection string or bot token into a GitHub issue.

Issue #9 tracks database provisioning and API activation.

## Gate 3 — Private test bot and device validation (still required)
Use a private Telegram test bot / test launch link connected to the Preview deployment; leave production @GwapoholicsBot unchanged.

On a real iPhone and Android Telegram WebView:
- Start the Mini App and verify user identity is confirmed by the server.
- Complete four decisions per quest for all five quests; verify all 4 result bands across controlled test accounts.
- Reload midmission, close/reopen Telegram, switch devices under one Telegram user, and confirm the same trusted balance.
- Repeat final choice concurrently, reload after failed network, replay completed quest, and verify exactly one settlement.
- Test 100 G lockout and cooldown-limited education recovery.
- Test reduced motion, typing skip, safe-area controls, poor cellular network, and image fallback.
- Record onboarding friction, performance and critical errors, without raw initData or personally identifying information.

## Gate 4 — Private beta (not started)
Proposed 10–15 volunteer testers after Gates 1–3 pass. Do not invite players against a browser-only or unprotected ledger.

Acceptance: no critical auth/data-loss/duplicate-settlement issue, no missing art, successful cross-device restore; collect basic completion and return rates. See issue #8.

## Gate 5 — Founder release approval (not granted)
Produce a specific immutable commit SHA, staged **production** deployment with domains unassigned, test it using production configuration, then request explicit approval to promote it. Bot settings and `gwapoholics.ton` changes require separate confirmation. Stage beta and public release separately.

The existing `vercel.json` prevents automatic `main` deployments after its rule becomes effective, but it is not a substitute for branch protection or explicit deployment approval.

## V2
Capture the founder's new ideas in an independent v2 backlog after v1 meets the gates. Do not introduce transferable or withdrawable tokens until token economy, compliance and security are separately approved.

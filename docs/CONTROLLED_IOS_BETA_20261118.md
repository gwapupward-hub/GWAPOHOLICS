# GWAPOHOLICS — iPhone controlled beta release gate
November 18, 2026 · **Prepared, CLOSED to invited players pending infrastructure and consent**

## Decision

Move forward with **restricted iOS testing** now, not public production. Founder explicitly allows Backblaze's nonempty offsite restore evidence to remain pending during controlled beta. Record this as an accepted *beta-only risk*, **not** a passing recovery check or public-launch waiver. Solana token, cash withdrawals, trades and real-value rewards remain disabled/planning-only. Physical Android QA deferred.

## Environment isolation (mandatory)

- **Git source:** `release/ios-restricted-beta-20261118`, based on latest `main`; every build must use a recorded immutable SHA and pass `baseline`, `mobile-engines`, `postgres-ledger`.
- **Vercel:** separate `gwapoholics-ios-beta` project; protected Preview deployment, **never** original `gwap-telegram-business-sim` or recovery `gwapoholics-tests`. No public domain/alias.
- **Postgres:** separate dedicated clean beta database, with the tested v1 schema, unique per-player settlement, strong TLS; **never** live Preview `br-billowing-sea-bcx8nhn7`, founder-tested recovery `br-polished-unit-bc02b798`, historical sources or rollback branches. This is essential: testers must not modify any historical player's balance.
- **Bot:** an owner-controlled **separate beta bot**, not `@GwapoholicsBot`, `@GwapRecovery_bot` or `@TestGwap_bot` until explicitly authorized to repoint. Privately add its token to beta Vercel only.
- **Existing Neon limitation:** current GWAPOHOLICS project is at its branch quota, and a direct new Neon project request returned `organization is managed by Vercel`. Do **not** delete preserved historical/rollback branches to free space. Owner can provision a **new dedicated beta Neon project through the authorized Vercel-managed Neon integration** or an independently connected Neon organization. Verify the exact project ID and endpoint before adding Vercel's database secret. No new project was created by this failed request.

## Server-enforced admission (already implemented on release branch)

This branch has **deny-by-default** server access on `POST /api/session` **and** `GET/POST /api/game`. It requires all of the following sensitive server-side Preview Vercel variables:

| Key | Scope | Notes |
| --- | --- | --- |
| `GWAP_BETA_MODE` | Preview | Exact value `restricted` (anything else disables admission) |
| `GWAP_BETA_ALLOWED_IDS` | Preview | Comma-separated **1–15** consenting Telegram numeric user IDs, strict positive int64, no duplicates. Keep secret, not in Git, logs or client. |
| `TELEGRAM_BOT_TOKEN` | Preview | Token for beta bot only, private |
| `GWAP_SESSION_SECRET` | Preview | New unique secret, ≥32 bytes, not reused from recovery or existing project |
| `DATABASE_URL` | Preview | Direct connection to **dedicated empty beta PostgreSQL** only, no shared data |

The server checks the Telegram **signature** before it checks allowlist membership, then issues a secure cookie only for invited users. Every subsequent game request checks the current allowlist again; an already authenticated removed player is denied before reading or writing gameplay state. Missing/malformed beta configuration returns `503 beta_not_configured` (no open fallback). Unauthorized authenticated users get `403 beta_invite_required`. This is application gating, **not** protection from infrastructure exposure or data loss. Vercel may require an access method for Telegram WebView; do not disable project-wide protection while secrets or inherited recovery data are attached. A Vercel share link is a bearer secret and must be controlled/revoked.

## Cohort and staged acceptance

Target **10–15 consenting iPhone testers** (start with founder-only account, then expand in batches), mix Telegram novices and frequent Telegram Mini App users. Do not post an unrestricted bot invite. Retain only internal tester aliases and explicit consent/age eligibility confirmation, not raw Telegram initData, cookies, phone numbers, wallet keys or exported player profiles.

Before any tester invitation:

- [ ] Separate Neon beta project/database created from clean schema; no historical data, no real-value token functionality.
- [ ] Protected Vercel beta project, verified correct Git SHA, and all five Preview-only secrets/config keys above; no inherited production URL.
- [ ] Separate beta bot registered and privately connected to exact protected beta URL, with correct signing token and genuine Telegram WebView session.
- [ ] Physical founder iPhone check: signed launch, initial **1,000 virtual G**, first choice, whole-screen cinematic, five quests × four decisions, close/reopen, idempotent retry/no second reward.
- [ ] QA on exact build: session expiry, command throttling, origin/CSRF, abusive requests, WAF/429 evidence, under-100 recovery path on **disposable** test accounts only.
- [ ] Owner approves beta disclosure copy and confirms actual support contact, **minimum-age eligibility policy**, privacy handling and consent mechanism. Draft legal disclosures are NOT published Terms/Privacy.
- [ ] Owner accepts lack of independently proven B2 restore as a documented **restricted-beta-only** risk; preserve all separate rollback/historical branches.
- [ ] Incident/contact owner and rollback/stop procedure are assigned; Vercel runtime logs inspected (no secrets), warning and error escalation verified.

### Minimum privacy-safe beta signals

Measure signed launch success, first choice completion, first quest completion, five quest completions, app errors, interrupted/resumed sessions and D1/D7 return **only in aggregate** or via separately approved, minimally intrusive event data. Do not add a third-party tracker or start storing extra identity data without privacy review. Proposed targets—not guaranteed performance—are ≥99% signed launches, ≥80% first choice, ≥60% first quest, and **zero unresolved critical auth/ledger/data-loss defects**.

### Kill switch and rollback

1. Set `GWAP_BETA_MODE` to `disabled` on the beta Vercel Preview environment and **redeploy**; both session and gameplay endpoints fail closed. Alternatively disable the beta project deployment or remove beta bot's Mini App URL. Revoking a Vercel share link does not revoke valid app sessions by itself.
2. Preserve dedicated beta DB and audit receipts before any reset or promotion. Do not overwrite founder-test historical datasets. Archive any incident facts without player PII.
3. Revert only the beta Vercel project to a previously verified beta SHA + correct beta DB binding; do not touch the official bot, original Preview or production alias.
4. Public production remains blocked by #34. A full B2 encrypted ciphertext-to-nonempty-restore gate (#30) is still required for unrestricted launch, along with legal/age/monitoring/security approvals.

## Founder decision gates

**Current status: PREPARED, NOT INVITED.** This release branch is a reviewable safety gate; it is not a public release. Beta invites require actual isolated infrastructure, tested application behavior, approved age/privacy disclosures and founder consent. Merging to `main` is separately controlled because `api/session.js` / `api/game.js` are deliberately fail-closed in this branch.

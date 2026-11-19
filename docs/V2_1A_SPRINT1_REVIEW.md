# v2.1-A Sprint 1 — read-only review and conflict register

**Scope:** Founder Entry foundation (Origin → persistent Founder Hub). Branch `claude/gwapoholics-v2-sprint-1-0kr1uk`, cut from `main` at `240c313`.
**Method:** read-only inspection of the repository and of draft PRs #47 and #50 through the GitHub API. Nothing in this review modified a database, the bot, or a deployment.

## 1. What was and was not inspected

| Area | Inspected? | Notes |
| --- | --- | --- |
| v1 engine (`game-core.mjs`, `cases.mjs`, story runtime/director/typewriter, `app.mjs`) | Yes, read in full or by section | |
| Telegram auth + session (`server/session.mjs`, `server/http.mjs`) | Yes | `server/telegram-auth.mjs` was **not modified**; it was reviewed only through its use in `handleSession`. |
| v1 service + store (`server/game-service.mjs`, `server/postgres-store.mjs`, `server/sql/001_initial.sql`) | Yes | |
| CI (`ci.yml`, `postgres-ledger.yml`, `browser-smoke.yml`) and existing tests | Yes | Baseline before changes: `npm run check` pass, `npm test` 108/108. |
| Backup tooling (`preview-backup.yml`, `scripts/verify-*`, `db-check`) | Table coverage only | See risk R5. |
| **Live Neon project / branches / data** | **No** | A read-only call to the Neon console API for the project in `AGENTS.md` returned **HTTP 401**. No Neon MCP tools or CLI session exist in this environment, so the `AGENTS.md` identity check was **not run**. The schema review is from the repository SQL, not from the live Preview branch. |
| Draft PR #47 and #50 | Yes | Full file lists and patches. |

## 2. Reusable components (reused unchanged)

- Story Mode: `story-runtime`, `story-director`, `typewriter`, `cinematic-view` (`storyStage`, panels, scene art, characters). Only an **optional** HUD label/caption was added (`balanceLabel`, `balanceCaption`); default output is unchanged and the existing view test passes.
- Quest content and pure rules: `CASES`, `chooseStep`, `stageView`, `chainResult`, `evidenceFor`. v1 balance gating (`startCase`/`isLocked`, 100 G lock) is **not** used.
- Auth: signed HttpOnly session cookie (`parseSessionCookie`) and the same-origin/CSRF helpers in `server/http.mjs` (now exported; no behaviour change).
- Transaction pattern: per-player advisory lock + idempotency receipts + durable 30/60 s write budget.
- Test patterns: fake-store service tests, real-Postgres integration, Playwright route mocks.

## 3. Conflicts and unapproved assumptions

### Draft PR #47 (Zero-to-Empire economy)

| # | Item | Status in this branch |
| --- | --- | --- |
| C1 | 2,500 G lifetime cap, 500 G per quest, scoring formula | **Not approved.** Implemented only as the draft policy `origin-v1-draft`, marked `unapproved`. `loadV2Config` refuses to activate it unless `GWAP_V2_ALLOW_UNAPPROVED_POLICY=isolated-preview-only` is set, and never when `VERCEL_ENV=production`. All numbers are configuration in one file. |
| C2 | Raw min/max table | Re-derived from the live engine (all 81 paths × both evidence regimes × 5 quests): **the table is correct as a union of regimes** (test `frozen raw bounds equal the real engine's min/max`). |
| C3 | "Fresh server-issued seed per replay" | Implemented (per-run seed, never sent to the client). See **O1** for the economic consequence. |
| C4 | XP policy (75/400/200/… XP, level curve), level gates, exchange policy | **Not implemented.** No XP, no levels, no goal rewards. Out of scope and unapproved. The Goal Ladder carries no G/XP. |
| C5 | Learning gig payouts (10–25 G), 100 G threshold for risk actions | Not implemented. Recovery is a visible `upcoming` placeholder; the 100 G v1 lock never touches Origin. |
| C6 | Proposed business price ladder | Not approved. Stored as `illustrativeEconomics` (hidden unless `GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS=isolated-preview-only`, non-production). Authoritative `economics` fields are all `null`. |
| C7 | Table names (`origin_runs`, `origin_qualification`, `v2_capital_ledger`, `v2_receipts`) | Same concepts, `v2_`-prefixed and split slightly differently (credit-only ledger + per-run settlement receipt + command receipts). Mapping is in `V2_1A_FOUNDER_ENTRY.md`. |
| C8 | File collisions | None. PR #47 adds `server/v2-*-policy.mjs` and `docs/V2_*.md`; this branch uses `server/v2/` and `docs/V2_1A_*.md`. |

### Draft PR #50 (Founder Entry / retention roadmap)

| # | Item | Status in this branch |
| --- | --- | --- |
| C9 | Read-only "Active Founders" directory in the Hub | **Interface contract only** (`visibility-contract.mjs`: private by default, opt-in, 3-field projection). No endpoint, storage or UI, per the Sprint 1 brief ("do not activate external sharing"). Needs a founder decision on timing. |
| C10 | Events `founder_directory_viewed`, `recovery_path_viewed`, `recovery_completed`, `business_type_previewed` | Not in the Sprint 1 event list; **not defined or emitted**. Listed for Sprint 2 (see handoff). |
| C11 | "`origin_capital_credit_committed` including zero-delta outcomes separately" | Interpreted as: the event is emitted for every settlement with `outcome = credited \| no_improvement`; the **ledger** only ever holds positive credits, zero-delta runs get a settlement receipt. Please confirm. |
| C12 | Sessions via "authenticated server session IDs and bounded inactivity" | Implemented as **inactivity only** (≥ 30 min gap). The signed cookie is re-issued on every Mini App launch, so a cookie ID would count refreshes as sessions. No session ID is stored. Please confirm. |
| C13 | `first_company_opened`, `first_operating_loss` | Defined as **reserved**: rejected by code and by the database `CHECK`. Cannot be emitted until a later migration. |
| C14 | GwapScore export/attestation | Contract + consent-gated preview only; `EXTERNAL_LINKING_APPROVED = false`; no network I/O. |

Both PRs are unmerged drafts; this branch does not depend on them and does not edit `docs/V2_BUSINESS_UNDERWORLD_ROADMAP.md`.

## 4. Open questions that need a founder decision (not assumed)

- **O1 — Seed variance.** Each replay gets a fresh seed, and evidence regimes change payoffs (e.g. `streaming-pivot` max is 580 shifted but 480 unshifted; `founder-runway` min is −320 shifted but −890 unshifted). A player can therefore raise their best by re-rolling the regime, not only by playing better, and the full 2,500 is unreachable for most seeds (the best run observed in tests with seed 7 is 2,403). Total payout is still bounded by the cap, but the design intent (skill vs. luck) needs a decision: fixed per-founder seed, per-quest regime pinning, or accept variance.
- **O2 — Two things called "G".** Legacy testers hold 1,000 v1 coins and a separate 0-start founder capital. The UI labels founder capital "STARTUP CAPITAL" and says the accounts are separate, but a naming review is advisable before a wider cohort.
- **O3 — Abandoned runs.** A run with committed decisions cannot be abandoned (v1 rule, prevents cherry-picking). There is no expiry for a stale open run.
- **O4 — Reset of the draft policy.** Changing policy version after players have a stored best needs a documented best-score migration (not designed here).

## 5. Legacy-data compatibility risks

| # | Risk | Mitigation / status |
| --- | --- | --- |
| R1 | v1 balances/quests/receipts altered | Migration is additive; no statement reads or writes v1 tables except one `SELECT 1 FROM players` at enrollment to tag cohort. Integration test fingerprints a seeded legacy account before/after a full Origin run and across rollback/re-apply (identical). |
| R2 | Legacy testers expecting their 1,000 coins in v2 | Not bridged by design (PR #47/roadmap: opt-in new run). Gate copy says so. |
| R3 | v1 lock (`balance < 100`) blocking Origin | v2 path never calls `isLocked`; a 0 G founder can play, graduate and replay (tested, including in a real browser). |
| R4 | Lock contention between v1 and v2 | Different advisory-lock namespaces. |
| R5 | **Backup/restore evidence does not cover v2.** `preview-backup.yml` dumps `--schema=public`, so v2 tables are included, but `verify-backup-source.mjs`, `verify-restored-backup.sql` and `db-check` only know the four v1 tables. | **Not addressed** (needs the isolated-branch restore drill of issue #30). Sprint 2 handoff item; `v2_origin_reconciliation_issues` should be part of restore verification. |
| R6 | Applying to a Preview branch whose game tables may be empty/inconsistent (`AGENTS.md`) | Migration is independent of v1 row contents. The `AGENTS.md` read-only identity check must still be run before any apply. |
| R7 | Pooled (PgBouncer-style) connections | All v2 locks are transaction-scoped (`pg_advisory_xact_lock`), same as v1. Not exercised against Neon pooling here. |

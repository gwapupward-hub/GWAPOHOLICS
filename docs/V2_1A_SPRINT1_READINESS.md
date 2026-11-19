# v2.1-A Sprint 1 — readiness assessment (after browser-CI remediation)

PR #51, branch `claude/gwapoholics-v2-sprint-1-0kr1uk`. Nothing here authorises a merge, deployment, migration on a connected database, or enabling the feature anywhere.

## 1. Browser CI: root cause and fix

**Root cause (from the failed job log, run 44443402262):** `mobile-engines` spent its entire 15-minute limit in `npx playwright install --with-deps chromium webkit`. The log ends in the middle of `apt` downloads (package 130 of the dependency set, individual packages stalling for 50 s or more on the Ubuntu mirror) with `##[error]The operation was canceled`. No dev server and no browser test had started. It was an environment-setup timeout, not a test failure.

**Fix:**

| Change | Why |
| --- | --- |
| Job runs in `mcr.microsoft.com/playwright:v1.56.1-noble@sha256:f1e7e010…837a` (digest-pinned, linux/amd64, Ubuntu 24.04, `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`) with `--init --ipc=host` | Chromium, WebKit and every system library are already inside the image: no `apt`, no `playwright install` |
| `PLAYWRIGHT_VERSION: 1.56.1` drives `npm install --no-save playwright@…` | Package version equals the image's browser build |
| `scripts/verify-browser-environment.mjs` | Fails in seconds if the package and image versions differ, Node < 22, or any requested engine cannot launch and render; writes versions to the step summary |
| Per-step `timeout-minutes` (5 / 3 / 2 / 12), job limit 20 | A stall is localised to its step instead of consuming the job |
| `tests/browser/engines.mjs` + `BROWSER_ENGINES` (default `chromium,webkit`) | The founder, full-season and secure-telegram e2e files now run once per engine; a requested engine that cannot launch **fails** the run |

Unchanged: the test command `node --test tests/browser/*.e2e.mjs` (plus `--test-reporter=spec` so per-engine results are readable), all existing test files and their assertions, the dev-server step, action SHAs.

**Upgrading Playwright later:** choose a new `mcr.microsoft.com/playwright:vX.Y.Z-noble` tag, copy its digest (`curl -sI -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' https://mcr.microsoft.com/v2/playwright/manifests/vX.Y.Z-noble | grep -i docker-content-digest`), and change the image reference **and** `PLAYWRIGHT_VERSION` together. The verifier turns a mismatch into an immediate, explicit failure.

**Local use:** `BROWSER_ENGINES=chromium node --test tests/browser/*.e2e.mjs` (needs `npm run dev` and `npm i --no-save playwright`). The pre-existing `mobile-engines.e2e.mjs` hard-codes both engines and therefore fails locally wherever WebKit is not installed; that is unchanged behaviour.

## 2. Verification record (commit `441cc57`, PR check runs)

| Check | Run / job | Result |
| --- | --- | --- |
| `baseline` (`npm run check`, `npm test`) | 44453499839 / 135322874782 | success |
| `postgres-ledger` (v1 test + v2 founder suite, service `postgres:17`) | 44453500006 / 135322875499 | success |
| `mobile-engines` | 44453499905 / 135322874837 | success, 1 m 29 s (previously cancelled at 15 min) |

`mobile-engines` log evidence: container is the pinned image; `npm install` 3 s; environment verifier reported **Playwright 1.56.1, Node 22.23.4, Chromium 141.0.7390.37, WebKit 26.0**, both launching and rendering; spec reporter **22 tests, 22 pass, 0 fail, 0 skipped, 0 cancelled** in 54 s.

| Engine | Tests | Pass |
| --- | --- | --- |
| Chromium | 11 = 7 founder (new player/graduation/hub, zero-capital, resume, flag off, Origin closed, unauthenticated probe, session expiry) + 2 existing v1 (five-quest season, small phone) + 1 existing v1 server-authority + 1 existing Android-sized touch flow | 11 |
| WebKit | 11 = same 7 founder + same 3 v1 + 1 existing iPhone-sized touch flow | 11 |

Founder coverage per engine: touch-class mobile emulation, 390 px and 320 px (no horizontal scroll, one-row 4-tab nav), reduced motion honoured (static shell, no decorative animation, dialogue fully shown), single page heading, every control named, keyboard activation of the primary action, labelled story stage + polite live region, goal ladder and capital presentation, zero-capital replay navigation, five-quest graduation, persistence across reload, no founder data in browser storage, disabled-flag / closed-Origin / unauthenticated / expired-session boundaries, and that only `command/requestId/caseId/choiceId` ever leave the browser.

Also run locally for this remediation (disposable local PostgreSQL 16.15, no Neon): `npm run check` pass; `npm test` 168/168; v1 Postgres ledger test pass; v2 founder Postgres suite 27/27; browser suite on Chromium 11/12 (the one failure is the pre-existing WebKit-only test that cannot launch because WebKit is not installed in that sandbox; WebKit itself was verified in CI above).

## 3. Sprint 1 invariants and where they are enforced

| Invariant | Evidence |
| --- | --- |
| v1 gameplay unchanged | v1 unit + browser suites green on both engines; v1 Postgres test green; v1 files changed only additively (`server/http.mjs` exports, optional HUD label, flagged `app.mjs` branches) |
| Origin scores computed server-side | Body accepts only four fields (HTTP test rejects `score`, `founderId`, `originRunId`, `balance`, …); score recomputed from stored decisions + server seed |
| Replay credits idempotent; equal/lower → 0 G | Shared suite on memory store **and** real Postgres; browser test proves an equal replay adds no credit |
| Concurrent settlements cannot duplicate capital | 16 parallel requests across 4 pools → one settlement and one credit; 6 identical + 6 distinct-id requests → one credit; DB `UNIQUE(origin_run_id)` on ledger and settlement |
| Existing balances and histories intact | v1 fingerprint identical across a full Origin run and across apply → rollback → re-apply |
| Founder identity / ledger persist | Cross-connection and cross-session tests; reconciliation view empty |
| Disabled v2 inaccessible | Flag off ⇒ 404 with zero store calls; unapproved policy ⇒ read-only; unknown/business/exchange commands ⇒ 400; DB trigger rejects every `v2_businesses` insert |
| Telemetry deduplicated; future events inactive | Shared suite: one `session_started` per session window (6 parallel opens = 1), one capital event per settlement incl. zero-delta and consistent with the ledger, retries and rejected duplicates emit nothing; `first_company_opened` / `first_operating_loss` rejected in code and by the table `CHECK` |

## 4. Classification of remaining limitations

### A. Required before Sprint 1 technical acceptance

| Item | Status |
| --- | --- |
| Browser CI green on Chromium **and** WebKit | **Done** (section 2); re-confirmed on each push |
| Baseline + PostgreSQL CI green | **Done** |
| Owner confirmation of two interpretations: zero-delta settlements emit `origin_capital_credit_committed` with `outcome=no_improvement` (ledger holds positive credits only); sessions are 30-minute-inactivity based | **Open — needs owner reply.** Changing either later means a telemetry schema version bump |
| Owner technical review of PR #51 | Open |

### B. Deferred to later v2.1 builds

| Item | Target |
| --- | --- |
| No expiry for abandoned open runs | 2.1-E (needs real usage data) |
| Durable command budget counts successes only; failed-request floods rely on ingress WAF | 2.1-E / release gate |
| No retention job for `v2_telemetry_events` / `v2_command_receipts` | Before a wider cohort (2.1-E) |
| `founder_goal_viewed` is a server impression, not a render confirmation | Accepted semantics; revisit only if analytics need it |
| Founder directory is a contract only; `founder_directory_viewed`, `recovery_*`, `business_type_previewed` events undefined | Founder decides timing (PR #50 places the directory in A) |
| Policy-version migration for stored bests | Only when a second policy exists |
| Capital debit path, business opening, decision echo | 2.1-B (see Sprint 2 handoff) |

### C. Required before any merge or release

| Item | Why / what |
| --- | --- |
| **Economic policy approval.** 500 G per quest, 2,500 G cap, scoring formula, business prices | Unapproved. The policy refuses to run unless `GWAP_V2_ALLOW_UNAPPROVED_POLICY=isolated-preview-only`, never in production. Merging inert, default-off code does not enable it, but **no release** without approval. Keep experimental policies to isolated development |
| **Seed-variance decision** | `V2_1A_SEED_VARIANCE.md`; decide with the policy (accept / per-regime normalisation / pinned regime / replay limits). Nothing was changed |
| **Neon / PostgreSQL 18 compatibility** | Migration 002 is verified on **PostgreSQL 16.15** (local, disposable) and **PostgreSQL 17** (CI service container). **PostgreSQL 18 and Neon are NOT verified** and must not be claimed. Needed: run `tests/integration/postgres-founder.test.mjs` on a disposable `postgres:18`, then apply to an *isolated* Neon branch after the `AGENTS.md` read-only identity check and a founder-approved plan. Never default/main or live Preview first |
| **Live Neon inspection** | Not performed (console API returned 401; no MCP/CLI here). The identity check must run before any apply |
| **Backup/restore coverage of v2 tables** | Section 5 |
| Manual iOS/Android Telegram WebView QA, balancing, performance/security drills | Consolidated end-of-v2.1 gate (per brief) |
| Naming review for founder capital vs legacy coins ("G" twice) | Before any non-internal cohort |
| Explicit founder approval to merge / enable flag | Required |

## 5. Backup and restore: changes needed so v2 tables are verified

`preview-backup.yml` dumps `--schema=public --format=custom`, so `public.v2_*` tables, triggers, functions and views are **already in the encrypted dump**; nothing proves they restore. Concretely:

1. `scripts/verify-restored-backup.sql`: the structural check hard-codes the four v1 tables, so restored v2 tables pass unverified. Add (aggregate output only, per `AGENTS.md` rule 4): row counts for each `v2_*` table to compare with the source snapshot; `SELECT count(*) FROM v2_origin_reconciliation_issues` = 0; existence of all 13 `v2_*` tables, the unique indexes (`v2_one_open_origin_run_per_founder`, ledger and settlement uniqueness) and the append-only triggers (`pg_trigger`); `v2_schema_meta` contains `002_v2_founder_entry`; composite foreign keys present.
2. `scripts/verify-backup-source.mjs`: extend the "non-empty public game data" proof so a source with v2 rows is also checked (conditionally, only when `v2_schema_meta` exists). A schema-only or empty v2 section must not count as recoverability proof (issue #30 rule).
3. `scripts/db-check.mjs`: when `GWAP_V2_FOUNDER_HUB=1`, require the 002 objects (readiness check).
4. Runbooks `docs/B2_BACKUP_RUNBOOK.md`, `B2_IPHONE_RESTORE_RUNBOOK.md`, `B2_RESTORE_ACCEPTANCE_EXAMPLE.md`: add the v2 acceptance lines above. Restore only into a **new empty dedicated database** (rule 7), never live Preview or Neon default/main.
5. Privacy/secrets: `v2_founder_telegram_accounts` links Telegram IDs to founders, so restore evidence must never print its rows. `GWAP_V2_ANALYTICS_KEY` is **not in the database**; escrow it separately, because without it restored telemetry can no longer be correlated to its founders (by design).

## 6. Manual verification still required (not done, by instruction)

Real Telegram WebView on physical iOS and Android devices; real-session cookie rotation under Telegram; economic balancing against actual play; performance and security drills; restore drill including v2 tables; an owner-run migration rehearsal on an isolated Neon branch.

## 7. Readiness assessment

**Ready for owner technical review.** Browser, baseline and PostgreSQL CI are green on the remediation commit, Chromium and WebKit each ran 11/11, and the documented limitations are classified. **Not ready to merge or release:** the scoring policy and prices are unapproved, PostgreSQL 18/Neon compatibility and the identity check are unverified, v2 backup/restore verification does not exist yet, and manual device QA is outstanding. Sprint 1 is technically complete only once the owner confirms the two interpretations in section 4A.

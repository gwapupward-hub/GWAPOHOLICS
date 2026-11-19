# v2.1-A Founder Entry — developer guide (Sprint 1)

Player journey: **0 G → five Origin quests → verified starting capital → graduation → Founder Hub → next business milestone.**
Everything is behind a server flag that is **off by default**; with it off the app and API behave exactly as v1.

## 1. Feature flags (all default OFF/unavailable)

| Variable | Effect |
| --- | --- |
| `GWAP_V2_FOUNDER_HUB=1` | Enables `/api/v2/founder` (otherwise `404`, no cookie parsing, no DB access). Only the literal `1` enables. |
| `GWAP_V2_ORIGIN_POLICY=origin-v1-draft` | Scoring policy to use. Unset ⇒ Origin is closed (snapshot works read-only; every mutation is `409 origin_unavailable`). |
| `GWAP_V2_ALLOW_UNAPPROVED_POLICY=isolated-preview-only` | Required to run a policy whose `approval.status` is not `approved`. **Ignored when `VERCEL_ENV=production`.** |
| `GWAP_V2_ANALYTICS_KEY` (≥ 32 bytes) | HMAC key for pseudonymous telemetry. Unset ⇒ no telemetry is written. |
| `GWAP_V2_SHOW_ILLUSTRATIVE_ECONOMICS=isolated-preview-only` | Show unapproved illustrative business prices in previews. Hidden otherwise; ignored in production. |

Reuses the existing `DATABASE_URL`, `GWAP_SESSION_SECRET` (+ `_PREVIOUS`). The client discovers the feature by calling `GET /api/v2/founder`; a 404 (or any failure) hides every v2 control.

## 2. Architecture

```
app.mjs ──► founder-client.mjs ──► /api/v2/founder (api/v2/founder.js)
  │                                   └─ server/v2/http.mjs      cookie identity, exact-key bodies, error mapping
  └─ founder-hub-view.mjs (pure HTML)     └─ founder-service.mjs  commands, one-transaction settlement
                                              ├─ origin-engine.mjs   reuses v1 chooseStep/stageView/chainResult
                                              ├─ origin-policy.mjs   versioned scoring + credit math (pure)
                                              ├─ hub-view.mjs        snapshot builder (contract hubSnapshot v1)
                                              └─ postgres-founder-store.mjs  advisory lock + SQL
```
Pure contract modules: `versions`, `config`, `telemetry-contract`, `goals`, `business-templates`, `reputation-contract`, `visibility-contract`.

## 3. HTTP contract

`GET /api/v2/founder` → `{ founder: <snapshot> }` (own data only; read-only except session telemetry).
`POST /api/v2/founder` body **exactly** `{command, requestId, caseId?, choiceId?}`; same-origin HTTPS, `X-GWAP-Request: 1`, `application/json`.

| command | Effect |
| --- | --- |
| `origin_start_run` | Enrolls the founder on first use (0 G account) and opens a run with a server-issued seed. One open run at a time. |
| `origin_start_quest` (`caseId`) | Opens a quest in the current run. No repeats within a run; no hopping while a chain has committed decisions. |
| `origin_choose` (`caseId`,`choiceId`) | Commits one decision. The 4th decision scores the quest; the 5th finalizes and settles the run. |
| `enter_hub` | Requires graduation; records hub entry once. |

Anything else (`score`, `founderId`, `originRunId`, `balance`, `event`, unknown commands such as `open_business`) → `400`. Errors: `401 sign_in_required`, `403 forbidden_origin`, `404 not_found` (flag off), `409 <code>`, `429 rate_limited` (+`Retry-After`), `503 founder_service_unavailable` (no detail leaked).

Snapshot (`contract: 1`) never contains Telegram ids, the founder UUID, seeds, raw quest cash flows, or idempotency keys (asserted in tests). It carries: `features`, `founder` (short code), `origin` (policy description, graduation, best, credited total, open run, replay rule), `capital` (`zero|insufficient|unclassified`), `quest` (cinematic data in the existing draft/step/result shape), `receipts`, and after hub entry `hub` (5 goals, 3 business previews, recovery placeholder) and `nextStep`.

## 4. Data contracts (migration 002)

| Table | Role | Mutability |
| --- | --- | --- |
| `v2_founders`, `v2_founder_telegram_accounts` | Durable founder id; 1:1 Telegram association; cohort (`new`/`legacy_v1`), session ordinal, hub entry | row updates for presence only |
| `v2_origin_runs` | Versioned-policy run, server seed, one open run per founder | finalized rows immutable (trigger) |
| `v2_origin_quest_results` | Per-quest decisions, raw result, score | append-only |
| `v2_origin_qualification` | Personal best, lifetime credited, graduation | updated only inside settlement |
| `v2_capital_accounts` | Separate v2 operating capital (never mirrors `players.balance`) | balance changes only via ledger credit |
| `v2_capital_credit_ledger` | Immutable credits: transaction id, run id, verified score, previous best, delta, best after, balance after, policy version, idempotency key, timestamp | append-only; `UNIQUE(origin_run_id)`; delta > 0 |
| `v2_origin_settlements` | A receipt for **every** finalized run (`credited` or `no_improvement`) | append-only; `UNIQUE(origin_run_id)` |
| `v2_reputation_events` | Evidence stream (qualification dimension), digests, correction/revocation rows | append-only |
| `v2_telemetry_events` | See event contracts | no UPDATE; DELETE allowed for retention |
| `v2_command_receipts` | Idempotency + durable rate budget, namespaced by Telegram identity | insert-only in practice |
| `v2_businesses` | Reserved ownership/category reference | **insert trigger rejects everything** until 2.1-B |

Ownership is enforced in the schema with composite foreign keys `(origin_run_id, founder_id)`; every store call also filters by `founder_id`. Views: `v2_origin_reconciliation_issues` (must be empty), `v2_day2_retention_cohorts`.

## 5. Settlement (what "atomic" means here)

`origin_choose` on the 5th quest runs, in **one** transaction under `pg_advisory_xact_lock` for that Telegram identity: insert quest result → clear draft → finalize run → compute `credit = max(0, min(S, cap) − best)` → (if > 0) credit the capital account and append the ledger row → insert the settlement receipt → update best/graduation → append reputation evidence → append telemetry → store the command receipt. Any failure rolls everything back.
Duplicate protection is layered: request receipts (same `requestId` ⇒ same stored answer; reused for a different command ⇒ `409`), state machine (no open run/quest ⇒ rejected), and database uniqueness on run settlement and ledger idempotency key (`origin-settle:<runId>`).
Outcomes: higher score pays only the improvement; equal/lower pays nothing and never lowers the best; an unfinished run pays nothing; 0 G is a valid graduation.

## 6. Scoring policy (draft, disabled for live use)

`origin-v1-draft` = PR #47's proposal: per quest `round(500 × (raw − min)/(max − min))`, five quests, lifetime cap 2,500, bounds verified against the engine. It is configuration, versioned, and unapproved (see review doc C1/O1). Approving means a reviewed commit adding an approved policy version.

## 7. Security / privacy model

Identity only from the signed cookie; the body cannot name an account, run, score or balance. Per-account isolation (tested with two accounts, namespaced request ids, FK + query scoping). Disabled feature ⇒ 404 with zero store calls. Error bodies are generic. No v2 state in `localStorage`. Telemetry is pseudonymous and un-joinable (event contracts doc). The GwapScore attestation and founder directory are **contracts only**: consent-gated preview with `EXTERNAL_LINKING_APPROVED=false`, and a card projection that is private unless explicitly opted in.

## 8. Running the tests

```bash
npm run check && npm test                                   # unit tests; no database or browser needed
# real PostgreSQL (disposable DB named gwapoholics_ci; needs CREATE DATABASE for the rollback test)
GWAPOHOLICS_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/gwapoholics_ci \
  node --test tests/integration/postgres-ledger.test.mjs     # v1, separate process
GWAPOHOLICS_TEST_DATABASE_URL=... node --test tests/integration/postgres-founder.test.mjs
# browser (needs `npm run dev` and `npm i --no-save playwright`)
node --test tests/browser/founder-origin.e2e.mjs
```
`tests/support/founder-suite.mjs` is one behavioural suite run against both an in-memory store and real Postgres, so the two cannot drift.

## 9. Known limitations (honest list)

- Scoring/prices unapproved; seed-variance question open (review O1).
- Not applied to any Neon branch; Neon/PgBouncer behaviour unverified; backup/restore verification does not yet include v2 tables (R5).
- The 30 commands/60 s budget counts only successful commands (as in v1); failed-request floods need the ingress WAF.
- No expiry for abandoned open runs; `v2_command_receipts` and telemetry have no purge job yet.
- `founder_goal_viewed` is a server impression, not a render confirmation.
- Local WebKit (iPhone engine) browser test could not run in this sandbox (Chromium only); CI installs it. No manual Telegram/device QA was done (deferred to the end-of-v2.1 gate by instruction).

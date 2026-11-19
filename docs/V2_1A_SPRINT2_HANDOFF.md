# Sprint 2 handoff — from v2.1-A Founder Entry to v2.1-B First Business

Sprint 1 leaves persistent founder identity, a verified capital account, an immutable credit ledger, reputation evidence, telemetry, a flagged Hub and inactive business templates. Nothing below has been started.

## A. Decisions and approvals needed before engineering starts

| # | Needed from the founder | Why it blocks |
| --- | --- | --- |
| D1 | Approve, change or reject the Origin scoring numbers (500/quest, 2,500 cap) and decide **O1** (fixed vs per-run seed / regime pinning) | Live credit is impossible while the policy is `unapproved` |
| D2 | Approve the first economically viable business and its numbers (setup cost, reserve, per-cycle costs, margin, capacity) | `economics` is all `null`; `classifyCapital` cannot say "insufficient" without a threshold |
| D3 | Approve running migration 002 on an **isolated** Neon branch, then a separate approval for any connected branch | Not applied anywhere yet |
| D4 | Confirm interpretations C11 (zero-delta event) and C12 (inactivity-only sessions); decide timing of the Active Founders directory (C9) | Event/UI contracts depend on them |
| D5 | Naming review for founder capital vs. legacy coins (O2) | Two currencies called "G" |

## B. Operations (no code)

1. Run the `AGENTS.md` identity check on the intended Preview branch; apply 002 to an isolated branch; run the founder integration suite against a disposable database on the same engine version.
2. Provision `GWAP_V2_ANALYTICS_KEY` (separate from every other secret) and, for an isolated Preview only, `GWAP_V2_FOUNDER_HUB=1`, `GWAP_V2_ORIGIN_POLICY`, `GWAP_V2_ALLOW_UNAPPROVED_POLICY=isolated-preview-only`.
3. **Extend backup/restore verification to v2** (`scripts/verify-backup-source.mjs`, `scripts/verify-restored-backup.sql`, `scripts/db-check.mjs`): the dump already includes `public.v2_*`, but nothing proves them. Restore drill must end with `v2_origin_reconciliation_issues` empty.
4. Add a retention job for `v2_telemetry_events` (DELETE is permitted) and decide a policy for `v2_command_receipts`.

## C. Build 2.1-B work plan (in order)

1. **Migration 003** (new file, additive): drop trigger `v2_businesses_insert_disabled`; extend `lifecycle_status` `CHECK`; add `UNIQUE` "one business per allowed action"; add a **capital debit** path (a `v2_capital_debit_ledger` with `transaction_id`, `founder_id`, `business_id`, `amount_g > 0`, `balance_after_g`, `idempotency_key`, append-only like the credit ledger) and extend `v2_origin_reconciliation_issues` so `balance = credits − debits`; extend telemetry `CHECK` with `first_company_opened` (and `business_type_previewed` if approved).
2. **Store primitives** (add to both `postgres-founder-store.mjs` and `tests/support/memory-founder-store.mjs`): `createBusiness`, `debitCapital`, `getBusinesses`. Keep the rule that every call takes `founderId`.
3. **Service**: new command `business_open` (`caseId`-style `businessTypeId` from the registry only), inside one transaction: lock → check template `status`/approved economics → check capital ≥ setup + reserve → debit → create business → emit `first_company_opened` → reputation event. Replace `openBusiness()` in `business-templates.mjs` (currently always throws) and flip the template's `status`/`purchasable` + fill approved `economics` for the first template only.
4. **Goals**: `deriveGoals(..., receipts)` already accepts verified receipt kinds; supply `company_opened` from the business table. Nothing client-side changes goal state.
5. **Capital status**: pass the approved threshold into `classifyCapital`; `entryCapitalThresholdG` currently reads illustrative values only when the preview flag is on.
6. **Decision echo (first scripted supplier/financing choice)**: new append-only `v2_founder_decisions` (receipt id, choice id, policy version) so 2.1-D can call it back.
7. **UI**: replace the Hub's "preview only" card for the approved template with an open flow in the existing cinematic style; keep the other two inactive.
8. **Recovery activity** (bounded educational side activity) if approved: needs a budgeted G source and frequency limits before any code.

## D. Interfaces to build on (stable in Sprint 1)

| Interface | Location | Extension rule |
| --- | --- | --- |
| Store transaction contract (`store.transaction(telegramUserId, fn)`; `tx.*` primitives) | `founder-service.mjs`, both stores | Add methods; don't change existing signatures |
| Hub snapshot `contract: 1` | `server/v2/hub-view.mjs` | Additive fields only; bump `V2_CONTRACTS.hubSnapshot` for breaking changes |
| Goal ladder v1 | `server/v2/goals.mjs` | Add receipt kinds, not client inputs |
| Template registry v1 | `server/v2/business-templates.mjs` | `economics` is authoritative; `illustrativeEconomics` is never used for money |
| Reputation evidence | `server/v2/reputation-contract.mjs`, `v2_reputation_events` | Add event types + `reliability` dimension via migration + `PAYLOAD_KEYS`; corrections are new rows |
| GwapScore-compatible attestation preview | same | Stays non-deliverable until privacy/security approval flips `EXTERNAL_LINKING_APPROVED` |
| Founder visibility card | `server/v2/visibility-contract.mjs` | Needs storage (`v2_founder_visibility`), opt-in endpoint, moderation, rate limits |
| Telemetry registry | `server/v2/telemetry-contract.mjs` + table `CHECK` | Edit both in one PR; reserved events become active only with their gameplay |
| Behavioural suite | `tests/support/founder-suite.mjs` | Add scenarios once; they run on memory and Postgres |

## E. Risks to carry forward

- Seed variance / payout intent (O1); per-run seed means replays can improve score by regime luck.
- v1 + v2 both tell the player "G" (O2).
- Command budget is 30/60 s and counts successes only; a full Origin run is 26 commands — fine for humans, but revisit with real telemetry.
- Stale open runs never expire (O3).
- The browser suite uses a mocked server; a real-Telegram WebView pass (iOS + Android) remains for the end-of-v2.1 gate by instruction.

## F. Definition of done for Sprint 2 (proposal)

Opening the first business debits capital exactly once under concurrency (same style of tests as settlement), emits `first_company_opened` once, completes the goal receipt, preserves every Sprint 1 test, adds migration 003 with rollback + disposable-DB validation, and leaves Deal Room / Exchange / rivals / neighborhoods untouched.

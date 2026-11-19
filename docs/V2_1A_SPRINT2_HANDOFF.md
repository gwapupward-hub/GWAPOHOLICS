# Build Your Empire — engineering and release handoff

**19 November 2026 · Draft PR #54 · Invited-player acceptance pending.** The branch includes a gated path from qualification through opening, operations and reinvestment. The registry contains no approved purchasable business. The READY test deployment therefore cannot demonstrate the whole path with a real founder. Replays remain available under an enabled Origin policy. Virtual G has no cash value.

## Release status against the roadmap

| Release | Implemented and exercised | Remaining gate |
| --- | --- | --- |
| A · Founder Entry | Authenticated server identity, persistent in-progress run, qualification, capital account, delta-only replay credits and recovery by replay. | Approve scoring, cap and seed regime. Confirm new and returning founders on the selected test bot and validate the legacy-to-Origin experience. |
| B · First Business | One owned starter, setup debit, minimum reserve check, supplier confirmation, durable opening decision, ownership and onboarding goal. A lost acknowledgement recovers from server state. | Select the enterprise and approve its opening terms. Review its in-world presentation on Telegram. |
| C · Business Operations | Confirm an inventory choice, serve simulated demand, pay costs and see an itemized profit or loss. The first supplier choice influences later sales. Cooldown and receipts survive reconnect. | Approve costs, demand, margins, cadence and solvency limits. The current loop settles on explicit commands. Offline reporting and the low-capital comeback path still need design and acceptance. |
| D · Growth and Consequences | Earn persistent first-cycle XP, see recent history, and pay once for a capacity expansion. Recorded expansion affects subsequent sales. | Approve upgrade and XP terms, define reliability evidence and recovery rules, assess inflation and progression over repeated cycles. |
| E · Player Refinement | Inherited settings, privacy, logout, synthesized strings and haptics. This branch fixes narrow layout and Escape focus, handles logout failure/retry and gates settlement cues on confirmed outcomes. | Consolidated device run, real audio/haptic perception, closed-alpha observations, first-cycle completion and solvency measurements. |
| F · Integration and Readiness | Guarded migrations, reconciliation, populated local restore and a two-account read-only mock agreement checking ownership and funds. | Rehearse on an approved isolated Preview database, review the contract and acceptance evidence, then obtain founder sign-off. Deal Room remains planned. |

## Code and contract decisions

| Surface | Changed modules and behavior |
| --- | --- |
| Commands and snapshots | `server/v2/{http,founder-service,hub-view,config,business-templates,operations}.mjs`, `founder-client.mjs`. The client submits a choice, version, request identifier and expected cycle where applicable. The server resolves founder, policy, prices, XP and balance. Additive Hub fields support older clients. |
| Persistence and observability | `server/sql/003_*`, `004_*`, `postgres-founder-store.mjs`, `telemetry-contract.mjs`. The existing founder transaction serializes financial commands. Immutable journals anchor ownership, supplier, debits, sales and expansion. First-open and first-loss events are deduplicated. |
| Player experience | `app.mjs`, `founder-hub-view.mjs`, `styles.css` and the sensory/settings paths. Players can review costs, confirm a choice and recover a receipt. The hosted player journey requires Telegram. The isolated browser demo runs on loopback. |
| Verification and recovery | Browser, unit and PostgreSQL suites in `tests/`, schema checks in `scripts/verify-founder-schema.sql`, archive checks in `scripts/audit-backup-copy.mjs`, database and backup workflows/scripts. Expected schema generation is checked against archive contents. |

## Economy and integrity

- Origin grants max(0, eligible verified score − previous credited best). Equal and lower runs grant zero. Qualification credits, business ownership, prior expenses and XP survive replay.
- Reconciled capital equals Origin credit minus opening debit plus operating revenue minus operating cost minus expansion debit. Opening requires setup cost plus reserve. Each cycle requires its entire cost in available capital before any revenue is recognized.
- Units sold are bounded by stock, supplier-specific demand and installed capacity. The receipt records unit price, costs, revenue, before/after balances, time, cycle number and policy version. XP comes from receipts. A retry cannot repeat the first-cycle award.
- Unique opening, cycle and upgrade keys complement the founder lock. Reusing a command identifier returns the committed response. A competing command with a new identifier cannot purchase the same asset twice. A final-step failure rolls back intervening financial writes. Balances and ownership are scoped to the authenticated founder.
- Synthetic PostgreSQL fixtures produced +8 G, then −18 G, one 7 XP award and a 9 G expansion. These numbers establish arithmetic and persistence only. A profitable repeatable cycle can accumulate G over time; a poor inventory choice can strand a founder below the minimum operating cost. Quantify both outcomes before approving terms. Replay seed variance, stale runs, terminology, telemetry retention and receipt retention remain open.

## QA and evidence

| Check | Evidence and limit |
| --- | --- |
| Static and unit | Baseline 199 unit tests passed. Implementation passed `npm run check` and 203/203 unit tests, including authentication/session, economic boundaries, policy gates and settings. |
| PostgreSQL | Fresh disposable PostgreSQL 18.6 passed 1/1 legacy ledger and 28/28 founder integration tests. Includes 12 competing opens across connections, rollback after receipt failure, exact and stale cycle retries, insufficient funds, cooldown, profit/loss, replay and upgrade deduplication. CI uses PostgreSQL 17. |
| Browser | 29 automated tests across Chromium and WebKit with mocked Telegram/API responses. Includes new/returning Origin players, reload, expired session, 320px business flow, reduced motion, logout/re-login, preference persistence and focus. Real WebView acceptance is pending. |
| Restore | PostgreSQL 18.7 dump/restore tools recovered a populated synthetic public schema into a fresh local database. Source and restored COPY counts matched, including 2 founders, 4 Origin settlements, 1 business, 2 cycles and 1 upgrade. Founder reconciliation passed and all five legacy discrepancy counts were zero. |
| Connected Neon Preview | Read-only inspection of branch `br-billowing-sea-bcx8nhn7` found PostgreSQL 18.7, 1 player, 2 quests, 3 ledger rows, 14 command receipts and no v2 schema marker. This branch was neither migrated nor used for synthetic tests. |
| CI and Preview | Implementation commit `6cbd152d4b4d46ebdcc4d875c018ba50c275e93f` on the isolated branch. Inspect the [baseline checks](https://github.com/gwapupward-hub/GWAPOHOLICS/actions/runs/44557677871), [PostgreSQL integration](https://github.com/gwapupward-hub/GWAPOHOLICS/actions/runs/44557677866), [mobile browser checks](https://github.com/gwapupward-hub/GWAPOHOLICS/actions/runs/44557678048) and its [READY Vercel Preview](https://gwapoholics-tests-98ksh4f4t-bigdaddygwaps-projects.vercel.app). Deployment status establishes build readiness. Bot routing and authenticated gameplay require the device pass. |

To reproduce, check out the implementation SHA, install the repository dependencies, run `npm run check` and `npm test`, then follow the pinned browser workflow and the PostgreSQL workflow. Its final step restores the populated fixture into a second database, compares archive counts and checks the reconciliation results. The workflow expects a fresh disposable database named `gwapoholics_ci` and runs the legacy and founder suites in sequence. Use separate databases for source and restore. Apply the repository restore verifier and compare archive counts, schema generation and reconciliation before accepting a restore.

## Release gates, migration and rollback

1. Preserve the review sequence [#52](https://github.com/gwapupward-hub/GWAPOHOLICS/pull/52) → [#53](https://github.com/gwapupward-hub/GWAPOHOLICS/pull/53) → [#54](https://github.com/gwapupward-hub/GWAPOHOLICS/pull/54). Recheck base/head, CI and Preview after any retarget. The founder holds merge and release approval.
2. **Next decision:** approve a single starter business and its versioned terms together (setup, reserve, stock, prices, supplier demand, cadence, first-cycle XP and upgrade). Set the Origin policy/seed before an authenticated economy trial. Existing illustrative values are proposals.
3. For a separately authorized isolated Preview, verify branch identity and source backup first. Apply only missing migrations in order: 001, 002, 003, 004. Never replay 002 over 003/004. Verify the schema and reconciliation before enabling the appropriate schema readers. First business requires `GWAP_V2_FIRST_BUSINESS_SCHEMA=1`; operations additionally require `GWAP_V2_OPERATIONS_SCHEMA=1`. Commands require reviewed terms. Confirm Preview bot identity and routing independently of deployment readiness.
4. On an empty authorized rehearsal database roll back 004 then 003 using the supplied down scripts with session setting `gwap.confirm_v2_rollback=yes`. Populated economic history blocks the relevant down migration. In a populated environment close offers, preserve schema readers and receipts, and rehearse recovery into a separate database. Never overwrite a player database to test recovery.
5. Before wider testing, agree on retention and balance thresholds. Record first-cycle completion, abandonments, insolvency and comeback results against the approved policy. Complete the single device checklist below and review Preview legal disclosures with the owner before launch.

## Consolidated end-of-v2.1 physical acceptance

Run once on the selected release candidate in the private test bot. Record tester alias, platform, OS, Telegram version, deployment SHA/URL, policy version, time and outcome for each row. Mark deferred devices explicitly. Keep tokens, signed launch data and player identifiers out of evidence. The [earlier iPhone worksheet](IOS_QA_RUN_SHEET.md) records historical v1 evidence.

- [ ] On iPhone and Android, launch from Telegram, verify the intended test bot, finish all five qualification quests, enter the hub and compare the displayed award with the server receipt. Close midway and resume. Test an expired session and a connection loss.
- [ ] Check narrow/fullscreen layouts, device safe areas, orientation change, enlarged text and reduced motion. Read scenes with VoiceOver and TalkBack. Navigate settings and confirmations with a keyboard, close with Escape and verify focus returns to the triggering control.
- [ ] Review setup and reserve, decline once, then confirm one starter and supplier. Interrupt the connection after submission, relaunch and verify one business, one debit and the same recorded decision.
- [ ] Exercise a profit, loss, cooldown, rejected unaffordable choice and expansion under the recorded policy. Retry from a second session. Compare receipt totals, G and XP on both devices. Replay an equal/lower and an improved qualification; confirm only the improvement credits and the empire survives.
- [ ] Hear the original strings change through decisions and the success cue after confirmed gains. Check loss and zero-credit feedback, interruptions and silent/haptic opt-outs. Reopen settings and verify saved preferences, mandatory status feedback and the in-game-only notification wording.
- [ ] Cancel logout, exercise a failed logout then retry, relaunch in Telegram and verify identity, balance, ownership, XP and history. Confirm Preview privacy disclosures remain readable.
- [ ] Record closed-alpha observations and reconcile the trial on the authorized database. Record any pending comeback, offline or reliability scenarios against the policy before accepting v2.1.

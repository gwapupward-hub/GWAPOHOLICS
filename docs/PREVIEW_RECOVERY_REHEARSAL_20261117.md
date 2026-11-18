# GWAPOHOLICS — Isolated Preview data-recovery rehearsal (Nov 17–18, 2026)

**State:** ISOLATED HISTORICAL-STATE REHEARSAL VALIDATED; **NOT** a live-game restore; **NOT** an offsite B2 recovery pass.

## Branches and immutable reference points

| Purpose | Neon branch | Database | Data policy |
| --- | --- | --- | --- |
| Active game Preview | `br-billowing-sea-bcx8nhn7` | `neondb` | READ ONLY in rehearsal; no writes permitted |
| Surviving pre-reset copy | `br-damp-scene-bc9ep85r` | `neondb` | Source of historical gameplay; READ ONLY |
| Archived earlier Preview | `br-damp-feather-bcncusj9` | `neondb` | Retain; no compute endpoint; do not delete |
| **New disposable rehearsal** | `br-polished-unit-bc02b798` | `neondb` | Copied from surviving pre-reset branch; test only |
| Default/main | `br-red-star-bc7lzrr0` | `neondb` | DO NOT MODIFY |

New branch name: `rehearsal/preview-reconciliation-20261117`. Provisioned November 18, 2026 at 04:45 UTC; `init_source=parent-data`, **not a restored B2 backup**.

## Independent evidence

Neon activity shows active Preview branch reset at **2026-11-16T09:26:12Z**, with an older saved branch. The surviving copy's latest gameplay update predates that reset; the newly active Preview player's first creation is later. The actor and exact reset cause remain unverified.

### Aggregate counts

| Source | Players | Completed quests | Ledger records | Command receipts |
| --- | ---: | ---: | ---: | ---: |
| Surviving historical copy | 2 | 5 | 7 | 27 |
| Active post-reset Preview | 1 | 1 | 2 | 5 |
| New isolated rehearsal clone | 2 | 5 | 7 | 27 |

Source and isolated clone have matching **private row-fingerprint aggregates for all four game tables**, calculated server-side from all row fields; neither row contents nor fingerprint values were published. This confirms the rehearsal candidate copied historical application data, not only schema.

On the rehearsal clone the existing `scripts/verify-restored-backup.sql` query returned:

- All four expected tables, four primary keys, settlement unique index, and ledger identity sequence = TRUE
- Ledger-chain mismatches = 0
- Persisted-balance mismatches = 0
- Invalid completed quests = 0
- Duplicate quest settlement groups = 0
- Completed quests missing settlement = 0

### Identity and conflict analysis (no player identifiers published)

- **One of two** historical players is also the sole post-reset Preview player.
- The overlapping player's historical balance is **2,710 G** with **5** completed quests (player state version 25); post-reset balance is **1,230 G**, **1** completed quest (version 5).
- The completed quest repeated after the reset has the **same choices** as the first historical completion. The two post-reset ledger events both match corresponding historical events in event type, case, amount, and `balance_after`. There are **zero current-only completed quests**.
- No overlapping receipt idempotency keys, but **do not copy current receipt rows** automatically: cached responses may encode a superseded post-reset player state, and replaying them could violate intended semantics.
- **Two global ledger primary keys collide** between independent histories. Never append using the old `id` values or simply sum/choose max balances.

These facts make **historical state a defensible recovery baseline candidate for the overlapping player**, but not automatic merge authorization. An independent second historical player must be preserved.

## Read-only decision-policy tests

`scripts/preview-recovery-policy.mjs` is a pure, IO-free decision helper. It labels a historical baseline **candidate only** if all current completed quests have identical historical choices and every current ledger event is already represented in historical records. Any novel quest, divergent choices, changed settlement, incomplete data or missing historical state requires **manual reconciliation**.

It never writes to Neon, never returns or processes raw Telegram player IDs, and does not authorize merging receipts. Synthetic regression tests in `tests/preview-recovery-policy.test.mjs` exercise the decision gate. **Do not treat this as a migration program.**

## What's still required to progress beyond rehearsal

1. Preserve all reference branches until the owner signs off; no resets, deletion, live DB credential changes or automatic Vercel rebinding.
2. Verify what database/branch the authenticated test bot is actually using; do not infer it from environment variable names alone.
3. Validate the isolated historical candidate with signed Telegram `initData` against a separately authorized staging deployment/connection and test reopen/persistence, replay prevention, idempotency and the shared player's balance/quest UI.
4. Obtain the founder's **specific choice** to prefer historical completed progress versus current reset session, and approval for exactly which data records would be preserved/rejected. Do not silently discard current receipts or new game state.
5. Back up active Preview before any approved change. Draft a reversible migration plan and rehearsed rollback. No live Preview write without explicit new approval.
6. Perform real encrypted Backblaze restore from a correctly sourced nonempty archive into a **new empty database**, compare recovered aggregate rows and validate Object Lock/hash. This copy-on-write Neon branch does **not** satisfy B2 recovery gate #30.
7. Production sign-off gate #34 remains BLOCKED; Android testing deferred and Solana token planning-only.

Tracking: [Preview reconciliation #42](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/42), [Backup #30](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/30), [Production #34](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/34).

**No live Preview writes, production deployments, data publication or encryption key handling were performed during this rehearsal.**

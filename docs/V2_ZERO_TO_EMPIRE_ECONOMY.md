# GWAPOHOLICS v2 — Zero-to-Empire Qualification Economy

**Status:** Approved product direction; **proposed numeric economy / implementation draft** for review, not approved for merge or deployment.  
**Date:** 2026-11-18  
**Platform:** Telegram Mini App only  
**Currency:** Non-transferable in-game G; no cash value, token, withdrawals, swaps or redemptions.

## 1. Founder decision (approved)

- Every **new qualification run** starts at **0 G**.
- Players complete the five existing cinematic v1 quests to earn an **Origin Score** that becomes v2 startup capital.
- v1 can be replayed **without limits at any time**, before or after entering v2.
- Only increases beyond the player's previously credited **personal-best full-run Origin Score** add G to v2.
- Lower-scoring replays never deduct G; v2 balances, businesses and contracts are never reset by replays.
- This is not authority to edit current v1 persistence, production settings, deployed bots or onchain assets.

## 2. Code-grounded constraints (main branch review, 2026-11-18)

Current `game-core.mjs` has `STARTING_COINS = 1000`, `MIN_PLAY_BALANCE = 100`, `RECOVERY_REWARD = 60`, a one-run-per-case restriction and a nonnegative balance clamp. Current PostgreSQL schema has `players.balance` tied to `game_state.balance`, one settlement per case, and a restricted v1 ledger event-type enumeration. The prior `docs/V2_IMPLEMENTATION_DESIGN.md` describes an **unapproved**, separate hideout/tapping economy that explicitly leaves v1 unchanged. Zero-to-Empire supersedes **that draft's progression assumptions**, but does not silently edit those files.

The following **raw per-quest outcome bounds** were calculated by enumerating all 81 four-decision paths for each of the five existing cases, including both evidence-shift conditions and linked-choice effects. They are model bounds, not player analytics:

| Case | Raw minimum | Raw maximum |
| --- | ---: | ---: |
| streaming-pivot | -430 | 580 |
| brand-backlash | -400 | 550 |
| supply-shock | -910 | 700 |
| founder-runway | -890 | 730 |
| inflation-trap | -960 | 640 |

Raw quest deltas can be negative. Changing `STARTING_COINS` to zero and reusing `isLocked()` would prevent the origin game from beginning. **Do not do that.**

## 3. Proposed qualification scoring — tune in tests

**Lifetime v1 capital ceiling: 2,500 G** (5 quests × 500 G each), finite despite unlimited replays.

For each completed quest:
```
case_score_G = clamp(
  round(500 * (raw_delta - case_raw_min) / (case_raw_max - case_raw_min)),
  0, 500
)
```
Use the frozen numeric bounds above for qualification rules version `origin-v1`. Each case has the same maximum contribution. Outcomes, hidden evidence shifts, consequences, story and profile learning remain meaningful. Never send scoring seed or unrevealed payoffs to the client. The full-run Origin Score is the sum of the five case scores and is therefore 0–2,500 G. Grant **nothing** for partially completed runs. The origin score displayed during a run is provisional until all five quests finish.

Calculated midpoint illustration: the five case-level median path results map to roughly **1,370 G total** under this proposal; this is *not observed player performance*, a forecast, or a balancing guarantee. Test with real pilots.

If seed variation makes reaching exactly 2,500 G impossible for a given run, allow a fresh **server-issued, auditable seed** for each new complete replay. No mid-run resets to cherry-pick favorable evidence. Players can study decisions by replaying.

## 4. One-time improvement grant

Let `S` be the newly verified full-run Origin Score, `B` the highest previously credited full-run score, and `C` the fixed 2,500 G lifetime cap:

```
credit = max(0, min(S, C) - B)
new_best = max(B, min(S, C))
```

Make score comparison, personal-best update and v2 capital credit **one atomic database transaction** under the per-Telegram-player advisory lock. Store an immutable origin-run ID and deterministic idempotency key; unique per-run settlement; duplicate and concurrent submissions return the original response. Total lifetime origin grants equal the personal best, never the sum of replay scores.

Example: 650 → 400 → 1,100 → 950 → 1,600 scores create credits +650, +0, +450, +0, +500 = **1,600 G lifetime awarded**. Actual *spendable v2 balance* also reflects expenses, profits, losses and other v2 economic events. No automatic replenishment for money spent.

## 5. Proposed initial v2 business price ladder

All numbers are **tuning hypotheses**, not approved production prices.

| Opening opportunity | Setup cost | Suggested operating reserve | Total comfortable starting capital |
| --- | ---: | ---: | ---: |
| Freelance service / learning gig | 0 G | 0 G | 0 G |
| Market stall | 250 G | 75 G | 325 G |
| Online shop | 500 G | 150 G | 650 G |
| Service agency | 850 G | 250 G | 1,100 G |
| Physical storefront | 1,200 G | 350 G | 1,550 G |
| Logistics operation | 1,700 G | 500 G | 2,200 G |
| Regional brand | 2,600 G | 700 G | 3,300 G (requires v2 growth) |

The first viable paid business must be accessible well below the expected typical qualified score. Larger expansions should require profitable v2 operations, not just a perfect replay. Model recurring wages, supplies, churn, insolvency, taxes/fees, inventory and demand before introducing passive income. Do not imply guaranteed profits.

**Below 100 G:** permit replaying v1 and free educational v2 gigs, onboarding, and browsing. Keep the 100 G threshold for risk-bearing v2 business actions only; never block origin quests. Proposed learning gig payout 10–25 G with server-side daily limits; tune for time-to-first-business and inflation before implementation.

## 6. Separate data domain, safe migration

- Preserve every pre-existing v1 account's 1,000 G welcome grant, completed quests, recovery history and database state; no mass reset.
- Create a **new versioned origin qualification subsystem** rather than changing the v1 `players.game_state`, unique `quest_runs` constraints, or `virtual_ledger` CHECKs.
- Proposed tables: `origin_runs` (run ID, owner, score version, seed, status, five signed/verifiable quest results, final score, timestamps); `origin_qualification` (owner, best_score_G, total_origin_granted_G, graduated_at, revision); `v2_capital_accounts`; `v2_capital_ledger`; `v2_receipts`. All amounts are integer G initially, with explicit schema versioning if micro-units are later introduced.
- New sign-ups use the zero-G origin experience. Existing testers get an **opt-in new origin run** alongside their untouched legacy state; the legacy 1,000 G is **not** automatically bridged or copied into multiplayer v2.
- Existing v2 hideout economy draft must be reconciled **before** engineering: avoid simultaneous uncapped tapping, idle inflation, and independent G supplies that undercut earned origin capital.
- Keep all data on **isolated** branches/test databases until read-only audits, diff, rollback, backup recovery evidence and owner approval. Never apply migrations to Neon default/main or live Preview solely from this draft.

## 7. Evaluation and release gates

1. Validate bounds against the actual `chainResult` engine for every 81-path case and both shifted/unshifted evidence regimes. Golden test each score, rounding and exact 0/500 endpoints.
2. Simulate many decision policies, time-to-qualify, first-business affordability, 100 G recovery, inflation and business failure rates. Include low-score and accessibility cases.
3. Test zero balance entry, completing all five quests, mid-quest resume, multiple replays, lower/equal/new-best results, lifetime ceiling, cross-device resume, and user-auth separation.
4. Race final replay settlements and request retries across Vercel instances; verify **one** personal-best credit, accurate immutable ledgers, and no overspend or double payout.
5. Verify existing accounts' data and old `/api/game` behavior are unchanged; prototype and QA only behind a default-off feature flag. Enforce per-user and per-IP abuse limits and record safe aggregate monitoring.
6. No v2 economic peer-to-peer G transfers, withdrawable tokens, deployed token, production bot promotion, live schema migration, or main merge without separate owner approval.

## 8. Next engineering slice (not yet authorized to implement)

P0: approve/tune scoring ceiling and price ladder.  
P1: pure scoring module + exhaustive unit tests + simulation report.  
P2: isolated schema and atomic graduation/replay grants + rollback tests.  
P3: Telegram story integration, Founder Record, v2 entry and free gig fallback.  
P4: preview QA, security review, backup recovery, launch gateboard update.  

**Success metrics for pilot:** v1 completion rate; origin score distribution (p10/p50/p90); percentage of graduates able to afford a first business; median time from first launch to opening business; replay-to-improvement conversion; origin grants per player/day; net v2 G creation vs sinks; ledger mismatch and duplicate-grant counts (must be zero).

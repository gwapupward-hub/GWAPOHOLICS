# GWAPOHOLICS v2 — Non-Farmable XP & Level Progression

**Status:** Isolated draft-PR implementation of a **pure XP engine and tests**. No live API wiring, persistence migration, payment processing or deployment.

## 1. Purpose

Players may replay the five cinematic v1 quests **unlimited times** to improve their personal-best *G capital award* under Zero-to-Empire. **XP is independent of G.** No extra XP is granted for:
- replaying completed v1 quests, beating a v1 score, or reaching new G-balance highs;
- Stars purchases, donations, premium item sales, paid referrals, crypto transactions;
- taps, idle accrual, trade volumes, reciprocal deals or raw transfers.

XP must represent **verified achievements and bounded learning**, not wealth, spending or spam. All claims must originate from the server after authoritative event verification.

## 2. Proposed XP policy v1 (subject to playtesting)

| Server-verified achievement | XP | Frequency / protection |
| --- | ---: | --- |
| First completion of each distinct v1 quest | 75 | Once per player, once per canonical quest (5 total) |
| First full v1 graduation | 400 | Once per player, only after all five unique quest awards |
| First legitimate v2 business opening | 200 | Once per player |
| First real contract fulfillment | 160 | Once per player, **not** based on trade volume |
| First positive operating cashflow cycle | 100 | Once per player, verified accounting |
| Daily educational practice | 40 | Once per player per **UTC calendar day**, no matter how many lessons/requests |
| Weekly business/financial review | 120 | Once per player per **ISO UTC week**, including year boundaries |

At v1 graduation: 5 × 75 + 400 = **775 XP, Level 5**. Graduation unlocks the *proposed* v2 first-business tier without spending Stars or GRAM.

**Progression curve:** XP needed for Level L is 25×(L−1)² + 75×(L−1), capped at Level 30.

| Level | Minimum total XP | Proposed gated function |
| ---: | ---: | --- |
| 1 | 0 | Origin journey |
| 5 | 700 | First v2 business |
| 10 | 2,700 | Stars cosmetic purchase eligibility (only once payment compliance is approved) |
| 20 | 10,450 | Read-only marketplace preview |
| 30 | 23,200 | Research/waitlist for *potential* future exchange only |

These thresholds are **hypotheses**, not tested engagement or monetization results. Daily practice + weekly review can yield at most **400 recurring XP in an ordinary seven-day week** (7 × 40 + 120). High-value XP unlocks therefore depend on time, legitimate progress, and fraud review. The engine enforces once-per-day/week award keys using server UTC time. Additional server-side velocity controls remain required.

## 3. Files in this PR

- \`server/v2-xp-policy.mjs\`: pure state, thresholds, allowlisted awards, deterministic unique award keys, validation, level computation, replay and purchase denials.
- \`server/v2-exchange-policy.mjs\`: new \`evaluateV2AccessFromXpState()\` integration adapter, deriving graduated status and level from authoritative XP rather than trusting client-reported levels.
- \`tests/v2-xp-policy.test.mjs\`: graduation, anti-farm, duplicate, UTC period, malformed-state and spoofed-level regression tests.
- \`docs/V2_LEVEL_GATED_EXCHANGE_POLICY.md\`: existing feature gate plan; unsafe peer-to-peer G/Stars/GRAM and conversions remain disabled.

## 4. Security contract for future persistence integration

**WARNING: Pure XP events are NOT their own proof.** Do not expose \`applyAuthoritativeXpEvent\` as an HTTP endpoint, nor trust an \`event.kind\` sent by a Telegram WebView.

Next sprint must:

1. Resolve authenticated Telegram identity from the verified server-side session.
2. Derive v1 unique quest completion from immutable PostgreSQL quest/origin records, graduation from the verified five-quest result, business milestones from settled v2 accounting/contract records, and learning awards from versioned server-evaluated quizzes.
3. Acquire a per-player transactional advisory lock **before** reading/writing XP. Use an immutable \`(telegram_user_id, award_key)\` UNIQUE constraint for awards. Persist score total, award event and an idempotency receipt **in a single database transaction**. Retry safely across processes.
4. Derive player age and distinct active days on the server. Apply rate limits, fraud/dispute holds, bot/collusion signals and suspicious-velocity reviews. Do not collect invasive device attributes unless justified and permitted.
5. Preserve v1 \`players.game_state\`, its 1,000 G legacy grant, v1 quest settlement constraints and other balances; do not silently migrate.
6. Treat the first approved XP bridge as opt-in and behind a default-off server feature flag. Do not execute migration until Neon source/destination, rollback and backup recovery gates are approved.
7. Produce an append-only audit trail, discrepancy checks and aggregate-safe monitoring (duplicate XP grants must be zero). XP history is not transferable across accounts.

**Implementation note:** Tests exercise pure logic only. There is no database concurrency guarantee until the transactional adapter is built and independently tested.

## 5. Abuse/risk examples to reject

- A player completes v1 five times and expects five graduation XP awards.
- A bot resubmits the same request with fresh request IDs to increase daily learning XP.
- A fake server request claims Level 30, forged graduation, or an invented quest ID.
- A player tries to level up by cycling G between self-owned accounts or by buying Stars.
- A player backdates or forward-dates device time to mint learning XP.
- A suspended/disputed account accesses paid features despite XP progress.

## 6. Authorization and launch

This draft branch writes **code and tests only**. It does not enable any v2 menu item or live payment. G/Stars conversion, Stars-to-G purchase, G-to-GRAM conversion, sale of G to players, transfer or cashout remain **hard-disabled**. Separate platform and legal eligibility reviews are prerequisites before considering real-value player trade. Default-off flags and no-merge/no-deploy policy stay in force.

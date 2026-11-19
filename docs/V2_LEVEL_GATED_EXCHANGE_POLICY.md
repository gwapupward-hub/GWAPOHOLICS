# GWAPOHOLICS v2 — Level-Gated Payments & Exchange Policy

**Status:** Concept accepted for planning; safe eligibility policy implemented on an **isolated draft PR**. Financial settlement, convertibility and P2P exchange are **NOT implemented or authorized**.

## 1. Proposed level ladder

| Level | Title | Capability |
| ---: | --- | --- |
| 1 | Rookie | Cinematic v1 origin earning (no initial G grant for new qualification flow). |
| 5 | Entrepreneur | Eligible v2 business operations after v1 graduation. |
| 10 | Merchant | Potential Stars-only purchase of **non-redeemable cosmetic items**, after integration approval, activity and age checks. |
| 20 | Mogul | Read-only player marketplace preview; no orders, G transfers or financial settlement. |
| 30 | Tycoon | Optional expression-of-interest / waitlist **only** for possible future regulated exchange; no actual exchange rights. |

Level tracks **verified progress and play**, never just wallet balance or payment volume. Exact XP progression and levels require playtesting. Eligibility requires authenticated Telegram sessions, graduation and absence of fraud/chargeback holds. Proposed age/distinct-activity minimums: cosmetics 7 days/3 days, preview 14/5, waitlist 30/10.

## 2. Current payment/legal constraints (official sources checked 2026-11-18)

- Telegram requires **Stars (XTR)** for all digital goods/services sold inside Mini Apps; cryptocurrency must **not** replace Stars for those sales. https://core.telegram.org/bots/payments-stars
- Telegram Stars Terms section 4 prohibits **selling, transferring or withdrawing** a user's personal Stars balance for unapproved purposes. A normal game bot may not promise G→Stars cash-out or a peer-to-peer user-Stars secondary market. https://telegram.org/tos/stars/
- Telegram's developer terms warn that immediate delivery of irrevocable, inherently valuable virtual items can trigger chargeback/dispute losses. https://telegram.org/tos/bot-developers
- Telegram's Mini App cryptocurrency rules permit **only TON blockchain** token creation/distribution and **TON Connect** for wallet interaction. A Solana game token cannot be launched/distributed inside this Mini App as proposed. https://core.telegram.org/bots/blockchain-guidelines
- The TON blockchain's native coin is now referred to as **Gram (GRAM)**. This does not make in-app G-for-GRAM settlement permissible. https://core.telegram.org/api/stars
- A platform facilitating redeemable player balances or virtual-currency conversion may trigger **money-transmitter, KYC/AML, consumer-protection, tax and age-policy obligations**. FinCEN guidance: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering

**No guarantee of future exchange support.** Counsel and platform approval required before any real-value user-to-user settlement, and any product involving real value must remain age/jurisdiction restricted as appropriate.

## 3. Explicitly disabled money routes

`g_to_stars`, `stars_to_g`, `g_to_gram`, `gram_to_g`, `peer_g_for_stars`, `peer_g_for_gram`, `peer_g_transfer`, `g_cashout`, and `g_token_withdrawal` fail closed, regardless of account level or feature flags.

The pure `server/v2-exchange-policy.mjs` module has no payment API access and grants **eligibility only** for the permitted non-financial actions. It is not connected to production endpoints, accounts, or an automated checkout.

## 4. Anti-spam and anti-fraud design

- Trust only verified Telegram identity and server-owned XP, age, activity, graduation, fraud flags and purchase history; never client-supplied levels, payment proofs or receipt IDs.
- Before any payment checkout: proof-of-completion, activity spanning distinct days, risk flags, rate limits per account/IP/device signals, optional human review, transparent purchase limits.
- Separate server-side bot-verified `successful_payment`/charge IDs, ledger idempotency, cooldown before spend/transfer of purchased items, refund and chargeback reversal, pending/settled/held states, and /paysupport.
- Identify suspicious replay automation, same-device account clusters where lawful, manufactured player transactions, wash trading, reciprocal loops, unusually rapid progression or price manipulation. Avoid invasive data collection beyond what's justified.
- A level is **not** an anti-Sybil proof. High-value functions require stronger controls; consider age verification/jurisdiction eligibility and independent legal review.
- Never mix **earned G** and **Stars-funded premium inventory** into a redeemable balance. Premium goods should be cosmetic/consumable and non-convertible. Establish no speculative exchange rate between G, Stars or GRAM.

## 5. Integration plan

1. Proposed P0: implement/test pure fail-closed access policy and hard-block unsafe routes (draft PR only).
2. Proposed P1: design XP service with server-sourced, replay-resistant progression; add rate limiting and flags; confirm abuse monitoring.
3. Proposed P2: integrate Stars for **cosmetic digital purchases only** (Telegram XTR), with refunds and chargeback support, in isolated Preview after approval.
4. Proposed P3: non-financial, read-only social marketplace previews; verify privacy, moderation, fraud reporting, and customer support.
5. P4 *research only*: obtain platform/legal determination whether any compliant, real-value user marketplace could exist. Do not implement G redemptions, Stars resale or GRAM transfers unless separately authorized and technically/legal feasible.

## 6. Acceptance gates

- Unit tests prove every prohibited exchange stays blocked at all levels/feature flags; unauthenticated, ungraduated, disputed, young and rate-limited players fail closed.
- No balances, existing v1 accounts, v1 replay rewards or current Neon tables are modified by this branch.
- No payment keys, wallets, callbacks, webhooks, fragment credentials, external settlement endpoints, token contracts, or production bot changes.
- Owner must approve migrations/deployment; compliance review before any real-value feature.

The safe intent is retained: **players earn status before monetary features become available**, but status alone never authorizes a prohibited transfer.

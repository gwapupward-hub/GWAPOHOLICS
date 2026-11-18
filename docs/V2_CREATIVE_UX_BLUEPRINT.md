# GWAPOHOLICS v2 Creative UX Blueprint (concept)

> **Status: concept only. Not approved for implementation.**
>
> This blueprint is outside v1 scope. Player interaction, additional game modes, staking/yield, and price tickers are excluded from v1 until separately reviewed (`docs/V1_PRODUCTION_PLAN.md`). Any Solana token launch requires separate founder approval (`AGENTS.md` rule 8, issue #34). The season, reserve, and event mechanics also require legal review before any design or build work.
>
> **Decision (2026-11-18, founder):** `$GWAP` is an in-game unit only. It is not a token. Monetization, if any, is planned for later through Telegram Stars, Telegram gifts, and GRAM (TON); see section F. Those rails are deferred and not built.

## Scope and changes from the first draft

| Blueprint element | Status in this revision | Source |
| --- | --- | --- |
| `$GWAP` as an in-game unit, earned through bots and tapping | Kept as in-game only. Not a token. The app and legal copy still say "G" and need to be aligned. | `README.md`, `AGENTS.md` rule 5 |
| Staking vaults, "+25% APY", liquidity lockups | Removed. Replaced by Reserve Vault: an in-game lock that gives a bonus, with no yield percentage. | `docs/LEGAL_DISCLOSURES_DRAFT.md` |
| Live `$GWAP` price ticker, market index, "Whale Pump" and "Liquidation Cascade" events | Removed. Replaced by in-game season and event names. | `docs/LEGAL_DISCLOSURES_DRAFT.md` |
| Tab 4 named "Exchange" | Renamed to "Seasons". G cannot be exchanged, so the name implied a feature that does not exist. | `README.md` |
| Async PvP heists, vault breaches, group boss raids, rival-breach push alerts | Unchanged. Still out of v1 scope. | `docs/V1_PRODUCTION_PLAN.md` |
| Terminal minigames, Penthouse idle loop | Unchanged. Still out of v1 scope. Idle income would need new server-side accrual; v1 settles per quest with command receipts. | `docs/V1_PRODUCTION_PLAN.md`, `README.md` |
| Monetization via Telegram Stars, gifts, GRAM (TON) | Deferred and gated (section F). | `AGENTS.md` rule 8 |

---

## Overview

### Unified master game loop

- **Earn & Upgrade (Hideout):** Players idle-tap or passively generate `$GWAP` to upgrade their cyberpunk hideout, unlocking higher-tier automated bots and in-game income multipliers.
- **Risk & Multiply (Rogue-Lite Mini-Games):** Players spend accumulated energy tokens on fast-paced "Vault Crack" mini-games. Success multiplies hourly earnings; failure triggers a brief cooldown.
- **Attack & Defend (Async Heists):** With higher hideout tiers and stacked multipliers, players launch async heists against rival vaults or syndicate targets to steal large loot pools.
- **Adapt or Perish (Seasons):** Every 48 hours, the season shifts, forcing players to change hideout loadouts, traits, and strategies to maximize in-game bonuses.

### Screen-by-screen architecture

Four bottom-nav tabs, designed for thumb ergonomics inside Telegram.

**Tab 1: The Penthouse (Idle & Progression Hub)**
- Visuals: isometric, animated cyberpunk hideout that evolves from a flickering basement server room to a luxury high-rise penthouse as net-worth milestones unlock.
- Interactions: tap-to-mine core, active bot upgrades, equipping eccentric traits (e.g., Diamond Hands, Syndicate Boss).

**Tab 2: The Terminal (Rogue-Lite Mini-Games)**
- Visuals: neon-soaked terminal grid with security laser puzzles and biometric locks.
- Interactions: 30-second reflex and puzzle runs. Randomized modifiers ("Corrupted Firewall", "Overclocked Speed") keep every run unpredictable.

**Tab 3: The Syndicate Map (Async PvP Heists)**
- Visuals: tactical radar grid showing target vaults, rival players, and cooperative guild objectives.
- Interactions: dispatch covert agents or the main crew to raid targets. Incoming raid alerts arrive as push notifications.

**Tab 4: The Seasons (Live-Ops)**
- Visuals: flashing season board showing whether the current 48-hour cycle is a Surge Season (high risk, high reward) or a Lockdown Season (defensive reserve locks and cost-cut puzzles).

### Telegram-native social and viral loops

- **Group chat "Vault Boss" raids:** Syndicate leaders summon a rogue AI Vault Boss inside a group chat. Members tap collaboratively to crack the security code before a 5-minute timer expires, splitting a bounty pool.
- **One-tap Story flex cards:** Players export a stylized card showing hideout tier, rarest loot drop, and ranking badge to Telegram Stories.

---

## Part 1: The Seasons Tab (Surge / Lockdown Cycles)

The Seasons tab shifts the game's meta every 48 hours, preventing idle fatigue and forcing players to adapt their strategies.

```
+---------------------------------------------------+
| [🗓️ Season: SURGE] [⏱️ 14h 22m Left]              | <-- Season Status Header
| Season bonus: 2.0x tap yield | Risk: HIGH    [⚙️] |
+---------------------------------------------------+
|                                                   |
|             [ T H E  S E A S O N S ]             |
|           ( In-game season & event board )        |
|                                                   |
|         ⚡ [ SURGE SEASON ACTIVE ] ⚡             |
|                                                   |
|    ┌─────────────────────────────────────────┐    |
|    │ [ Reserve Vault ]   [ Cost-Cut Matrix ] │    |
|    │ [ Event: SYNC SPIKE (Active 8m) ]       │    |
|    └────────────────────┬────────────────────┘    |
|                         │                         |
+---------------------------------------------------+
| 🔄 REBALANCE LOADOUT | (Shift Strategy for Lockdown) |
|                                                   |
|  [ 🔒 LOCK RESERVE ] -> (Bonus: +25% in-game)     | <-- Primary CTA
|                                                   |
+---------------------------------------------------+
| 🏠 Penthouse | ⚡ Terminal | 🗺️ Syndicate | 🗓️ Seasons | <-- Bottom Nav Bar
+---------------------------------------------------+
```

- **Surge Season (48h cycles):** Tapping yields are doubled, bot earnings spike, and rogue-lite payout pools grow. Defense vulnerabilities also spike, making players prime targets for Syndicate raids.
- **Lockdown Season (alternate 48h cycles):** High-speed tapping is penalized by "Security Corrections." Players pivot to Reserve Vault locks and cost-cut puzzles in the Terminal to protect their in-game balance.
- **Flash events:** Sudden 15-minute "Sync Spike" or "Breach Cascade" events trigger instant Telegram push notifications.

---

## Complete Master UX Blueprint

### A. Experience brief

- **Product:** GWAPOHOLICS, a high-retention, cyberpunk-themed Telegram Mini App combining idle progression, rogue-lite action, async PvP turf wars, and in-game seasonal cycles.
- **Target audience:** Web3 natives, crypto-culture enthusiasts, and mobile-first gamers looking for fast, high-stakes interactive loops inside Telegram.
- **Emotional response:** ambition, urgency, social pride, tactical tension, and the thrill of the grind.

### B. Core game loop (self-sustaining in-game economy)

- **Earn & Upgrade (Penthouse tab):** Accumulate `$GWAP` passively via automated bots and active tapping to upgrade the hideout from a basement server room to a luxury high-rise penthouse.
- **Multiply & Test Skill (Terminal tab):** Spend energy tokens on 30-second rogue-lite hacking mini-games with randomized modifiers to multiply earnings.
- **Attack & Defend (Syndicate tab):** Deploy covert agents in asynchronous heists against rival vaults, or coordinate guild boss fights inside group chats.
- **Adapt to season shifts (Seasons tab):** Rotate strategies every 48 hours between Surge Season expansion and defensive Lockdown Season reserves.

### C. Screen architecture (4-tab navigation dock)

`🏠 Penthouse` (Idle & Growth) → `⚡ Terminal` (Rogue-Lite) → `🗺️ Syndicate` (Async PvP Heists) → `🗓️ Seasons` (Live-Ops)

- **Tab 1, The Penthouse (progression hub):** Isometric visual evolution, tap-to-earn core, bot fleet management, and eccentric trait customization (Diamond Hands, Day Trader).
- **Tab 2, The Terminal (action core):** CRT neon hacker grid, 30-second reflex challenges, randomized security modifiers, and high-risk payout multipliers.
- **Tab 3, The Syndicate Map (social PvP):** Tactical radar grid, target selection for async heists, vault defense shields, and group chat boss summon triggers.
- **Tab 4, The Seasons (live-ops):** Season board, 48-hour Surge/Lockdown toggles, Reserve Vaults, and flash events.

### D. Telegram-native viral and social loops

- **One-tap Story flex cards:** Export cinematic visual summaries of hideout tiers, net-worth rankings, and rare loot directly to Telegram Stories.
- **Group chat "Vault Boss" raids:** Summon cryptographic AI bosses into group chats; members tap collaboratively to crack codes and split bounties.
- **Async push notifications:** High-stakes alerts for inbound rival raids (e.g., "@CryptoKing breached your vault! Retaliate now!") to drive immediate re-engagement.

### E. Motion and haptic polish

- **Haptic feedback:** Contextual Telegram WebApp haptic triggers (`impactOccurred('light' | 'medium' | 'heavy')`) mapped to tap-to-mine, mini-game decryption nodes, and raid confirmations.
- **Visual atmosphere:** Deep cyberpunk color grading (neon cyans, deep purples, laser ambers), with dynamic lighting shifts that respond to real-world time and the active season.

### F. Monetization (deferred, not built)

- **Planned rails:** Telegram Stars, Telegram gifts, and GRAM (TON).
- **Gates before any real-value purchase:**
  - Legal review of the purchase flow and target markets.
  - A refund design and purchase ledger that keeps settlement idempotent (`AGENTS.md` rule 5).
  - A check of Telegram's current Mini App payment rules before choosing a rail.
  - Separate founder approval for any TON DNS change (`AGENTS.md` rule 8).
- **Cash-out stays out of scope.** `G` and `$GWAP` cannot be withdrawn, transferred, redeemed, or exchanged (`README.md`, `docs/LEGAL_DISCLOSURES_DRAFT.md`). Changing that is a separate decision.
- **Gift resale exposure:** Telegram gifts can change hands after purchase, so any item sold as a gift carries resale exposure. Confirm this before selling gifts.

---

## Open questions (for founder decision before any v2 work)

1. **Naming:** The planned in-game unit is `$GWAP`, but the app and legal copy say `G`. Which name ships, and when does the copy change?
2. **Legal review:** Which markets need review for the season, reserve, and event mechanics, and for the section F monetization rails?
3. **PvP:** Should player-vs-player mechanics be designed as a separate v2 track with their own safety and moderation review?

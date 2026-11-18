# GWAPOHOLICS v2 Creative UX Blueprint (concept)

> **Status: concept only. Not approved for implementation.**
>
> This blueprint is outside v1 scope. Player interaction, additional game modes, a tradable token, staking/yield, and price tickers are excluded from v1 until separately reviewed (`docs/V1_PRODUCTION_PLAN.md`). Any Solana token launch requires separate founder approval (`AGENTS.md` rule 8, issue #34). The token, staking, and market-event mechanics also require legal review before any design or build work.

## Scope conflicts with v1

| Blueprint element | Current v1 position | Source |
| --- | --- | --- |
| Earn `$GWAP` through bots and tapping | No Solana token exists. Balance is non-transferable virtual `G` with no cash value. | `README.md`, `AGENTS.md` rule 5 |
| Staking vaults, "+25% APY", liquidity lockups | Out of scope. G cannot be transferred, exchanged, or redeemed. | `docs/LEGAL_DISCLOSURES_DRAFT.md` |
| Live `$GWAP` price ticker, Bull/Bear market index, "Whale Pump" and "Liquidation Cascade" events | Out of scope. Players are told not to make financial decisions based on game content. | `docs/LEGAL_DISCLOSURES_DRAFT.md` |
| Async PvP heists, vault breaches, group boss raids, rival-breach push alerts | Player interaction is out of v1 scope. | `docs/V1_PRODUCTION_PLAN.md` |
| Terminal minigames, Penthouse idle loop | Additional game modes are out of v1 scope. Idle income would need new server-side accrual; v1 settles per quest with command receipts. | `docs/V1_PRODUCTION_PLAN.md`, `README.md` |

---

## Overview

### Unified master game loop

- **Earn & Upgrade (Hideout):** Players idle-tap or passively generate GWAP to upgrade their cyberpunk hideout, unlocking higher-tier automated bots and passive income multipliers.
- **Risk & Multiply (Rogue-Lite Mini-Games):** Players spend accumulated energy tokens on fast-paced "Vault Crack" mini-games. Success multiplies hourly earnings; failure triggers a brief cooldown.
- **Attack & Defend (Async Heists):** With higher hideout tiers and stacked multipliers, players launch async heists against rival vaults or syndicate targets to steal large loot pools.
- **Adapt or Perish (Bull/Bear Seasons):** Every 48 hours, market conditions shift, forcing players to change hideout loadouts, traits, and strategies to maximize yield.

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

**Tab 4: The Exchange (Live-Ops & Seasons)**
- Visuals: volatile, flashing live ticker showing whether the current 48-hour cycle is a "Bull Run" (high risk, high reward) or "Bear Market" (defensive staking and arbitrage).

### Telegram-native social and viral loops

- **Group chat "Vault Boss" raids:** Syndicate leaders summon a rogue AI Vault Boss inside a group chat. Members tap collaboratively to crack the security code before a 5-minute timer expires, splitting a bounty pool.
- **One-tap Story flex cards:** Players export a stylized card showing hideout tier, rarest loot drop, and ranking badge to Telegram Stories.

---

## Part 1: The Exchange Tab (Bull/Bear Seasons)

The Exchange tab introduces macro-economic volatility, preventing idle fatigue by shifting the game's meta every 48 hours and forcing players to adapt their strategies.

```
+---------------------------------------------------+
| [📈 Market Cycle: BULL RUN] [⏱️ 14h 22m Left]     | <-- Market Status Header
| Index: 9,842.50 (+18.4% 24h)               [⚙️] |
+---------------------------------------------------+
|                                                   |
|             [ T H E  E X C H A N G E ]            |
|         ( Live Volatility & Macro Ticker )        |
|                                                   |
|         🐂 [ BULL RUN ACTIVE ] 🐂                 |
|       Yield Multiplier: 2.0x | Risk: HIGH         |
|                                                   |
|    📈 $GWAP Live Ticker: 0.004212 (+4.2%)         |
|                                                   |
|    ┌─────────────────────────────────────────┐    |
|    │ [ Staking Vault ]  [ Arbitrage Matrix ] │    |
|    │ [ Flash Event: WHALE PUMP (Active 8m) ] │    |
|    └────────────────────┬────────────────────┘    |
|                         │                         |
+---------------------------------------------------+
| 🔄 REBALANCE LOADOUT | (Shift Strategy for Bear)  |
|                                                   |
|  [ 💎 LOCK STAKE POOL ] -> (Yield: +25% APY)      | <-- Primary CTA
|                                                   |
+---------------------------------------------------+
| 🏠 Penthouse  | ⚡ Terminal  | 🗺️ Syndicate | 📈 Exch| <-- Bottom Nav Bar
+---------------------------------------------------+
```

- **Bull Run mode (48h cycles):** Tapping yields are doubled, bot earnings spike, and rogue-lite payout pools grow. Defense vulnerabilities also spike, making players prime targets for Syndicate raids.
- **Bear Market mode (alternate 48h cycles):** High-speed tapping is penalized by "Market Corrections." Players pivot to defensive staking, liquidity lockups, and cost-cutting arbitrage puzzles in the Terminal to protect net worth.
- **Flash anomalies:** Sudden 15-minute "Whale Pump" or "Liquidation Cascade" events trigger instant Telegram push notifications.

---

## Complete Master UX Blueprint

### A. Experience brief

- **Product:** GWAPOHOLICS, a high-retention, cyberpunk-themed Telegram Mini App combining idle progression, rogue-lite action, async PvP turf wars, and live-market macroeconomic cycles.
- **Target audience:** Web3 natives, crypto-culture enthusiasts, and mobile-first gamers looking for fast, high-stakes interactive loops inside Telegram.
- **Emotional response:** ambition, urgency, social pride, tactical tension, and the thrill of the grind.

### B. Core game loop (self-sustaining economy)

- **Earn & Upgrade (Penthouse tab):** Accumulate `$GWAP` passively via automated bots and active tapping to upgrade the hideout from a basement server room to a luxury high-rise penthouse.
- **Multiply & Test Skill (Terminal tab):** Spend energy tokens on 30-second rogue-lite hacking mini-games with randomized modifiers to multiply earnings.
- **Attack & Defend (Syndicate tab):** Deploy covert agents in asynchronous heists against rival vaults, or coordinate guild boss fights inside group chats.
- **Adapt to macro shifts (Exchange tab):** Rotate strategies every 48 hours between aggressive Bull Run expansion and defensive Bear Market staking.

### C. Screen architecture (4-tab navigation dock)

`🏠 Penthouse` (Idle & Growth) → `⚡ Terminal` (Rogue-Lite) → `🗺️ Syndicate` (Async PvP Heists) → `📈 Exchange` (Macro Seasons)

- **Tab 1, The Penthouse (progression hub):** Isometric visual evolution, tap-to-earn core, bot fleet management, and eccentric trait customization (Diamond Hands, Day Trader).
- **Tab 2, The Terminal (action core):** CRT neon hacker grid, 30-second reflex challenges, randomized security modifiers, and high-risk payout multipliers.
- **Tab 3, The Syndicate Map (social PvP):** Tactical radar grid, target selection for async heists, vault defense shields, and group chat boss summon triggers.
- **Tab 4, The Exchange (live-ops economy):** Volatile live market tickers, 48-hour Bull/Bear seasonal toggles, staking vaults, and flash market events.

### D. Telegram-native viral and social loops

- **One-tap Story flex cards:** Export cinematic visual summaries of hideout tiers, net-worth rankings, and rare loot directly to Telegram Stories.
- **Group chat "Vault Boss" raids:** Summon cryptographic AI bosses into group chats; members tap collaboratively to crack codes and split bounties.
- **Async push notifications:** High-stakes alerts for inbound rival raids (e.g., "@CryptoKing breached your vault! Retaliate now!") to drive immediate re-engagement.

### E. Motion and haptic polish

- **Haptic feedback:** Contextual Telegram WebApp haptic triggers (`impactOccurred('light' | 'medium' | 'heavy')`) mapped to tap-to-mine, mini-game decryption nodes, and raid confirmations.
- **Visual atmosphere:** Deep cyberpunk color grading (neon cyans, deep purples, laser ambers), with dynamic lighting shifts that respond to real-world time and the active Exchange market season.

---

## Open questions (for founder decision before any v2 work)

1. Is the economy a token economy (`$GWAP`) or an educational virtual-currency economy (`G`)? The two conflict under the current v1 rules.
2. Which legal review covers staking, APY, and price-driven market events, and in which markets?
3. Should player-vs-player mechanics be designed as a separate v2 track with their own safety and moderation review?

# GWAPOHOLICS v2 Brainstorm

**Status: brainstorm only.** Nothing here is approved, scheduled, or part of v1. Ideas are not decisions.

Tags used below:
- **[verified]**: checked against Telegram's Bot API changelog or Mini Apps docs on 2026-11-18
- **[repo]**: checked against this repository
- **[modeled]**: from a simulation or table in the source article, not tested with players
- **[unverified]**: a claim from the source article that could not be confirmed
- **[idea]**: brainstorm only, no evidence yet

---

## 1. Platform facts to design around

- **Origin rule [verified].** Telegram.WebApp methods are blocked from origins other than the registered Mini App domain. This turns on automatically for all Mini Apps on July 20, 2026, per the Bot API 10.2 entry (released July 14, 2026). Bots can opt out in @BotFather, which makes them responsible for keeping the Mini App free of links to untrusted sites.
- **Storage limits [verified].** DeviceStorage allows up to 5 MB per user per bot. SecureStorage allows up to 10 items per user.
- **CloudStorage limits [unverified].** Not found in the Mini Apps docs section that was read.
- **initData validation [verified / repo].** Telegram defines `secret_key` as the HMAC-SHA-256 signature of the bot token, with the constant string `WebAppData` as the key. Telegram gives no fixed `auth_date` limit, only a recommendation to check it. The repo uses one hour.
- **sendWidget, WidgetQuery, HTML widgets [verified as not found].** Not in the recent changelog entries read. Do not design around them.

## 2. Economy and progression

- **Server-timestamped accrual with an offline cap [idea].** Compute idle earnings from server UTC timestamps, clamp to a cap, and reconcile on app resume. v1 settles per quest with command receipts, so any idle loop would be new server logic.
- **Integer balances [idea].** Store balances as integers in the smallest unit so long-running accrual doesn't drift. Check the current ledger type first.
- **Payback pacing [modeled].** Early upgrades should pay back inside one short session, and later tiers should feel like a promotion. The article's refined curve pays back Level 1 in about 23 minutes, Level 30 in about 2.2 hours, and Level 70 in about 26 hours. The arithmetic checks out, but the inputs are invented.
- **Keep taps meaningful [modeled].** Track active-tap share of income by tier. The article's refined curve moves active share from 62.5% at Tier 1 to 23.7% at Tier 10. Test this in playtests before adopting it.
- **Risk streaks [idea].** A skilled player should beat an unskilled one on high-risk runs. The article's streak numbers have no transition model, so rebuild them before relying on them.
- **Season modifiers [idea].** Surge and Lockdown seasons change in-game rules only. Keep the wording in-game, with no market or yield language, consistent with the 2026-11-18 decision.

## 3. Social and PvP (parked behind a future PvP track)

- **Upset floor [modeled].** A logistic win chance on the power ratio, clamped at both ends, keeps upsets possible. The article's numbers appear to fit a steepness near 3.2 with clamps at 10% and 92%, but the formula is not stated. Reproduce it in code first.
- **Sub-linear boss HP [modeled].** The article's group-raid numbers fit roughly 2,500 × N^0.85. A 100-player raid would then have about 50 times the HP of a solo boss, not 100 times.
- **Message limits [unverified].** The article's messaging limits could not be confirmed. Check Telegram's bot limits before designing raid alerts.

## 4. Telegram features to evaluate

- **Stars subscriptions and passes [unverified].** Deferred under section F of the blueprint. The 10.2 entry does cover payment subscription updates. The article's 10,000-Star cap and billing-period details are unconfirmed.
- **Add to home screen after a first win [partly verified].** The 8.0 changelog entry appears to add a home-screen shortcut method, which fits the article's use.
- **Emoji status for season leaders [partly verified].** The 8.0 entry lets users confirm a custom emoji as their status.
- **Share flex cards to Stories [unverified].** Not checked in this review.
- **HTML widgets [verified as not found].** Drop unless a later changelog confirms them.

## 5. Sensory (once audio is planned)

- **Sprite-based sound effects [idea].** One audio sprite sheet to cut network requests.
- **Pitch on combo [idea].** Raise playback rate across a combo. Test whether the pitch shift sounds acceptable.
- **Audio resume on real devices [unverified].** The claim that Web Audio stays suspended after screen lock comes from a community bug report. Treat it as a hypothesis and test on physical iOS and Android devices.
- **Haptic throttling [idea].** Coalesce haptics during fast tapping. The repo already guards haptic calls, so this extends existing code. [repo]
- **Reduced motion [repo].** The repo already has a motion preference and reduced-motion support. Use it as the gate for all juice effects.

## 6. Open questions for the session

1. Which v2 pillar goes first: economy depth, PvP, or sensory? (Section 7 ranks the features: mini-games first, then group raids.)
2. Is idle accrual a v2 requirement or an experiment?
3. Which Telegram features are worth the review cost?
4. Do the Telegram-only monetization rails in section F still hold?

## 7. Direction ranking (recorded 2026-11-18)

1. **High-stakes mini-games (Vault Crack) as the core loop.** Best fit with the tagline "Make the call. Own the consequences." Server-verifiable by replay, and no player-to-player value transfer.
2. **Group Vault Boss raids as the social layer.** Gives competitive social pull without PvP transfers. The bounty pool is minted from a capped house budget.
3. **Live-market seasons, reframed as Cycles.** A cheap retention lever. Keep the in-game modifiers only and drop market language.
4. **Competitive async heists last.** The strongest viral pull and the highest risk: player-to-player loss, moderation, and D4. Decide after group raids test appetite, and after counsel and PvP review.

## 8. Copy and wording rules (recorded 2026-11-18)

- **No betting language.** "Day Trader" is replaced with "Overclocker". Avoid "bet" and "wager".
- **No market or price language.** Avoid "whale", "pump", "bull", "bear", "ticker", "yield", "APY", and "staking".
- **Pseudonymous opponents.** Use crew names, not real Telegram usernames, in any alert or message.
- **Neutral notification copy.** No loss-pressure wording such as "you lost 25%... retaliate now." Opt-in only, with capped frequency.
- **Shared pools need a D4 answer.** Moving value into a shared vault counts as a transfer. Use a non-transferable contribution counter, or wait for counsel.
- **Naming.** Use "Cycles" for the 48-hour phases, because "SEASON 01" already labels the case files.

## Checks not yet done

- CloudStorage limits, if anyone plans to use CloudStorage.
- Full changelog history, only if someone plans to use a feature older than the recent entries.

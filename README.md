# GWAPOHOLICS

**Make the call. Own the consequences.**

GWAPOHOLICS is a Telegram-first cinematic business simulation from Tha GwapSpot. It teaches money and business decision-making through five fictional historically inspired quests.

## Project status

**v1 development.** Repository source is imported from the playable Vercel preview. The Telegram bot's production settings and domain were not changed.

- [Telegram bot: @GwapoholicsBot](https://t.me/GwapoholicsBot)
- Reserved game domain: `gwapoholics.ton`
- [Existing Vercel preview](https://gwap-telegram-business-77archyhr-bigdaddygwaps-projects.vercel.app/?demo=1)
- [Approved Adobe character and scene board](https://firefly.adobe.com/boards/id/urn:aaid:sc:US:32f3155f-9932-4f18-a211-0ea55372e883)

## v1 gameplay

- Start with **1,000 virtual G coins**.
- Each of five cases has four linked decisions and three options per decision.
- Cases settle once: finished quests cannot be replayed to farm rewards.
- Below **100 G**, missions lock; educational recovery is available with a cooldown.
- G coins are fictional and **cannot be withdrawn or exchanged**. No Solana token has been minted or launched.

## Run

Requires Node.js 22+; no production npm dependencies.

```bash
npm run check
npm test
npm run dev
```

Then open http://localhost:4173/?demo=1. This browser demonstration does not replace Telegram WebApp integration.

## Security / economy status

This imported prototype saves progress to **localStorage** on the user's device. Browser balances can be changed and are **not trusted**. Before accepting public player balances, quests, or rewards, implement server-validated Telegram `initData`, a durable authoritative ledger, atomic settlements, rate limits, and recovery cooldown enforcement. Never put Telegram bot tokens or secret keys into client-side code.

## Production roadmap

1. ✅ Import playable source and baseline automated checks.
2. Integrate the **Streaming Pivot** cinematic experience in an isolated feature branch and preview. *(Sprint 1A: full-screen Story Mode — see [notes](docs/CINEMATIC_SPRINT_1A.md).)*
3. Expand the same scene engine to the other four quests.
4. Build server-side authenticated persistent player progress.
5. Run iPhone/Android Telegram QA, optimize assets, private beta.
6. Request explicit approval before any live production release.

See [v1 plan](docs/V1_PRODUCTION_PLAN.md) and [scene asset pipeline](docs/ASSET_PIPELINE.md).

## Provenance

The source was recovered from the existing founder-approved Vercel preview on November 13, 2026. The existing gameplay engine and five case definitions remain unchanged. Historical references are educational scenarios, not real financial records.

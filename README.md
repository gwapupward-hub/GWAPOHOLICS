# GWAPOHOLICS

**Make the call. Own the consequences.**

GWAPOHOLICS is a Telegram-first, story-driven business simulation from **Tha GwapSpot**. Players practice financial judgment through fictional scenarios inspired by real business history.

## Status

**v1 production development — not launched.** This repository is being initialized from the playable Vercel prototype; the public production deployment and Telegram bot are not changed by repository commits.

- Telegram bot: [@GwapoholicsBot](https://t.me/GwapoholicsBot)
- Domain reserved by founder: `gwapoholics.ton`
- Existing prototype preview: https://gwap-telegram-business-77archyhr-bigdaddygwaps-projects.vercel.app/?demo=1
- Approved cinematic creative board: https://firefly.adobe.com/boards/id/urn:aaid:sc:US:32f3155f-9932-4f18-a211-0ea55372e883

## Gameplay rules (prototype)

- Start with **1,000 virtual G coins**.
- Play five four-decision business quests.
- Decisions affect one final result; a completed quest cannot be farmed for rewards.
- Below **100 coins**, regular missions lock and an education-based recovery route is offered.
- All balances are **simulated, non-transferable, and have no cash value**. There is currently **no Solana token, withdrawal, exchange, or real-money wagering** in the game.

## Run locally

Requires Node.js 22+ for the automated test suite. The app is a static ES-module website and has no production dependencies.

```bash
npm test
npm run check
npm run dev
```

Then open http://localhost:4173/?demo=1 for a local demo. The app is designed for Telegram WebApp; browser demo mode is only for testing.

## Architecture warning

The imported prototype stores game state in localStorage. **It is not authoritative or tamper-resistant.** Server-side Telegram `initData` verification and an atomic player ledger are **mandatory before a public economic/multiplayer launch**. Never put a bot token or a financial credential in browser code.

## Next milestones

1. Maintain the approved economic logic and baseline regression tests.
2. Integrate **The Streaming Pivot** cinematic storyboard, character narration, and reduced-motion alternatives in a feature branch.
3. Complete the other four chapters using the shared scene runtime.
4. Implement authenticated, server-persisted player progress and idempotent settlement.
5. Complete Telegram iOS/Android QA and a private beta.
6. Release to production after explicit release approval.

See [docs/V1_PRODUCTION_PLAN.md](docs/V1_PRODUCTION_PLAN.md) and [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md).

## Provenance

Initial application files were recovered from the founder's existing Vercel preview on November 13, 2026. The gameplay engine and case definitions are preserved. Historical scenarios are fictional teaching exercises, not actual company financial records.

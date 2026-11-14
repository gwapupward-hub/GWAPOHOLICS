# GWAPOHOLICS

**Make the call. Own the consequences.**

GWAPOHOLICS is a cinematic, Telegram-native business education game from Tha GwapSpot. Five fictional scenarios teach financial and business decision-making through story-driven consequences.

## v1 status — code complete, public release not approved

The `feat/v1-private-beta-release-candidate` branch is an implemented, tested **v1.0.0 release candidate**, not a production launch. Preview authentication and persistence are enabled for the private `@TestGwap_bot` only. The official `@GwapoholicsBot`, Vercel production, `main` and the owned `gwapoholics.ton` domain have not been updated.

- [Private test bot: @TestGwap_bot](https://t.me/TestGwap_bot) — open the Mini App inside Telegram for authenticated progress.
- [Browser-only cinematic demo](https://gwap-telegram-business-1i0jiycu2-bigdaddygwaps-projects.vercel.app/?demo=1) — uses local demo data, not a real player account.
- [Draft v1 release PR](https://github.com/gwapupward-hub/GWAPOHOLICS/pull/11) — targets `main`, must not merge without separate founder approval.
- [Release acceptance and operations runbook](docs/V1_RELEASE_RUNBOOK.md)
- [Adobe character and scene board](https://firefly.adobe.com/boards/id/urn:aaid:sc:US:32f3155f-9932-4f18-a211-0ea55372e883)

## Complete v1 gameplay

- Five full-screen cinematic quests, nine illustrated scenes each (45 total), character/typewriter narration, staged props, transitions and reduced-motion support.
- Four linked player decisions per quest, unique outcome bands and a server-settled balance.
- Each new Telegram player starts with **1,000 virtual G coins**. At under **100 G**, missions lock, with limited educational recovery after the required cooldown.
- Quests can settle **only once**; duplicate network requests return the previously saved result.
- Game balance, progress, coin ledger and completed quests persist through a dedicated Neon/PostgreSQL store and can be resumed by the same Telegram identity on another device.
- G coins are **not** a tradable asset, have **no cash value**, and **cannot** be withdrawn, exchanged or redeemed. No Solana token has been deployed.

## Development and quality checks

Node.js 22+ and npm are required. The live adapter depends on `pg`.

```bash
npm install
npm run check
npm test
npm run dev
```

Open `http://localhost:4173/?demo=1` to play without Telegram or server credentials. Never use browser demo state as authoritative data.

CI on the release branch runs `baseline`, `mobile-engines`, and `postgres-ledger`. The PostgreSQL integration job provisions disposable test storage and checks all five cases, idempotent settlement and cross-instance state. The main branch has an active ruleset requiring all three checks.

## Authenticated Preview architecture

- `POST /api/session`: validates Telegram raw `initData`, then issues a short-lived HttpOnly, Secure session.
- `GET /api/game`: returns only player-visible state.
- `POST /api/game`: authenticated `start`, `choose`, `recover` with unique command receipts.
- PostgreSQL serializes a player's writes, enforces one settlement per quest and limits new commands to 30/player/60 seconds.
- `GWAP_SESSION_SECRET_PREVIOUS` supports safe one-hour rotation of the signing key.
- Preview-only server secrets: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `GWAP_SESSION_SECRET`. Never expose them in client bundles, screenshots or repository content.

See [Authenticated API](docs/AUTHENTICATED_API.md) for request contract and deployment constraints.

## Remaining release acceptance

Physical iOS and Android Telegram WebView QA for all five quests, tested cross-device continuity, offsite backup/restore, ingress rate limiting and monitoring, a small private tester cohort, and separate approval for production infrastructure, domain and official bot. **Do not treat green CI or a READY Preview as permission for public release.**

## Provenance

Original gameplay was recovered from the founder-approved Vercel preview on November 13, 2026, preserving the canonical five-case game engine while upgrading its presentation and authenticated persistence. Historical references are educational fiction, not verified financial outcomes.

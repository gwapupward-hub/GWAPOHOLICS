# GWAPOHOLICS — Authenticated Preview API

The `feat/v1-private-beta-release-candidate` branch is running an authenticated Preview behind the private `@TestGwap_bot` launch flow. The public `main` branch and official `@GwapoholicsBot` are **not** using this backend yet. Do not put a real token or database URL in Git, source code, issue comments or screenshots.

## Preview-only server settings
- `TELEGRAM_BOT_TOKEN`: token for **@TestGwap_bot** only.
- `GWAP_SESSION_SECRET`: independent random string of at least 32 bytes.
- `GWAP_SESSION_SECRET_PREVIOUS`: **optional**, only during a one-hour signing-key rotation; never reuse the Telegram token.
- `DATABASE_URL`: private pooled TLS Postgres URL supplied by the dedicated Neon Preview integration.

The database uses `server/sql/001_initial.sql`. A read-only schema readiness check is available with `npm run db:check` in a trusted environment.

## HTTP interface
- `POST /api/session`, JSON `{"initData":"<raw Telegram.WebApp.initData>"}`, `X-GWAP-Request: 1`: verifies Telegram HMAC and freshness; returns a one-hour secure HttpOnly cookie. Never log the raw `initData`.
- `GET /api/game`: authenticated public player snapshot; no random seed or future payoffs.
- `POST /api/game`: `start`, `choose` and `recover`, with a unique idempotency `requestId`.
- `POST /api/logout`: clears the session cookie.

All POSTs enforce HTTPS same-origin, an application request header, JSON content type, and no-store responses. A missing or invalid session returns 401. Missing required server configuration fails closed. Command receipts and coin settlements are committed atomically with per-player Postgres advisory locks.

**Durable write budget:** 30 new game commands per player per rolling 60 seconds (PostgreSQL, shared by server instances). Duplicate command requests with the same matching idempotency key return their previous response and do not spend a second coin settlement. Excess requests return 429 `rate_limited` with `Retry-After: 60`. This limit does not replace a separate ingress WAF rule for abusive sign-in traffic.

Browser `?demo=1` uses local, simulated data only and cannot affect authenticated accounts. Opening the Preview inside Telegram without that query parameter is mandatory for the real private-beta flow.

## Verification and release controls
`baseline`, `mobile-engines`, and `postgres-ledger` CI checks cover syntax, security, mobile UI, and real disposable PostgreSQL persistence. The latter now tests a server-backed completion of **all five** quests.

Open items before a public release: manual iOS/Android Telegram WebView acceptance, verified offsite backup/restore for Preview data, ingress rate limiting and monitoring, private tester cohort, and separate founder authorization for production.

See [V1 release runbook](./V1_RELEASE_RUNBOOK.md).

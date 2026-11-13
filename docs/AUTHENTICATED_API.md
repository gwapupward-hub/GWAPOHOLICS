# Authenticated preview backend

Code added: Telegram signature verification, signed HttpOnly sessions, same-origin and CSRF guards, virtual-coin commands, transactional Postgres adapter, one-settlement constraints, command response idempotency.

**Not live:** API routes reject missing credentials or database; no bot settings or production database were changed.

Environment variables — Preview only:
- TELEGRAM_BOT_TOKEN: BotFather bot token, set directly in Vercel, never in Git or chat.
- GWAP_SESSION_SECRET: independently generated secret, minimum 32 bytes.
- DATABASE_URL: pooled, SSL PostgreSQL connection to a new isolated GWAPOHOLICS database.

Review/apply server/sql/001_initial.sql only in a new empty database.

Routes:
- POST /api/session, JSON body {"initData":"raw Telegram.WebApp.initData"}, X-GWAP-Request: 1 — validates HMAC and issues Secure HttpOnly cookie.
- GET /api/game — public state; no seed or hidden options.
- POST /api/game — start/choose/recover, with unique requestId.
- POST /api/logout — clears cookie.

Every POST requires same-origin and X-GWAP-Request: 1. Browser demo ?demo=1 remains local-only until the client integration is finished.

Missing before private beta: dedicated database provisioning/migration, real authenticated Telegram QA, cross-device persistence, distributed rate limits and audit logging, backup/restore plan and additional operational checks.

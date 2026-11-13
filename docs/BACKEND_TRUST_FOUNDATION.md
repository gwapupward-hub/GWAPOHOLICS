# Backend Sprint 0 — Telegram trust and authoritative ledger

Status: foundational code and draft schema only; NOT a live backend. The browser demo still uses editable localStorage and must not be trusted.

## Implemented
- Server-only Telegram raw initData verifier (HMAC-SHA256, constant-time comparison, duplicate-key rejection, session age validation).
- Cryptographic positive and negative tests.
- Postgres draft schema: players, quest runs, append-only virtual ledger, unique settlement per case, idempotent operations.

Official reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

## Next engineering phase
1. Configure BOT_TOKEN server-only in Vercel; no credentials in GitHub or public client.
2. Implement HTTPS POST /api/session to validate raw initData, issue short-lived HttpOnly Secure SameSite cookie and enforce CSRF checks.
3. Provision Postgres development DB; validate and apply schema with reviewed migrations.
4. Build authenticated game endpoints for profile, mission start, decision, settlement, and recovery.
5. Enforce canonical cases and choices on the server. Never accept client balance, payoff, seed, result band, or recovery timestamp.
6. In one transaction SELECT FOR UPDATE the player, settle the unique case and write exactly one ledger entry; retry handling must be safe under concurrency.
7. Test tampering, stale session, duplicate submission, concurrent settlements, refresh/resume and recovery cooldown.

Release rules: demo-only local balance until backend is integrated and reviewed. No public token, withdrawals or transferable coins. No secrets, real keys or authenticated sessions are included in this PR.

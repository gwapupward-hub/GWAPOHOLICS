# Backend Sprint 0 — Authoritative command engine progress

Implemented:
- Pure Node Telegram signature verifier with timestamp and duplicate-field protection.
- Server-only command engine using canonical game-core logic.
- Commands for snapshot, mission start, each decision, and educational recovery.
- Four decisions settle exactly once within the same caller-provided database transaction.
- Public serialization excludes internal random seed, future payoffs and raw ledger state.
- Idempotency receipts prevent duplicate results under repeated or concurrent requests.
- Node tests use a serialized in-memory adapter. **This is a test harness, not durable persistence.**

## Blocking before production
- Provision a **dedicated** PostgreSQL instance. The connected Neon organization is Vercel-managed and rejected direct new-project creation. Do not reuse unrelated projects or databases.
- Implement real transactional adapter with per-user row locks and uniqueness constraints.
- Complete HTTPS authenticated Telegram session API, secure cookies, CSRF and rate limits.
- Connect client state to server endpoints, with a deliberate migration policy for untrusted local demo progress.
- Test real concurrent transactions and persistence across devices.
- Verify Telegram bot launch auth on iPhone/Android, with release logging and operations.

This branch is intentionally kept draft. No API endpoints, credentials, database writes or live gameplay are enabled.

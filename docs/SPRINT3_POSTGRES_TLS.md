# Sprint 3 — PostgreSQL TLS compatibility and operational release gate

## Evidence
Vercel's recent runtime error clusters included two PostgreSQL driver warnings on an older Preview deployment:
`sslmode=prefer`, `require`, and `verify-ca` currently alias `verify-full` in the Node `pg` connection-string parser; a future major release may adopt weaker libpq-style semantics. The warning is not proof of failed queries.

The app constructs a `pg.Pool` with `connectionString: process.env.DATABASE_URL` in `server/postgres-store.mjs`. Do not print, paste, or commit that URL.

## Safe operator procedure (Preview only)
1. Verify which Neon Preview environment variable is consumed by the **deployed** release-candidate branch, not just `main`.
2. Inspect **only the SSL mode parameter** in the secret URL privately; do not copy the full URL into a ticket, logs or chat.
3. If it is `require`, `prefer`, or `verify-ca`, verify Neon endpoint certificate and hostname validation support. Prefer explicitly setting `sslmode=verify-full` to retain the current Node driver semantics. Do **not** use `uselibpqcompat=true` as a shortcut.
4. Apply a scoped Preview-only environment update using a secure secret-editing workflow, after confirming the exact variable and branch scope. A variable change may require a new Preview deployment; obtain approval before triggering it.
5. Confirm authenticated `GET /api/game`, a test decision, and durable state resume. Check logs for the warning, TLS failures, and connection timeouts.
6. Do not change the production database URL or expose credentials.

## Gate and rollback
- **Pass:** a tested Preview deployment connects with hostname-verified TLS and does not emit the compatibility warning.
- **Pending:** configuration inspected but no Preview redeploy/retest.
- **Fail:** certificate or hostname validation errors; stop, revert the scoped change securely and investigate provider configuration. Do not disable verification.
- Preserve the prior secret securely in the provider's normal rollback workflow; never store copies in Git.

## Remaining Sprint 3 requirements
- Execute the bounded WAF probe from an approved network with access to the verified Preview URL, and confirm firewall-event attribution.
- Assign incident owner and configure actual notifications; a written monitoring plan is not automated alerting.
- Physical Android acceptance remains deferred; do not mark as passed.
- No production promotion, official bot change, .ton routing, or token issuance without separate approval.

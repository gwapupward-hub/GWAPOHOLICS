# GWAPOHOLICS — Preview operations evidence (2026-11-15 UTC)

## Live firewall test — observed HTTP 429

- **Verified target:** Vercel deployment `dpl_Bn7YrqbnzT856qswxHuRzm4Wd9sm`, `READY`, `target: null` (Preview), from `feat/v1-private-beta-release-candidate` at `7fcab1c33cd73b89b201edabecb6ed5e53f4b988`.
- **Target host:** `gwap-telegram-business-r8brisqm4-bigdaddygwaps-projects.vercel.app`; route `POST /api/session`.
- **Active WAF rule:** `rule_gwapoholics_session_creation_ip_limit_1OYsn5`, 20 requests per IP per 60 seconds, fixed-window rate limiting.
- **Execution:** 2026-11-15T06:03:16Z, Vercel Sandbox `sbx_TfinithZzhEX6KRZUqXPU4yPSP6J`, region `iad1`, scoped outbound access to the verified Preview host. An inline equivalent of the bounded `scripts/verify-preview-waf.mjs` probe sent JSON `{}` without Telegram credentials; each request had a 5-second timeout; stop at first HTTP 429.
- **Observed:** 21 sequential requests: **HTTP 403 × 20**, followed by **HTTP 429 × 1** (21st request). The probe exited successfully.
- **Cleanup:** ephemeral non-persistent sandbox stopped 2026-11-15T06:03:46Z. No app deployment, credentials, production settings, database writes, or live-game commands were involved.
- **Interpretation:** live 429 was observed at the configured threshold, consistent with the active WAF rate-limit rule. A specific firewall event ID/rule attribution was **not available** through the queried Vercel tools. The initial 403 responses have not been attributed definitively to a specific layer.
- **Active-attack query:** returned no anomalies; this does not certify an absence of abuse.
- **Still missing:** success of legitimate, signed test-bot authentication after the rate-limit window; user-device acceptance is separate.

## Database TLS findings

- The PostgreSQL/pg compatibility warning persisted in Vercel runtime error clusters, with the last occurrence reported as **2026-11-15T04:28:27Z** on an older Preview deployment. No failed game query is proved by this warning alone.
- Vercel `DATABASE_URL` is a protected, Preview-scoped sensitive environment variable; the connector did **not** reveal its SSL mode. Do not print its hostname, username, password, or full value.
- The proposed compatibility fix in the Sprint 3 branch normalizes known legacy `sslmode` aliases to explicit `verify-full` in the application pool configuration, preserving current `pg` hostname-checking semantics. It is **not deployed or operationally validated**.
- After review and separate Preview-deployment authorization, retest real authenticated database operations and confirm that the warning disappears before calling the fix complete.

## Remaining operational gates

1. Inspect WAF Security events in Vercel UI if accessible, and record rule ID attribution for the 429 without identifying the test source IP publicly.
2. Validate signed test-bot launch and gameplay after the rate-limit window with normal device/network access.
3. Confirm Preview DB TLS fix with an actual deployed build and database query; no production promotion without approval.
4. Establish real monitoring notifications, incident owner, and escalation for session failures, connection errors, and settlement anomalies. Written procedures are not automated monitoring.
5. Complete the authorized device matrix when scheduled. Physical Android and full five-quest iPhone acceptance remain unverified; offsite restore drill remains a later public-production gate.

All findings relate to the isolated Preview environment; production was unchanged.

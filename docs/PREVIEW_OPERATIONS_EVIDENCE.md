# GWAPOHOLICS — Preview operations evidence (2026-11-15 UTC)

This is a **read-only** inspection of Vercel and GitHub, not a live attack simulation.

## Verified
- The newest inspected Preview deployment `dpl_Bn7YrqbnzT856qswxHuRzm4Wd9sm` reports `READY`, sourced from `feat/v1-private-beta-release-candidate` at commit `7fcab1c33cd73b89b201edabecb6ed5e53f4b988`.
- The active project firewall includes the enabled `POST /api/session` rule: 20 requests per IP per 60 seconds, fixed window.
- Vercel active-attack status returned an empty anomalies list at inspection time. This **does not prove** absence of abusive traffic.
- All three GitHub checks for PR #15 passed: CI, PostgreSQL ledger integration, and Mobile browser smoke.
- Preview runtime logs over a 30-minute window contained a PostgreSQL driver **SSL compatibility warning** on an older Preview deployment. It is a warning, **not evidence of a failed request**. The warning recommends explicitly setting `sslmode=verify-full` to retain the current verification semantics in future driver releases.

## Still unverified
- Whether the active WAF rule applies to the intended Preview URL and returns HTTP 429 after the configured threshold.
- A real Telegram authentication request succeeding after the rate-limit window.
- Physical Android testing and full five-quest iPhone acceptance.
- A production-quality monitoring/incident escalation workflow.
- Offsite restore drill (deferred; public-production gate).

## Next operational actions
1. Confirm the test bot's actual Preview URL and deployed commit before sending test traffic.
2. Perform a controlled Preview-only WAF rate-limit check from a dedicated source IP, with no live credentials in logs.
3. Review the PostgreSQL connection-string SSL mode **without revealing the connection string**; plan explicit `verify-full` if compatible with the provider's certificate configuration.
4. Record an owner and escalation path for session failures, 429 spikes, database connection errors, and duplicate-settlement alerts.
5. Continue device testing later as approved; do not treat it as passed.

No production settings, firewall policies, database records, or deployments were changed by this inspection.

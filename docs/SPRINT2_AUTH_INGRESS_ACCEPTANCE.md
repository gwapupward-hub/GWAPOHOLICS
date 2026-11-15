# Sprint 2 — Authentication ingress acceptance

## Existing Vercel WAF rule (read-only verification, 2026-11-14)
Project: `gwap-telegram-business-sim`.

The active Vercel firewall configuration includes an enabled rule named
`GWAPOHOLICS session creation IP limit` with:
- Request path exactly `/api/session`
- Request method `POST`
- Fixed-window limit: **20 requests per source IP per 60 seconds**
- Mitigation: `rate_limit`

The Vercel WAF rule is managed in Vercel, **not** by this repository. This document
records a configuration inspection, not an end-to-end rate-limit proof. Do not
add an in-memory limiter to serverless functions as a substitute for edge controls.

## Automated application boundary tests
`npm test` includes `tests/sprint2-session-boundary.test.mjs` verifying:
- Non-POST requests fail without session cookies.
- Wrong origin, missing mutation header, or incorrect content type fail closed.
- Expired Telegram signatures and unexpected JSON keys fail closed.
- A fresh signed Telegram launch issues a secure, private session cookie.

These tests do **not** simulate or exercise the Vercel WAF. They also do not
authorize public production rollout.

## Preview-only operational acceptance
1. Confirm the intended Preview deployment has the same active WAF configuration.
2. Use a dedicated test IP and test account; avoid shared/corporate NAT addresses.
3. Perform a small, controlled burst against **Preview only**; verify an HTTP 429
   after the configured threshold and a successful new window after 60 seconds.
   Do not stress production or collect real Telegram initData in logs.
4. Verify legitimate Telegram launch still works before and after the window.
5. Record timestamp, deployment identifier, response status counts, and whether
   a WAF rule was triggered; redact IPs, cookies, tokens, and Telegram identity.
6. If Vercel rules differ by environment or fail to match Preview, correct
   configuration before inviting private-beta users.

## Remaining gates
- Android physical Telegram WebView acceptance and all-five-quest device matrix.
- Authentication rate-limit observation in deployed Preview.
- Operational monitoring and incident response.
- Deferred offsite backup restore drill before public production launch.
- Separate founder approval before merge or production deployment.

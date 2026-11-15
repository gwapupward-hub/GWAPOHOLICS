# GWAPOHOLICS — private-beta Preview monitoring

## Current monitoring implementation

The proposed `.github/workflows/preview-monitor.yml` runs at minute 17 and 47 of each hour, UTC, **only from the default branch after merge**. It can also be started manually from GitHub Actions. It performs two credential-free probes against the pinned, inspected Vercel Preview deployment `dpl_Bn7YrqbnzT856qswxHuRzm4Wd9sm`:

1. `GET /api/game` without a session must return HTTP **401** and JSON `{"error":"sign_in_required"}`.
2. `POST /api/session`, same-origin `Origin`, `x-gwap-request: 1`, JSON `{}`, must return HTTP **400** and JSON `{"error":"invalid_request"}`.

The HTTP probes **passed** in an isolated Vercel sandbox on 2026-11-15; see `docs/PREVIEW_OPERATIONS_EVIDENCE.md`. They deliberately do **not** send valid Telegram launch data, create sessions, touch game balances, or verify PostgreSQL connectivity.

The scheduled workflow retries once, three seconds later. If it remains unhealthy, it fails the run and uses `issues:write` to open one GitHub issue titled **[GWAPOHOLICS Preview] Endpoint monitor failing**. Subsequent failing checks do not create duplicate issues. Once probes pass again, the workflow comments on and closes that issue. If issue creation is disabled or token permissions are insufficient, the workflow fails rather than falsely claiming notification succeeded.

## Operator setup and response

- **Owner:** assign a human repo maintainer to triage the monitor; an unassigned issue is not staffed coverage.
- **Notifications:** the owner must explicitly enable suitable GitHub Actions and Issues notifications. A GitHub issue is an *in-repository alert*, not verified push/SMS/email delivery. Do not describe this as 24/7 paging.
- **Activation:** after reviewing and merging the monitor PR and confirming workflow permissions, manually dispatch `GWAPOHOLICS Preview endpoint monitor` once. Verify the run succeeds and the expected request codes are visible. Only then treat periodic monitoring as active.
- **Failure:** inspect the GitHub run and Vercel runtime errors. Distinguish DNS, expired Preview deployment, Vercel access protection, session config loss, elevated 403/429, and application failure. Do not log or post secrets. If route ownership or endpoint contracts change, update tests and the pinned Preview URL deliberately.
- **Drift:** the pinned deployment is not `main`. A fresh release-candidate Preview deployment needs operator review and an explicit URL update; do not point this monitor at production by accident.
- **Cadence limitations:** GitHub scheduled workflows can be delayed or skipped. Monitoring is best-effort, not a guaranteed real-time uptime service.
- **Privacy:** never paste user Telegram `initData`, cookies, tokens, or database connection strings into Actions logs or issues.

## Still-open beta gates

- Live rate limiting returned HTTP 429 on request 21 on 2026-11-15, matching the configured 20/IP/60s rate; firewall event/rule ID attribution remains unverified.
- Authenticated test-bot launch, Postgres durable ledger write/resume, and SSL `verify-full` on a newly deployed Preview build remain unverified.
- Alert delivery to a named on-call human has not been independently verified.
- Physical Android/full quest device testing remains deferred.
- Production launch and official bot changes remain separately approval-gated.

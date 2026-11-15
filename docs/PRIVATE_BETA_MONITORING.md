# GWAPOHOLICS — Private beta monitoring and incident response

**Status:** Proposed operating procedure. Not a claim that alerts have been installed or beta has started.
**Environment:** Vercel Preview, `@TestGwap_bot`, isolated Neon Preview database.
**Owner:** Founder/designated release operator (assign named backup before cohort).
**Data policy:** Never log Telegram initData, bot token, signed cookies, session secret, database URL, IP addresses in tester reports, or raw player identifiers.

## Verified configuration and evidence (2026-11-15 UTC)
- Vercel firewall enabled with valid active `POST /api/session` fixed-window rate-limit rule, 20 requests per IP per 60 seconds.
- Latest inspected Preview deployment `dpl_Bn7YrqbnzT856qswxHuRzm4Wd9sm` reports READY; release-candidate source SHA `7fcab1c33cd73b89b201edabecb6ed5e53f4b988`.
- Vercel active attack anomalies query returned an empty list, which does not establish absence of threats.
- Vercel runtime error clusters for the last 24 hours returned one group: **two PostgreSQL driver SSL-mode compatibility warnings** associated with `/api/game`. A warning does not prove a failed game command.
- The rate-limit's actual 429 behavior **has not been exercised** against Preview.

## Monitoring checks during private beta
Review at cohort start, daily while testing, and immediately after a report of lost progress:
1. **Availability:** deployment READY; login, `GET /api/game` and game command requests complete on a test account.
2. **Authentication:** rate of 401/403 on `/api/session`; investigate unusual spikes, but remember invalid launches are expected when credentials expire.
3. **WAF:** 429 counts on `POST /api/session`, source distribution only in aggregate; confirm no legitimate testers are unintentionally throttled behind shared NAT.
4. **Game integrity:** 409 duplicate/conflict responses, 503 service unavailable, and game 429 command-budget responses. 409 is not automatically a defect; investigate repeated unexpected patterns.
5. **Database:** Neon connection availability, transaction errors, and consistency of player balance, quest runs, ledger and receipts.
6. **Experience:** time to first choice, quest completion, interrupted-session recovery and return use. Use aggregate counts and opt-in feedback, not sensitive payloads.

## Incident severity and response
| Severity | Trigger | Immediate action |
| --- | --- | --- |
| SEV-1 | Duplicate coin settlement, unauthorized access, credential exposure, or confirmed state loss | Stop new tester invitations; suspend testing on affected Preview; preserve sanitized evidence; rotate affected secrets through controlled provider flows; investigate before resuming |
| SEV-2 | Repeated auth failures, sustained 503s, WAF blocking legitimate users, or reproducible cross-device divergence | Pause affected testing path; inspect Preview logs/WAF; isolate failing revision; prepare fix in PR |
| SEV-3 | Cosmetic cinematic defect, isolated performance issue or recoverable noncritical warning | Log device/version/reproduction and prioritize in backlog |

**Do not** change production traffic, reset shared Preview data, disable WAF, or rotate secrets without a deliberate scoped change review.

## Incident record template
- UTC start / detected / resolved:
- Reporter alias / device / Telegram version:
- Preview deployment ID and commit SHA:
- Affected route and aggregate response status:
- Severity and reproducible steps (no credentials):
- Player-visible impact and whether state changed:
- Evidence link to sanitized provider logs:
- Mitigation, owner, follow-up PR, retest result:

## Release go/no-go
**No-go** if any critical security, double-settlement, data-loss or unrecoverable session defect is open. No-go for inviting testers until the Preview WAF response is actually validated, device acceptance is sufficiently evidenced, and incident owner is assigned. Physical Android acceptance is explicitly deferred, **not passed**. Offsite backup restore remains deferred for private beta but required before public production.

## Operational notes
The PostgreSQL SSL warning recommends explicit `sslmode=verify-full` for forward compatibility. Review provider certificate support and connection configuration privately before changing any secrets or connection strings. The warning alone does not justify emergency rotation.

**No alerts are claimed configured by this document.** The release operator must verify actual provider alert capabilities and notification destinations before relying on automated detection.

# GWAPOHOLICS — private-beta Preview monitoring

## Active target and scope

The Preview monitor runs at minute 17 and 47 of each hour, UTC, from the default branch and supports manual dispatch. As of the next monitor update, it checks the **verified release-candidate Preview branch alias**:

`https://gwap-telegram-business-sim-git-fe-c57750-bigdaddygwaps-projects.vercel.app`

The alias was verified to point at deployment `dpl_3xuNUweQitt1mnFzGM3xymxnw9zh`, `READY`, `target: null`, from release-candidate SHA `8ce4ef2baded429fee0de6de40076767c3fc8bfe`. This is **not** a production domain or deployment. Verify that the branch alias still resolves to the intended commit after every deployment.

## Credential-free checks

1. `GET /api/game` without cookies must return HTTP 401 and `sign_in_required`.
2. `POST /api/session` with proper same-origin header but missing `initData` must return HTTP 400 and `invalid_request`.
3. `POST /api/session` with deliberately invalid *synthetic* `initData` must return HTTP 401 and `invalid_telegram_launch`. This checks that the bot authentication path is configured without possessing a valid user session.

All checks must return no `Set-Cookie`. No valid Telegram tokens, real identities, game commands, or database writes are used. A passing check is **not proof** of genuine Telegram login, gameplay authorization, database connectivity or SSL verification.

The monitor retries once after three seconds. If both attempts fail, its GitHub Actions job fails and a script opens one GitHub issue titled **[GWAPOHOLICS Preview] Endpoint monitor failing**, explicitly assigned to the verified notification recipient `gwapupward-hub`. If a matching issue is already open, it does not duplicate it and ensures the owner is assigned. When tests pass, the script comments and closes the issue. These transitions have deterministic, credential-free unit tests; **the live failure-to-recovery workflow and owner notification on a real automatic incident have not yet been tested**.

## Safe issue-lifecycle drill (after review and merge)

A **manual** GitHub Actions dispatch can optionally enable `incident_drill: true`. It first runs the real credential-free health probes. If they pass, the workflow uses its `issues:write` token to create an issue clearly titled **[GWAPOHOLICS Preview] DRILL: issue notification lifecycle**, assigns `gwapupward-hub`, posts a test-only recovery comment, and closes that issue. It never creates a real failure alert or changes Preview/gameplay state. A drill failure leaves the workflow failed; inspect the labeled test issue and close it only after understanding the partial state.

The drill does **not** run on its normal twice-hourly schedule; `incident_drill` defaults to false. It should be enabled only during an intentional manual dispatch after its PR is merged. This gives direct evidence of the Actions token's issue-create, assignment, comment, and closure permissions, while preserving the genuine incident state. Owner notification delivery for this exact workflow should still be confirmed separately if required.

## Operational response

- Assign a repository maintainer to the issue stream and explicitly subscribe to GitHub Actions / Issue notifications. Issue creation is not a verified SMS, email or on-call paging system.
- After merging this change, manually run **GWAPOHOLICS Preview endpoint monitor** on `main` once. Confirm that all three probes pass and the workflow succeeds before marking the revised monitor operational.
- GitHub scheduled jobs may be delayed or skipped; this is a best-effort check.
- When the alias changes unexpectedly or access is blocked, inspect Vercel deployment status, Vercel runtime logs, and GitHub run logs. Do not log secrets.
- Monitor notification delivery and incident ownership must be verified independently.
- The original deployment-specific URL was intentionally replaced because it no longer tracks the latest release candidate.

## Remaining beta and production gates

- The 20 requests/IP/60s WAF rule produced HTTP 429 on request 21 during a controlled live Preview check; exact firewall event attribution remains unverified.
- The TLS compatibility change was built and deployed at `8ce4ef2`; a real authenticated PostgreSQL query is still required to confirm runtime TLS success without warning.
- Signed test-bot login, game ledger write/resume and full user-device test matrix remain separate checks; physical Android testing is deferred.
- No production promotion, official bot change, .ton routing or token issuance is approved.

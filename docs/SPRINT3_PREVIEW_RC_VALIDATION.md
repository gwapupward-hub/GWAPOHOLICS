# GWAPOHOLICS — release-candidate Preview deployment validation

Date (UTC): 2026-11-15

## Deployment

- Release-candidate branch `feat/v1-private-beta-release-candidate` was fast-forwarded from `7fcab1c33cd73b89b201edabecb6ed5e53f4b988` to `8ce4ef2baded429fee0de6de40076767c3fc8bfe`, identical to `main` at validation time (GitHub compare: ahead 0, behind 0).
- Initial Vercel Preview deployment `dpl_2mN1Wsdo6svorDGd8duL5e8crMAc` was canceled by the existing Ignored Build Step command `exit 0`; no build was produced.
- Explicit Git-sourced Preview deployment was retried with per-deployment `commandForIgnoringBuildStep: exit 1`: `dpl_3xuNUweQitt1mnFzGM3xymxnw9zh`.
- Vercel confirmed `READY`, `target: null` (Preview), source SHA `8ce4ef2`, and a completed build. The project-setting restoration request setting the original ignored-build command to `exit 0` was accepted. The project-summary response did not expose that setting for independent readback.
- Deployment-specific Preview URL: `https://gwap-telegram-business-r82eih1ck-bigdaddygwaps-projects.vercel.app`.
- Validated branch alias: `https://gwap-telegram-business-sim-git-fe-c57750-bigdaddygwaps-projects.vercel.app`.

## Safe live HTTP probes

From an isolated short-lived Vercel Sandbox `sbx_e9XlZ65iiU2E5WiOt7eJoYiArIPF`, restricted to these two Preview hosts, the same four checks were performed against both hosts with no real Telegram credentials or player cookie:

| Route / condition | Expected | Actual, both hosts |
| --- | --- | --- |
| GET / | 200 | 200 text/html |
| GET /api/game with no cookie | 401 sign_in_required | 401 sign_in_required |
| POST /api/session with JSON {} and origin headers | 400 invalid_request | 400 invalid_request |
| POST /api/session with intentionally invalid signature | 401 invalid_telegram_launch | 401 invalid_telegram_launch |

All responses had no `Set-Cookie` header. The ephemeral sandbox was stopped after testing. No game balances, player records, bot settings, production domains, or production deployments were changed.

## Interpretation

- The new build's public entry and unauthenticated security boundary respond correctly.
- The invalid-signature response suggests the bot-authentication configuration is present; it does **not** prove a valid Telegram session works.
- The PostgreSQL TLS compatibility fix is included in the deployed source. These unauthenticated requests do not execute a signed game transaction, so live database certificate verification and absence of the runtime warning are **not** established.
- The existing scheduled health monitor was pinned to the prior deployment URL. A separate change updates it to follow the release-candidate branch alias after review/merge.

## Outstanding acceptance

1. Validate a genuine Telegram launch through `@TestGwap_bot` pointing to the release-candidate Preview branch alias, with no production bot changes.
2. Complete a reversible or normal test quest action, verify balance/ledger consistency, then reload to verify persisted state. Do not run destructive database tests on Preview.
3. Check Vercel runtime logs for Postgres TLS compatibility warning and connection failures after authenticated DB traffic. Confirm the active deployment ID.
4. Independently verify monitoring alert delivery and assigned incident owner.
5. Physical Android and full quest device testing remains deferred. Do not declare public beta readiness.

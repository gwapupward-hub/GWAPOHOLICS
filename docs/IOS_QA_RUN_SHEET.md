# GWAPOHOLICS — Sprint 1 iPhone Telegram QA worksheet

**Status:** OPEN / not an acceptance pass  
**Test bot:** [@TestGwap_bot](https://t.me/TestGwap_bot)  
**Environment:** authenticated Vercel Preview linked to the private test bot (**never** `?demo=1`)  
**Android:** Deferred by founder decision; do not mark as verified.

## Read-only deployment baseline (2026-11-15)

Vercel project: `gwap-telegram-business-sim`. Latest inspected READY Preview deployment: `dpl_3xuNUweQitt1mnFzGM3xymxnw9zh`, commit `8ce4ef2baded429fee0de6de40076767c3fc8bfe`, branch `feat/v1-private-beta-release-candidate`, target Preview (`null`). The default branch currently has later changes. **Never assume the Preview contains all changes merged into main.** Re-verify deployed commit and bot-linked URL before executing any acceptance check. No production promotion under this worksheet.

## Evidence record (fill on device)

- Tester alias (not Telegram ID):
- Device type and iOS version:
- Telegram version:
- Preview URL (no token or query secrets):
- Deployment ID and commit SHA:
- UTC timestamp:
- Signed test-bot entry succeeds (PASS/FAIL):
- Evidence links (redacted):
- Critical issues / owner / next smallest action:

## Five-quest playthrough matrix

For each quest: finish four decisions, check all visible scene transitions, narrator text, tap-to-complete, safe areas and balance; record resulting virtual G balance and any rendering issues.

| Quest ID | 4 decisions | Narration + props | Safe-area + reduced motion | Exactly-once settlement | Evidence |
|---|---|---|---|---|---|
| `streaming-pivot` | [ ] | [ ] | [ ] | [ ] | |
| `brand-backlash` | [ ] | [ ] | [ ] | [ ] | |
| `supply-shock` | [ ] | [ ] | [ ] | [ ] | |
| `founder-runway` | [ ] | [ ] | [ ] | [ ] | |
| `inflation-trap` | [ ] | [ ] | [ ] | [ ] | |

## Persistence, error and security matrix

Use a separate disposable account/test fixture if reproducing lockout or destructive conditions; do not manipulate real beta-player balances.

- [ ] Force-close Telegram halfway through a quest; reopen and verify same decision and balance.
- [ ] Intermittent network during command: retry gives same result, not a second settlement.
- [ ] Expired session/logout: user is reauthenticated; progress remains attached to the same Telegram identity.
- [ ] Wrong/expired Telegram authentication is rejected; do not copy signed `initData` to evidence.
- [ ] Balance below 100 G: correct lockout and cooldown-based recovery, no repeat reward. Use approved isolated test data.
- [ ] Same-account second-device continuity where safely available (Android still deferred).
- [ ] No screen, response, URL, screenshot or logs expose bot token, session cookie, raw `initData`, database credentials or other private information.
- [ ] Poor-network/short-viewport/fallback accessibility conditions yield recoverable errors and usable controls.
- [ ] No suggestion that virtual G is cash, a released Solana token or withdrawable.

## Gate exit decision

- iPhone all-five quest acceptance: PASS / FAIL / NOT RUN
- Signed persistence and settlement: PASS / FAIL / NOT RUN
- WAF legitimate signed post-cooldown check: PASS / FAIL / NOT RUN
- Deployed database TLS verification: PASS / FAIL / NOT RUN
- Isolated offsite restore: PASS / FAIL / NOT RUN
- Monitor incident notification owner: VERIFIED / UNVERIFIED
- Android QA: **DEFERRED — NOT VERIFIED**
- Founder staging approval: PENDING

**Do not call the game production-ready or change `@GwapoholicsBot`, `gwapoholics.ton`, mainnet assets or the production target based solely on this document.** Record failures and evidence in the [Sprint 1 issue](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/28).

# GWAPOHOLICS — Private beta acceptance worksheet

**Status:** PREPARATION ONLY. No cohort invitation or production release authorized.
**Test entry:** Telegram `@TestGwap_bot`, authenticated Preview (never `?demo=1`).
**Scope:** 5 quests × 4 decisions, iPhone and Android, server-backed virtual G.

## Verified engineering evidence
- Main contains the Sprint 2 recovery/reconnect and Telegram session boundary regression tests.
- CI on PR #14: GWAPOHOLICS CI, PostgreSQL ledger integration and Mobile browser smoke passed.
- Vercel active firewall config was inspected: POST /api/session, fixed-window 20/IP/60s, active.
- Encrypted offsite backups have been reported working; **offsite restore drill remains deferred**.
- One iPhone quest was reported passed; **all-five-quest iPhone and physical Android passes remain unverified**.
- WAF configuration inspection does **not** prove that Preview actually returns HTTP 429.

## Device acceptance matrix
For each physical device, record OS version, Telegram version, Preview deployment ID, UTC time, and tester alias only. Never record Telegram initData, cookies, tokens, wallet keys or personal identifiers.

| Test | iPhone | Android | Evidence to capture |
| --- | --- | --- | --- |
| Authenticated launch in Telegram | One quest reported passed | Pending | Landing screen and sign-in result |
| All five quests, four decisions each | Pending | Pending | Quest completion and final G balance |
| Typing bubble tap-to-complete, staged props, fades and zoom | Pending | Pending | Scene and accessibility notes |
| Safe-area controls, small viewport, reduced motion | Pending | Pending | Screen recording with private data hidden |
| Force-close/reopen halfway through a quest | Pending | Pending | Same draft step and unchanged balance |
| Network loss during decision and retry | Pending | Pending | Single committed choice and settlement |
| Same Telegram account on second device | Pending | Pending | Identical authoritative balance and completed quests |
| Under-100 G lockout and educational recovery | Pending | Pending | Lockout, cooldown, and no duplicate mint |
| Logout, expired session and relaunch | Pending | Pending | Reauthentication without state loss |

**Test data:** Use disposable beta accounts or isolated Preview fixtures. Do not alter actual player balances or manually trigger rewards in a shared database to force lockout tests. Run destructive/edge-case tests only on an explicitly approved isolated test environment.

## Preview WAF verification
1. Verify the target is an authorized Preview deployment, not the production alias.
2. Use a dedicated test source IP and a bounded, low-volume sequence to validate the configured 20/IP/60s rule.
3. Record counts of 401/403/429 and Vercel WAF event metadata without logging credentials.
4. Wait for the window to expire; verify a legitimate Telegram launch works.
5. If the WAF does not apply to Preview, mark FAIL and resolve before private-beta invitations.

## Beta cohort launch gate
Invite **10–15 consenting testers** only after physical-device acceptance, Preview ingress verification, monitoring and incident ownership are confirmed. Track:
- First-choice completion time
- Quest completion rate
- Interrupted-session recovery
- Return sessions
- Critical bug counts and time-to-fix

**Exit:** Zero unresolved critical auth, settlement, state-integrity, data-loss or accessibility defects.

## Release boundaries
- No production deploy, production bot changes, domain wiring or mainnet token actions.
- The Vercel build-skip setting may still suppress automatic Preview builds; verify deployment state before expecting a new Preview.
- Keep the offsite restore drill as a mandatory **public-production** gate even if the founder elects to defer it during private beta.
- Obtain separate founder approval for merging this worksheet and for any release promotion.

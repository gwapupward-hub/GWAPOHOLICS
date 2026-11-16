# GWAPOHOLICS — Restricted iOS Private Beta Operator Packet

**Status:** Prepared for activation; **not yet publicly distributed**.  
**Product:** GWAPOHOLICS v1 Telegram Mini App; five full-screen business quests.  
**Founder evidence:** Full `@TestGwap_bot` gameplay reported passed November 15, 2026. Read-only Preview DB confirmed 5 distinct completed quests / 4 decisions per quest / 0 duplicate completed runs / 0 mismatches against latest virtual ledger balance.  
**Known gaps:** Exact bot-linked build SHA, active deploy TLS, backup-restore provenance, explicit interruption/expiration/recovery tests, official logo asset integration and device metadata.  
**Android:** Deferred. This beta is **iPhone-only**, and no cross-platform claim is permitted.  
**Production:** No changes or invitations to `@GwapoholicsBot`; no `gwapoholics.ton` routing or deployment promotion.

## Before first invitation — operator authorization

- [ ] Confirm current `@TestGwap_bot` Main Mini App / launch button URL resolves to the intended **authenticated Preview** SHA; never use a `?demo=1` URL as the beta's game record.
- [ ] Confirm genuine signed Telegram login and a read/write/resume path on that deployed Preview without logging initData or session cookies.
- [ ] Confirm current deployment's TLS and rate limiting, and an on-call maintainer for incidents.
- [ ] Confirm isolated encrypted backup schedule, retention and rollback mechanism; isolate public-production restore verification as an outstanding non-waivable release gate.
- [ ] Founder reviews the exact candidate build and explicitly signs off on **restricted beta invitations** (not public production).
- [ ] Prepare a **private invitation list of 10–15 consenting iPhone testers**. Do not store phone numbers, Telegram IDs, or private messages in public GitHub issues.
- [ ] Create a restricted feedback venue controlled by a named moderator, or use private direct reports to a verified operator if group setup is not approved.
- [ ] Make short Terms/Privacy/educational-fiction and virtual-G-no-cash-value disclosures accessible during beta, with an operator support channel.

If any gate fails, stop invitations and record blocker/owner/next action in [Sprint 1 #28](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/28).

## Private invitation — approved-style draft, NOT sent

> **GWAPOHOLICS Private Beta — iPhone Testers**
>
> We're testing a new cinematic business game built exclusively for Telegram. You'll begin with **1,000 virtual G**, play five business stories, and see how your decisions change your in-game outcome.
>
> Test link: https://t.me/TestGwap_bot (open inside Telegram; use the app button).
>
> We're looking for feedback on clarity, story pacing, glitches, lost progress and anything confusing. Please complete as many of the five stories as you can and try leaving/reopening the game once. Expect this to be a **test environment**, so things can change or be reset.
>
> Virtual G has **no monetary value** and cannot be transferred, redeemed, swapped or withdrawn. There is no launched Solana token.
>
> To report an issue: use [private support channel — insert verified moderator-controlled destination]. **Never include session cookies, Telegram initData, passwords or private keys.**
>
> This private test is currently intended for iPhone users only. Participation is voluntary. [Insert approved Terms and Privacy links before sending.]

## Tester checklist (do not force destructive failure conditions on shared beta accounts)

1. Open `@TestGwap_bot` inside Telegram and start the Mini App.
2. Confirm the starting balance and tutorial proposition are understandable.
3. Complete one quest, observing all four decision points and the result.
4. Continue through the other quests (five total) and confirm final balances persist.
5. If comfortable, close/reopen mid-quest and verify progress resumes.
6. Record any problems with captions, narrator, controls, scene art or performance.
7. Rate: **Would you return to play another story?** (Yes / Maybe / No), and what single improvement matters most?
8. Report defects privately; share screenshots only after checking no private notifications/account details are visible.

**Do not instruct testers** to exhaust balances, create fraudulent accounts, force chargebacks, invoke wallet connections or test hidden API routes. Operator-only negative-path tests use isolated fixtures.

## Minimal private-feedback record

- Tester alias (random identifier, not Telegram ID):
- Consent recorded? Y/N + time:
- iPhone model class / iOS + Telegram version (optional):
- Test build SHA / deployment:
- First choice completed? Y/N:
- Quests completed: 0–5:
- Paused/resumed successfully? Y/N / not tested:
- Any incorrect virtual G balance? Y/N / unknown:
- Narrator, reading or taps issue? Description:
- Technical issue severity: P0 auth/data integrity, P1 blocking gameplay, P2 usability, P3 cosmetic:
- Would return for new content? Yes / Maybe / No:
- Single most important improvement:
- Sanitized evidence URL (restricted access only):
- Owner / repair PR / fixed and retested / closed:

Keep personal details out of public issue bodies and logs. A feedback channel or form must have an approved privacy/retention policy before collection.

## Beta metrics & funnel definitions

Track minimally and only after privacy review:

| Event name | When fired | Safe dimensions | Forbidden fields |
|---|---|---|---|
| `beta_launch_attempt` | User attempts authenticated Mini App entry | anonymous session key, app build, timestamp | Telegram raw initData, token, cookie |
| `beta_launch_success` | Session validated and game state visible | app build, latency bucket | actual Telegram numeric ID |
| `beta_first_choice` | First authorized choice is committed | quest id, decision ordinal | narrative selections if uniquely identifying |
| `beta_quest_complete` | Server returns persisted completed quest | quest id, duration bucket | raw player profile, signed payload |
| `beta_resume_success` | Saved partial game resumes | quest id, decision ordinal | private player data |
| `beta_handled_error` | Recoverable error shown | error code, build, environment | request headers, DB URLs, secrets |
| `beta_return_session` | Repeated authenticated use on later day | pseudonymous minimal grouping if approved | raw Telegram identity |

Compute first-choice rate = sessions reaching a first committed choice / successfully authenticated starts; first-quest completion = sessions with any completion / successfully authenticated starts; D1/D7 retention = opted-in unique beta participants returning on following day / week, with clear time-window definitions. Keep denominator definitions stable and distinguish eligible participants from new sessions. **No real observed rates have been established.**

## Triage and beta exit

- **P0 critical**: identity spoofing, unauthorized balance changes, duplicate settlements, personal-data exposure or data loss -> **pause beta and investigate**.
- **P1 high**: stuck sign-in, unrecoverable state, significant inaccessible gameplay -> fix before expanding cohort.
- **P2/P3**: track and prioritize after evidence review.
- Exit only after zero unresolved critical security, ledger or data-loss defects, named support owner, signed candidate release evidence and founder approval.
- Public release requires a separate, independently tested production configuration, exact official logo, completed B2 restore provenance, official bot/domain authorization and legal disclosures.

## First-value and operator goals (targets, not guarantees)

- 10–15 consenting testers
- 99%+ successful authenticated launch
- 80%+ first-choice completion; 60%+ first-quest completion
- Record actual D1/D7 baseline, not a guessed retention rate.
- Review support and critical errors daily during the active small cohort.

**Owner:** Founder (launch sign-off); assign an explicit operational/tester support contact before invitations.  
**Tracking:** [Sprint 2 issue #31](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/31), [Sprint 1 issue #28](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/28).

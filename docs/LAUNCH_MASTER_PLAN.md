# GWAPOHOLICS — Launch Master Plan (locked scope)

**Baseline date:** 2026-11-15  
**Project:** GWAPOHOLICS Telegram Mini App only  
**Official bot:** [@GwapoholicsBot](https://t.me/GwapoholicsBot) (production changes not yet authorized)  
**Owned name:** `gwapoholics.ton` (ownership reported by founder; DNS/HTTPS route not independently approved)  
**Official logo:** approved transparent black `#000000` geometric crowned-G silhouette, 512×512 SVG canvas with **exactly one path**; retain exact master shape.  
**Code:** [gwapupward-hub/GWAPOHOLICS](https://github.com/gwapupward-hub/GWAPOHOLICS)

## Product charter and freeze

**Value proposition:** “Make the call. Own the consequences.” Learn business and financial decision-making through immersive, fictional, cinematic consequences. A player should understand the proposition and reach a first meaningful decision quickly.

**Frozen v1:** Five cinematic quests; 45 scenes; four linked decisions per quest; full-screen scenes, narrator/typewriter, transitions and reduced-motion support; secure Telegram session; server-authoritative PostgreSQL virtual ledger, idempotent settlements and resume; initial balance **1,000 virtual G**; missions lock when balance is below **100 G**; cooldown-limited educational recovery.

**Virtual G is not a launched Solana token, has no cash value, and has no v1 withdrawal, redemption, transfer, DEX swap or wallet integration.** Solana tokenization, multiplayer trading and player-to-player commerce are future design/review projects, not release requirements. Do not promote unsupported financial value claims.

**No scope expansion to block v1:** New quests, referral rewards, achievement systems, leaderboards, daily challenges, social sharing cards, commerce, and tokens are enhancement opportunities after initial quality and retention evidence.

**Approval policy:** NO production deployment/promotion, official bot change, `.ton` DNS/routing change, production database write, or mainnet token action without explicit separate founder approval. Merging planning documents does not authorize release. Prefer isolated Preview, test bot, disposable fixtures, least privilege, and reviewable PRs.

**Android:** Physical Android QA is expressly deferred at the founder's request. Do not call Android tested or claim cross-platform release acceptance. Record this as an explicit gap and limit the initial tested-device claims to iOS; re-open Android acceptance before a broad cross-platform launch.

## Evidence baseline — verified versus open

| Topic | Current evidence | State | Gap/next proof |
|---|---|---|---|
| Gameplay v1 | 5 quests, 45 scenes; founder reports entire `@TestGwap_bot` gameplay passed Nov 15 | Founder-reported PASS | Device/build metadata and specific fault-injection evidence still open |
| Telegram signed authentication | `@TestGwap_bot` Preview integration; one authenticated Streaming Pivot settlement recorded (1,230 G) | Partly verified live | All-quest signed-user resume, expiry, reauth and database flows |
| Economy integrity | CI plus read-only Preview aggregate: 5 distinct completed cases, 4 choices each, 0 duplicate user-case groups, 0 ledger-balance mismatch | Aggregate PASS | Physical signed-user interrupted/recovery/expiry testing |
| GitHub release protection | Active main ruleset; required CI | Verified | Revalidate release SHA at staging |
| WAF | Preview 20/IP/60s: HTTP 403 ×20 followed by HTTP 429 once | Verified bounded ingress response | Signed login after cooldown; attribution if available |
| Preview backup | Encrypted Backblaze B2 backups and 30-day retention reported; scheduled workflow success | Backup verified, restore open | Isolated Neon restore + read-only integrity checks |
| Monitoring | Scheduled Preview endpoint probe and GitHub incident assignment; latest scheduled CI green | Operational baseline | Latest one-run incident drill and real notification ownership |
| Database TLS | Compatibility fix merged and newer Preview built | Unconfirmed live query | Authenticated Postgres query and warning-free runtime verification |
| Official bot and `.ton` | Bot/name provided by founder | Not released | Verify test-bot entry URL; then BotFather configuration, authoritative TON DNS, HTTPS and staging smoke |
| Private beta | Acceptance worksheet in repository | Not signed off | 10–15 testers, metrics, bugs, zero critical defects |
| Production | Preview is available; separate production release gated | Not approved | Dedicated prod DB, secrets, release/rollback drill, founder sign-off |
| Official brand asset | Existing `brand.svg` is 128px multicolor, not approved locked 512px one-path black silhouette | BLOCKED | Obtain exact master SVG; replace/favicon-test in reviewable PR; issue #32 |
| Community/marketing | Strategy below | Not independently verified | Channel/group ownership, content assets, distribution and analytics |

Evidence: [PR #11](https://github.com/gwapupward-hub/GWAPOHOLICS/pull/11), [Preview operations](PREVIEW_OPERATIONS_EVIDENCE.md), [Private beta acceptance](PRIVATE_BETA_ACCEPTANCE.md), [Preview monitor](PRIVATE_BETA_MONITORING.md), [Release runbook](V1_RELEASE_RUNBOOK.md), [GitHub Actions](https://github.com/gwapupward-hub/GWAPOHOLICS/actions).

**Evidence standard:** A passed automated test is not a substitute for an authenticated device pass. Owner reports must be recorded separately from independent technical verification; never infer an acceptance result from an unchecked box.

## Launch gates / sequencing

### Sprint 1 — technical acceptance and release controls (P0; start here)

- [x] Founder-reported full `@TestGwap_bot` five-quest gameplay pass (Nov 15, 2026); independent read-only Preview SQL confirms five distinct completed quests, four choices each, no duplicate user-case group and no latest-ledger balance mismatch. [ ] Separately capture device/build metadata and specified accessibility/failure scenarios.
- [ ] Signed-user interruption/resume, network failure/retry, session expiry/logout, exactly-once settlement, low-balance lockout/cooldown and same-account continuity. Use disposable isolated data for destructive edge cases.
- [ ] After rate-limit cooldown, verify legitimate signed launch, and reconcile WAF 429 evidence.
- [ ] Confirm runtime TLS hostname verification and successful authenticated DB operation on currently deployed Preview; no secrets in logs or evidence.
- [ ] Complete the isolated encrypted-backup restore drill to a disposable Neon target and validate restored tables, counts and ledger integrity, without production writes.
- [ ] Verify current monitoring/incident-lifecycle drill and owner notification delivery; ensure escalation and rollback contacts have named owners.
- [ ] Confirm verified TON owner/DNS, HTTPS host, **restore exact approved single-path master SVG in app/favicon** (see [brand issue #32](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/32)), bot metadata and release deployment architecture **without changing official settings yet**.
- [ ] Record Android QA as deferred; no unsupported cross-platform claim.
- [ ] Produce a sign-off packet listing pass/fail/evidence links, remaining blockers, unknowns, owner and next smallest action.

**Gate 1 exit:** No unresolved auth/data integrity/backup recovery vulnerabilities; signed iOS acceptance passed; documented operational owner; staging eligible for separately approved setup. A waiver is not a “pass”.

### Sprint 2 — private beta and measurement (P0)

- [ ] Recruit 10–15 consenting testers after safe beta authorization.
- [ ] Collect launch→first choice→quest complete funnel, time-to-first-choice, crashes, errors, resumed sessions and returns, using minimal data.
- [ ] Test first-use clarity, visual flow, support escalation and game fairness. Preserve anonymity in public reporting.
- [ ] Triage and fix bugs via PR+CI; exit with zero unresolved critical auth, settlement, integrity, data-loss or accessibility defects.
- [ ] Document beta acceptance and founder sign-off before public promotion.

### Sprint 3 — Telegram identity, community and go-to-market (parallel, no production changes)

- [ ] Prepare `@GwapoholicsBot` description, short description, welcome, commands, support, Main Mini App title/preview/splash and approved HTTPS URL.
- [ ] Verify admin control; **create only after naming/ownership check**: one announcements channel, one linked discussion group, one restricted beta feedback venue.
- [ ] Pinned start guide, anti-scam/no-crypto-cash-value rules, moderation/abuse workflow, support point of contact and FAQ.
- [ ] Produce 6–9 second dilemma teasers, 15–30 second cinematic trailer, gameplay screenshots, launch post, founder story, shareable outcome framing (future build if not implemented).
- [ ] Distribute organically using existing GWAP Instagram and X channels, relevant opted-in Telegram creators/groups; avoid unsolicited spam or paid campaigns before onboarding conversion data.
- [ ] Track campaign source (where supported), launches, first choices, completions, D1 and D7 retention. Designate social/community operator and weekly metrics review.

### Sprint 4 — production approval and release (gated, no automatic promotion)

- [ ] Publish Terms, Privacy, educational-fiction/financial-disclaimer, virtual currency/no-redemption, age eligibility, player support and data deletion documents; get appropriate legal review.
- [ ] Provision distinct production DB, secrets, backup/restore plan, monitoring, access controls, rate limit and rollback.
- [ ] Freeze commit SHA; verify CI on exactly that SHA; stage HTTPS build and run signed bot smoke tests using authorized credentials.
- [ ] Verify `gwapoholics.ton` DNS/link behavior independently of ordinary HTTPS Mini App hosting.
- [ ] Obtain separate documented founder approval for **each** production promotion, official bot configuration and domain change.
- [ ] Monitor live login/settlement/errors and respond using documented incident procedure.

### Sprint 5 — retention and post-v1 (not release blockers)

- [ ] Prioritize new educational story pipeline based on actual first-quest completion and day-seven return.
- [ ] Evaluate safe shareable outcomes, social decisions, achievements, leaderboards, lightweight challenges; privacy, abuse and gaming resistance first.
- [ ] Separately specify multiplayer deals/trading, anti-collusion, moderation, economic simulation and safety.
- [ ] Keep tokenization/withdrawals planning-only until separate technical, legal and economics decisions.

## Marketing launch package

**Positioning:** GWAPOHOLICS — **Make the call. Own the consequences.** A cinematic business simulation where the choices you make change your virtual outcome.

**Core content pillars:** 1) The Decision (short business dilemma), 2) What Would You Do? (Telegram community polls), 3) Show Your Outcome (privacy-safe result conversation), 4) The Lesson (succinct business learning without implying real investment advice).

**Required assets:** approved master silhouette (no reinterpretation), icon/splash, 3–5 game screenshots, short trailer, short teaser, FAQ, announcement copy, community pinned welcome and rules, support/reporting copy, campaign tracking plan, day-of checklist and post-release metrics review.

**Distribution order:** Own GWAP socials → Telegram community and beta feedback → opted-in partner channels → broader creator partnerships → optional paid promotion once onboarding and retention are measured.

## Suggested acceptance targets — NOT measured performance or guarantees

- 10–15 consenting beta testers.
- Zero unresolved critical defects before founder production sign-off.
- Target 99%+ successful authenticated launch; 80%+ first-choice completion; 60%+ first-quest completion.
- Establish actual D1/D7 retention baselines during beta before setting growth commitments.
- Review feedback and funnel weekly; prioritize evidence over speculative reach.

## Gateboard record fields

For each gate: `id`, `phase`, `title`, `status` (unverified/in-progress/verified/blocked/deferred), `owner`, `evidence_url`, `last_checked_utc`, `blocker`, `unknowns`, `decision_required`, `next_smallest_action`, `approval_state`. Keep staging and production approvals separate.

**Next smallest action, updated 2026-11-15:** Reconcile the exact test-bot-linked Preview deployment (recent runtime activity reached an older deployment) and live TLS/session behavior; then obtain an auditable encrypted B2 snapshot restore (see [issue #30](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/30)). Founder gameplay and independent aggregate ledger checks are recorded as passed. Resolve the stale 128px multicolor primary asset using the **exact** approved 512px black SVG (see [issue #32](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/32)); do not approximate it. Prepare (do not publish) community materials in parallel. Private-beta cohort: [issue #31](https://github.com/gwapupward-hub/GWAPOHOLICS/issues/31).

# GWAPOHOLICS v2 — The Business Underworld
## Canonical vision and living build roadmap

**Founder direction locked:** November 18, 2026  
**Platform:** Telegram Mini App only  
**Status:** Approved *product concept and phased roadmap*; implementation sequencing, economy figures, release gates and dates remain subject to testing and approval. **This document is not authorization to merge, deploy, change production databases, or open a public beta.**  
**Working principle:** Build → Test → Play → Learn → Improve → Expand.  
**Exclusive active delivery scope:** **v2.1 — Build Your Empire**. All other numbered phases are future roadmap context, NOT authorized or active implementation. The final v2.1 build must demonstrate readiness to implement v2.2 The Deal Room. Any move to v2.2 requires a separate founder decision.

> A cinematic, persistent, multiplayer business universe where players earn their start, build enterprises, negotiate deals, compete for customers, adapt to a living economy, and gain or lose reputation because choices have consequences.

### 1. Non-negotiable product identity

GWAPOHOLICS v2 evolves the founder-approved v1 cinematic business-education journey into an interconnected business world, not an unrelated clicker/idle game, a gambling product, a cash-out economy, or a generic financial dashboard. Every future feature must meaningfully strengthen at least one of eight foundation pillars:

1. **Build Your Empire:** start with small businesses (barbershops, restaurants, fashion, logistics) and grow toward corporations; operating costs, customers, inventory and risk matter.
2. **The Deal Room:** player-negotiated partnerships, simulated investments, contracts and profit splits with enforceable in-game outcomes.
3. **The GWAP Exchange:** fictional marketplace for inventory and business assets, with supply and demand affected by real player activity.
4. **Corporate Wars:** competition for customers through marketing, supplier deals, positioning and legitimate acquisitions, not reflex-based combat.
5. **The World Keeps Moving:** changing economic conditions, disruptions, regulations and trends across the simulated economy.
6. **Pitch Battles:** founders pitch startup ideas to player-investors, who evaluate valuation, risk and business models.
7. **GWAP Syndicates:** Telegram-friend business crews, joint ventures, pooled resources, weekly cooperative challenges and collective reputation.
8. **Your Choices Follow You:** persistent, contextual reputation affected by fulfilling agreements, debt management, business stewardship and reliability.

**Creative presentation:** full-screen, cinematic, story-mode scenes; narrated character dialogue with typewriter bubbles; fades, gradual zooms, sequential props and consequences that appear in the world. Continue to support mobile-safe areas, accessibility and reduced-motion settings. Complex systems should feel like a story unfolding, not a wall of accounting forms.

**Learning promise:** realistic business decision-making; risk, financial literacy and trade-offs; no guarantee of profit. All G is fictional, non-transferable and has no cash value. Solana tokenization, withdrawals, swaps and real-world redemption remain **future planning, not approved features**.

### 2. The player's canonical journey

1. **Origin (v1 qualification):** new players start their *qualification account* at **0 G**; play the five existing cinematic educational quests and receive a verified full-run Origin Score to become their v2 startup capital.
2. **Graduation:** enter The Business Underworld with credited capital and an initial founder record. Do not conflate a qualification score with lifetime earnings or actual available cash.
3. **First enterprise:** open a small starter operation or, if capital is insufficient, complete bounded educational starter opportunities; earn through decisions and manage expenses.
4. **Economic survival:** make choices about inventory, pricing, marketing, staffing, customer demand, solvency and expansion.
5. **Social strategy:** negotiate with humans, compete, seek investment, form partnerships and later establish syndicates.
6. **Long-term identity:** wealth can rise or fall, but history, commitments and context-sensitive reputation persist.

**Preserve prior founder-approved replay rule:** unlimited v1 replays anytime, including after v2 entry; only the positive difference above the highest *previously credited eligible full-run score* grants additional v2 capital. Equal or worse scores grant 0 G. Replays must never erase v2 money, companies, contracts or reputation. Credit score improvement exactly once under an atomic server transaction. Existing v1 testers, balances, quests and recovery state must not be silently converted or wiped; migration/opt-in policy needs explicit approval.

**Economy/level draft boundary:** PR #47 (Zero-to-Empire economy, XP, safe gates) contains *proposed* numeric caps, progression and code, not approved production settings. Its anti-farming principles, transactional receipts and nontransferability are dependencies. No new exact G prices, XP thresholds or exchange permissions are hereby approved.

### 3. One active development phase: v2.1 — Build Your Empire

**Execution rule (founder-locked, November 18, 2026):** Engineering, QA, product design and player-facing releases work on **v2.1 only** until its exit gate is passed. Work that happens to support a later phase is allowed only as a narrow, testable **v2.1 dependency or interface**—not as a playable Phase 2+ feature. Do not pre-build the Deal Room, Exchange, Corporate Wars, Syndicates or other pillars in parallel.

The earlier Phase 0 / Origin qualification work is an **entry dependency within v2.1**, not a second independently active feature initiative: users must graduate from the existing cinematic v1 journey with verified starting capital under the approved best-score-only replay-credit rule. Preserve existing v1 progress.

#### v2.1 successive playable builds

Deliver narrow, opt-in, testable increments to the Telegram Preview cohort. A build is finished only when its playable loop, source-of-truth writes, and next-build dependency contracts are demonstrated.

| Build | Deliverable players can actually use | Prepares the next build (without shipping the next phase) | Acceptance evidence |
| --- | --- | --- | --- |
| **2.1-A — Founder Entry** | Qualify through v1 and enter v2 with persistent founder identity and verified startup capital; provide a clear recovery path for insufficient capital | Immutable player identity, separate qualification vs. operating balances, idempotent capital-credit journal, migration/version contracts | Replay improvements credited once, unchanged/worse runs pay zero, no prior progress erased, isolated DB restore and session checks |
| **2.1-B — First Business** | Pick/open one starter enterprise and view an in-world business scene, ownership, available funds and first decision | Reusable business ID, owner ID, business status/lifecycle and extensible business-type schema (initially one vertical is sufficient) | Telegram cinematic acceptance; authorized creation; one business per allowed action; no spoofed ownership or duplicate charges |
| **2.1-C — Business Operations** | Choose pricing, inventory/supply or another consequential control; serve simulated customers; pay operating costs; see an explainable profit/loss cycle | Versioned operational journal, cost/revenue receipts, demand simulation and financial snapshots later usable for deal due diligence | Deterministic settlement and replay tests; cost/earnings reconcile to ledger; insolvency/recovery cases |
| **2.1-D — Growth & Consequences** | Reinvest, expand or recover; see business history and an explainable reliability record from actual actions | Stable company metrics, basic valuation inputs, audit trail and reputation events that future partners/investors can assess | No duplicate upgrade rewards; bounds on inflation, losses and abuse; player decision changes a later outcome |
| **2.1-E — Early Player Refinement** | Invited players complete the full cinematic first-business journey, return to a persistent empire and understand their progression | Harden APIs/schema and feature flags for expansion; gather data on business solvency and intended deal prerequisites | Closed-alpha feedback, observed onboarding, measured first-cycle completion, no ledger mismatches, rollback rehearsal |
| **2.1-F — v2.2-Ready Exit Build** | Stable, tested v2.1 empire with intact company, capital, history, player identity and clear upcoming opportunities; **no live Deal Room** | Finish the v2.2 handoff contract: counterpart IDs, owner/permission model, business financial snapshots, agreement-safe ledger primitives, versioned interfaces and a tested integration seam | Two synthetic accounts and a mock agreement exercise the interface without enabling P2P transfers; transactional/race/restore checks green; owner signs off on handoff |

These build labels are planning identifiers, not release dates or implicit permission to merge/deploy. Combine or split internal sprints as evidence warrants, but do not skip exit outcomes. Any numeric G costs, XP thresholds, limits or eligibility gates from draft PR #47 require explicit separate review.

#### v2.1 completion / v2.2 entry contract

All of the following must be true before the founder is asked to authorize implementation of **v2.2 — The Deal Room**:

1. **Playable continuity:** A player completes v1 qualification, enters v2.1, opens a business, runs multiple consequential operating cycles, upgrades or recovers, exits, re-enters, and retains all state.
2. **Money integrity:** Only authenticated server actions can change G, ownership, cost/revenue, or progression; credit and settlement are atomic, idempotent, auditable and zero-duplicate under concurrency.
3. **Deal-ready entities:** Durable, unique player/company/ownership identifiers; permission boundaries; a documented business lifecycle; immutable or versioned financial statements and event history; enough data to value or assess a counterparty.
4. **Extension-safe interfaces:** Versioned APIs and database migration strategy make it possible to add offers, two-party consent, agreement terms, expiry, obligations, profit splits and transaction settlement **without rewriting v2.1 records**. These are schema/contract readiness requirements, **not** permission to activate those features.
5. **Reputation foundation:** Distinguish economic performance from reliability; append explainable events with correction paths. Future agreement fulfillment can extend the event vocabulary without rewriting history.
6. **Tested future seam:** A non-live two-player mock/contract test demonstrates identities, permissions, funds availability and expected settlement boundaries. It does not move G or expose a negotiating UI.
7. **Operational and player evidence:** Closed tester results, mobile Telegram QA, abuse/rate controls, documented rollback and verified restore tests; no unaddressed critical blockers.
8. **Explicit founder approval:** Review final acceptance record and grant **separate approval** to start v2.2. Completing 2.1 does not automatically launch 2.2 or authorize a production deployment.

#### Future roadmap — sequential and inactive until authorized

The rest of The Business Underworld remains locked as a **vision and handoff sequence**, not simultaneous work. At the end of **every** future phase, perform the same forward-compatibility handoff for its successor:

| Next phase | Future experience | Required handoff from the preceding phase |
| --- | --- | --- |
| **v2.2 — The Deal Room** | Two players negotiate contracts, investments, partnerships and profit splits | v2.1 business identities, balance/ownership controls, financial history and agreement-safe extension points |
| **v2.3 — GWAP Exchange** | Player-driven fictional asset and inventory market | v2.2 verified multi-party offers, settlement receipts and ownership/obligation reconciliation |
| **v2.4 — The World Keeps Moving** | Shared economic events alter demand and costs | v2.3 market price/volume events, bounded inventory economics and versioned event inputs |
| **v2.5 — Corporate Wars** | Competitive campaigns, suppliers, customers and legitimate acquisitions | v2.4 comparable enterprise metrics, segment demand and fair world-event history |
| **v2.6 — Pitch Battles** | Founders pitch ventures to player-investors | v2.5 documented company performance, ownership and valuation/financing readiness |
| **v2.7 — GWAP Syndicates** | Crews pool resources and operate joint ventures | v2.6 multi-party permissions, governance-ready commitments and collective performance records |

**Cross-cutting pillar — Your Choices Follow You:** Begin a small, explainable and correctable *reliability history* during v2.1; add agreement fulfillment in v2.2 and expand thereafter. Wealth level must not be conflated with trustworthiness. No external GwapScore linkage without separate privacy/security approval.

**Sequential delivery policy:** One active numbered phase at a time. Each intermediate build improves current-phase play and leaves the next build easier; each final build includes a tested technical/economic/user-experience handoff to the *next* numbered phase. No future-pillar MVP, speculative market economy, or trading UI is authorized by this roadmap.

### 4. Early player participation — experience the journey while we build

- **Wave A — internal Preview:** test bot, isolated Neon/Vercel Preview, synthetic/test accounts; prove the Origin and business transaction invariants before real progression.
- **Wave B — opt-in closed alpha:** small invited Telegram cohort; unlock only the latest approved v2.1 playable slice behind server-side feature flags. Collect structured feedback after key moments, plus anonymous/aggregate gameplay metrics. Clearly mark alpha rules, resets and fictional value.
- **Wave C — progressively expanding beta:** expand access only after v2.1 build-specific security, economic and operational gates are met. Keep prior v1/v2.1 gameplay intact; do not expose v2.2 or later pillar gameplay. Publish short in-app "what's new" / next unlock notes.
- **Wave D — public release:** **separate explicit founder approval** after final bot/domain/TLS, device QA, legal disclosures, recovery/restore, abuse/rate limiting, monitoring, and economy integrity gates. The roadmap alone does **not** authorize public release.

**Never conflate Preview readiness or a successful build with release authorization.** Android testing may remain deferred during isolated prototyping, but mobile acceptance requirements must be revisited before public release.

### 5. Universal definition of done for each v2.1 build and future phase

1. **Player value:** the build has a five-minute *meaningful next step* (or a clearly justified longer intentional learning loop), with cinematic explanation and visible consequences.
2. **Integrity:** authenticated Telegram identity; server-controlled balances, ownership and outcomes; idempotency keys and atomic multi-party transactions where required; no spoofed client "profits".
3. **Continuity:** previous balances, Origin best score, companies, contracts and reputation persist without involuntary resets; feature-flagged migrations are reversible and tested in isolated storage.
4. **Economy:** simulate creation/sinks of G, insolvency, recovery, exploit paths and player collusion; verify no infinite replay grants, negative balances, duplicate payouts or unbacked asset transfers.
5. **Player safety:** clear simulated economy labels, accessible UX, fraud and rate limits, reporting/dispute mechanism appropriate to feature complexity; no real-money conversion.
6. **Operations:** production-like monitoring, incident response, restore evidence and data protection; release candidate checks green and manual Telegram WebView QA recorded.
7. **Forward readiness:** tests/documentation prove the next v2.1 build's prerequisites, and the final 2.1 build proves the explicit 2.2 handoff contract without shipping 2.2 gameplay.
8. **Founder gate:** branch/PR reviewed and explicitly approved for merge or deployment. Design approval does **not** override this step.

### 6. Playtest scorecard (review each increment)

Track: v1 qualification completion; Origin score distribution; percent who can afford a first enterprise; median time to open the first business; first/second successful operating cycle; daily/weekly return rate; business bankruptcies and recoveries; G issued/sunk/net creation; ledger mismatches (target **zero**); duplicate/replay capital grants (target **zero**); economic exploits; reported confusion; player-requested improvements. Segment newcomers versus returning legacy testers without exposing private identifiers.

After each v2.1 playable increment: (a) inspect metrics, (b) collect direct player feedback, (c) triage economic/security issues, (d) revise the *next v2.1 build's* acceptance criteria, (e) retain a dated decision log, and (f) evaluate impact on the 2.2 handoff. Defer deal creation/fulfillment metrics until v2.2 is separately authorized. Proposed numeric thresholds and launch dates should be added **only when evidence supports them**.

### 7. Source-of-truth relationships and conflicts

- **This document:** canonical product vision and eight-pillar destination, with **v2.1 as the sole active engineering workstream** and explicit 2.2 exit contract.
- **Draft PR #47** and \`docs/V2_ZERO_TO_EMPIRE_ECONOMY.md\` (on its draft branch): detailed proposed qualification, ledger and XP economy; numerical proposals require review.
- **Existing \`docs/V2_IMPLEMENTATION_DESIGN.md\`:** older *unapproved* hideout/tapping/raid/heist concept. Where it conflicts with this document's earned-capital, enterprise-building, player-negotiation and legitimate-strategy mission, **the Business Underworld direction takes precedence**. It is not a parallel product mandate. Assess useful engineering patterns individually; do not port uncapped tapping, passive inflation or combat mechanics by default.
- **v1 release runbook and README:** current tested architecture/release evidence. Neither is modified by this design-only roadmap.
- **GWAP launch gateboard:** operational release checklist; do not mark unverified work as complete.

### 8. Immediate action — v2.1 only

1. Reconcile draft economy PR #47's graduation/replay/XP assumptions to v2.1 before integrating any numeric policy or live feature; no unreviewed capital cap or trading mechanisms.
2. Inventory existing v1-to-v2 identity, ledger, business schema and Preview/restore evidence; list gaps against **2.1-A Founder Entry**. Preserve legacy testers; use isolated branches and databases.
3. Implement and verify **2.1-A**, then **2.1-B**, then successive v2.1 builds with early players as gates are met; do not initiate any v2.2 feature sprint.
4. Keep a v2.2 interface/handoff checklist current after each v2.1 increment; in 2.1-F run non-live two-player seam tests and prove 2.2 can be added without breaking 2.1.
5. Seek explicit owner approval for merging/releasing each increment and **separate authorization** before starting v2.2. No production merge, deployment or public opening is implied by this document.

**North-star experience:** "I started with nothing, made consequential business decisions, built an enterprise, and now the people, markets and rivalries around me respond to what I do."

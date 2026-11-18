# GWAPOHOLICS v2 — The Business Underworld
## Canonical vision and living build roadmap

**Founder direction locked:** November 18, 2026  
**Platform:** Telegram Mini App only  
**Status:** Approved *product concept and phased roadmap*; implementation sequencing, economy figures, release gates and dates remain subject to testing and approval. **This document is not authorization to merge, deploy, change production databases, or open a public beta.**  
**Working principle:** Build → Test → Play → Learn → Improve → Expand.

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

### 3. Incremental release phases (order is a starting roadmap, not rigid calendar dates)

Each phase should produce a **playable vertical slice** for a controlled early-player cohort, with server-verified actions, meaningful consequences, analytics, documentation and rollback. A phase is not "shipped" merely because a code path or draft PR exists.

| Phase | Core pillar | Minimum playable player experience | Engineering / verification dependency | Current status |
| --- | --- | --- | --- | --- |
| **0 — Origin to Empire** | Entry foundation | Play the cinematic v1 qualification, earn verified starting G, graduate to a persistent v2 founder profile; replay safely for personal-best improvements | Isolated qualification persistence, score tests, atomic G credit, onboarding, legacy-account protection, restore evidence | **Design locked; engineering/pilot not yet verified** |
| **1 — Build Your Empire** | #1 | Open a first business, see real customers and costs, make a pricing/supply/marketing choice, settle one operating cycle and understand gains/losses | Business/ownership ledger, costs and demand model, solvency/recovery, server-settled actions, starter-business balance tests | **Planned — target first playable v2 slice** |
| **2 — The Deal Room** | #2 | Invite another Telegram player, propose an agreement, accept/decline, fulfill obligations, observe a verified simulated profit split or failure | Two-party authorization, escrow-like hold only if warranted, safe transactional settlement, dispute/expiry rules, spam/abuse controls | **Planned** |
| **3 — GWAP Exchange** | #3 | List/buy inventory or simulated business assets and experience prices changing through bounded player activity | Ownership and settlement, anti-wash-trading, price bounds, inflation controls, order/market audit, nontransferable-G compliance | **Planned; gated access only after independent review** |
| **4 — The World Keeps Moving** | #5 | A visible economic event changes demand, supply or operating costs; player adapts to a new consequence | Versioned event engine, fairness, forecast explanations, bounded impact, deterministic tests, event audit | **Planned** |
| **5 — Corporate Wars** | #4 | Compete over a shared customer market, win a contract/customer segment or negotiate an acquisition | Competition simulation, anti-griefing, fair matchmaking, property rights, acquisition and market-share calculations | **Planned** |
| **6 — Pitch Battles** | #6 | Pitch a new business to player-investors with transparent terms, vote/commit simulated capital and observe the outcome | Investor risk disclosures, valuation rules, contracts, anti-collusion, bounded downside and settlement | **Planned** |
| **7 — GWAP Syndicates** | #7 | Create/join a crew, establish a shared venture, contribute under clear ownership rules, compete in a weekly cooperative challenge | Membership/roles, consent-based treasury governance, exit and dispute rights, abuse monitoring and collective scores | **Planned** |

**Cross-cutting pillar #8 — Your Choices Follow You:** introduce a *small, explainable* reliability history in Phase 1, extend to agreement fulfillment in Phase 2, market integrity in Phase 3, and partnership/crew reputation in Phases 6–7. Reputation must be appealable/correctable when a dispute is settled; never equate low wealth with bad character. Keep economic success and trustworthiness distinct. Do not integrate with external GwapScore or public financial identities without a separate privacy/security decision.

**Ordering flexibility:** small world events can be trialed earlier than Phase 4 if doing so improves the first-business experience. Roadmap sequencing and numerical balancing may change following playtests, but the eight pillars remain the creative anchor unless the founder explicitly changes them.

### 4. Early player participation — experience the journey while we build

- **Wave A — internal Preview:** test bot, isolated Neon/Vercel Preview, synthetic/test accounts; prove the Origin and business transaction invariants before real progression.
- **Wave B — opt-in closed alpha:** small invited Telegram cohort; unlock the latest completed playable slice behind server-side feature flags. Collect structured feedback after key moments, plus anonymous/aggregate gameplay metrics. Clearly mark alpha rules, resets and fictional value.
- **Wave C — progressively expanding beta:** expand access only after phase-specific security, economic and operational gates are met. Keep older gameplay intact while adding the next pillar. Publish short in-app "what's new" / next unlock notes.
- **Wave D — public release:** **separate explicit founder approval** after final bot/domain/TLS, device QA, legal disclosures, recovery/restore, abuse/rate limiting, monitoring, and economy integrity gates. The roadmap alone does **not** authorize public release.

**Never conflate Preview readiness or a successful build with release authorization.** Android testing may remain deferred during isolated prototyping, but mobile acceptance requirements must be revisited before public release.

### 5. Universal definition of done for each playable phase

1. **Player value:** the phase has a five-minute *meaningful next step* (or a clearly justified longer intentional learning loop), with cinematic explanation and visible consequences.
2. **Integrity:** authenticated Telegram identity; server-controlled balances, ownership and outcomes; idempotency keys and atomic multi-party transactions where required; no spoofed client "profits".
3. **Continuity:** previous balances, Origin best score, companies, contracts and reputation persist without involuntary resets; feature-flagged migrations are reversible and tested in isolated storage.
4. **Economy:** simulate creation/sinks of G, insolvency, recovery, exploit paths and player collusion; verify no infinite replay grants, negative balances, duplicate payouts or unbacked asset transfers.
5. **Player safety:** clear simulated economy labels, accessible UX, fraud and rate limits, reporting/dispute mechanism appropriate to feature complexity; no real-money conversion.
6. **Operations:** production-like monitoring, incident response, restore evidence and data protection; release candidate checks green and manual Telegram WebView QA recorded.
7. **Founder gate:** branch/PR reviewed and explicitly approved for merge or deployment. Design approval does **not** override this step.

### 6. Playtest scorecard (review each increment)

Track: v1 qualification completion; Origin score distribution; percent who can afford a first enterprise; median time to open the first business; first/second successful operating cycle; daily/weekly return rate; meaningful deal creation and fulfillment; business bankruptcies and recoveries; G issued/sunk/net creation; ledger mismatches (target **zero**); duplicate/replay capital grants (target **zero**); economic exploits; reported confusion; player-requested improvements. Segment newcomers versus returning legacy testers without exposing private identifiers.

After each playable increment: (a) inspect metrics, (b) collect direct player feedback, (c) triage economic/security issues, (d) revise the *next phase's* acceptance criteria, (e) retain a dated decision log. Proposed numeric thresholds and launch dates should be added **only when evidence supports them**.

### 7. Source-of-truth relationships and conflicts

- **This document:** canonical product vision, eight pillars, player journey and incrementally playable roadmap.
- **Draft PR #47** and \`docs/V2_ZERO_TO_EMPIRE_ECONOMY.md\` (on its draft branch): detailed proposed qualification, ledger and XP economy; numerical proposals require review.
- **Existing \`docs/V2_IMPLEMENTATION_DESIGN.md\`:** older *unapproved* hideout/tapping/raid/heist concept. Where it conflicts with this document's earned-capital, enterprise-building, player-negotiation and legitimate-strategy mission, **the Business Underworld direction takes precedence**. It is not a parallel product mandate. Assess useful engineering patterns individually; do not port uncapped tapping, passive inflation or combat mechanics by default.
- **v1 release runbook and README:** current tested architecture/release evidence. Neither is modified by this design-only roadmap.
- **GWAP launch gateboard:** operational release checklist; do not mark unverified work as complete.

### 8. Immediate next build sequence

1. Reconcile PR #47 with this roadmap; explicitly decide any economic numbers before moving them out of design.
2. Implement/test the Origin qualification and replay best-score grants **in an isolated feature branch and database**; preserve legacy v1 and create a reversible opt-in path for existing testers.
3. Prototype **one playable first-business loop**: start enterprise → choose a business decision → incur cost → serve customers → settle ledger → reflect result/reputation.
4. Bring the prototype to the private Telegram test bot, gather player reactions, iterate; only then open Phase 2's two-party deals.
5. Add future pillars through the same evidence-driven releases. **Never merge or deploy to production without separate approval.**

**North-star experience:** "I started with nothing, made consequential business decisions, built an enterprise, and now the people, markets and rivalries around me respond to what I do."

# GWAPOHOLICS — v1 production plan

Status: **approved creative direction; implementation and release pending**.

## Production sequence

### P0. Source baseline
- Import the current READY Vercel preview without modifying its economic model.
- Preserve case IDs: `streaming-pivot`, `brand-backlash`, `supply-shock`, `founder-runway`, `inflation-trap`.
- Add regression tests for economic invariants; require checks before merges.
- Do not confuse the existing browser-only save with a safe, shared ledger.

### P1. First cinematic episode
- Produce one complete play-through of **The Streaming Pivot**.
- Nine scene images: introduction, four decisions, four outcome bands.
- Overlay narrator characters (GWAP-O, Advisor, Market Force, Future You) as separate layers; speech text remains accessible HTML.
- Have a single foreground narrator at a time, with skip controls and `prefers-reduced-motion`.
- Animate on navigation, decision selection, consequence beat, and settlement.
- Use stable case ID + stage index + outcome band, not visible titles, to map visuals.
- Preserve hidden payoff logic; environmental art cannot indicate a correct choice.

### P2. Full content expansion
- Add four other complete cases at the same quality, with all quest scene asset specs and supporting cast.
- Reuse the same scene renderer, transition presets, loading behavior, fallback artwork, and dialogue component.
- Do not increase the mission count for v1.

### P3. Trustworthy player state
- Validate Telegram WebApp `initData` using bot token **only on the server**; check `auth_date`.
- Use opaque server session / authenticated fetches, rate limiting, strict validation.
- Use a persistent database for player balance, completed quests, draft choices, recovery timers, and idempotent ledger entries.
- Settle a four-choice mission exactly once using a transaction and unique constraint.
- Detect impossible paths and tampered choices; reject double submission, retries, and concurrent claims.
- Build an intentional migration strategy from non-authoritative local demo progress; do **not** trust local balances as monetary truth.
- No public Solana token or withdrawals at v1.

### P4. Acceptance / release
- Full five-quest happy path and negative-path tests, including refresh/close/resume and low balance.
- Telegram on iPhone + Android; fallback when WebApp APIs/haptics unavailable.
- Image performance on ordinary mobile networks, resilient failures, `prefers-reduced-motion`, legible contrast.
- Beta group, retention signals, funnel from bot launch to completed quest, error logging.
- Obtain explicit approval for production promotion and bot settings; no automatic production or .ton redirect changes.

## Approval gates

**Gate 1:** baseline imported and CI passes.
**Gate 2:** one story-rich chapter tested in preview.
**Gate 3:** authoritative backend and all quests pass end-to-end QA.
**Gate 4:** founder reviews production release candidate.

## Post-v1 parking lot

Player interaction, additional game modes, new quests, tradable token and DEX withdrawals are intentionally **out of scope** until their economies and security have been separately reviewed.

# Daily Challenge Expansion Plan

## Direction
Extend the existing local-first Daily Challenge without touching the authenticated G coin economy. Each date deterministically selects one modifier and one rotating bonus mini-game, while the four existing business decisions remain the core run.

## Design
- **Movement:** Neon boardroom arcade; high-contrast green, purple, and orange against near-black.
- **Principles:** Fast decisions, visible consequences, educational signals, honest local persistence.
- **Interaction:** One-tap cards, compact progress meters, and score/achievement feedback after completion.
- **Typography:** Existing Barlow Condensed display face plus DM Sans body copy.
- **Brand voice:** Direct, playful, strategic: “Make the call.” / “Read the signal, not the headline.”

## Structure
- `daily-enhancements.mjs`: deterministic mini-game catalog, modifiers, score helpers, achievements.
- `app.mjs`: Daily Challenge bonus phase, modifier display, achievement persistence, profile surface.
- `styles.css`: bonus lab, modifiers, achievements, and daily status UI.
- `tests/daily-enhancements.test.mjs`: deterministic selection, scoring, and achievement coverage.

## Scope boundary
The leaderboard remains explicitly device-local in this change. A shared cross-player leaderboard needs a durable database table, authenticated score submission, replay/cheat validation, and production migration work.

# Story Mode V1 — implementation contract

Originally introduced on `feat/cinematic-story-mode-v1` as a content contract. Sprint 1A renders it full-screen for The Streaming Pivot.

## Runtime

- `story-runtime.mjs` is the authoritative narrative scene mapping keyed by exact `CASES[].id`.
- `narrativeScene(caseId, "intro")` → host opening.
- `narrativeScene(caseId, "decision", {round: 0..3})` → one speaker, one line, one illustration path per choice step.
- `narrativeScene(caseId, "result", {band})` → Future You takeaway and matching ending illustration.
- Image paths are *reserved* and must be supplied as optimized local/CDN assets before rendering.
- A scene is a visual accompaniment, **not an instruction or a scoring input**.

## Composition (Sprint 1A, full-screen)

1. Scene art fills the Telegram viewport edge to edge behind everything (`object-fit: cover`, per-scene focal point, slow camera preset).
2. Lighting/particle overlay and an adaptive dark gradient keep HUD, dialogue and decisions readable.
3. Minimal HUD: pause/exit, mission progress, balance, motion toggle.
4. One speaking character in the foreground with a typing speech bubble.
5. Bottom panel: prompt and three unambiguous choices, revealed after narration (skippable).
6. On selection: one-tap commit with feedback, then a consequence beat with a character reaction.
7. Result: band art, Future You lesson, settled coin count-up, next quest.

See `docs/CINEMATIC_SPRINT_1A.md` for the scene controller and accessibility details.

## QA

- Narration never recommends or reveals which option has the highest payoff.
- Time-limited Adobe share URLs are **not** committed or hotlinked for production.
- Test iOS/Android Telegram WebView, slow networks, reduced motion, and persistence.
- Do not rewrite `game-core.mjs` during the visual integration.
- Deploy only a Vercel preview until release approved.

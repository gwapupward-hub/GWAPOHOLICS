# Story Mode V1 — implementation contract

Branch: `feat/cinematic-story-mode-v1`. This phase introduces the **content contract only**. Artwork is not bundled yet and no existing UI loads the filenames until exported assets are available.

## Runtime

- `story-runtime.mjs` is the authoritative narrative scene mapping keyed by exact `CASES[].id`.
- `narrativeScene(caseId, "intro")` → host opening.
- `narrativeScene(caseId, "decision", {round: 0..3})` → one speaker, one line, one illustration path per choice step.
- `narrativeScene(caseId, "result", {band})` → Future You takeaway and matching ending illustration.
- Image paths are *reserved* and must be supplied as optimized local/CDN assets before rendering.
- A scene is a visual accompaniment, **not an instruction or a scoring input**.

## Composition

1. Upper two-thirds: scene artwork, zoom/parallax only within modest mobile performance budget.
2. Midframe: one character portrait/expression layer plus short dialogue bubble.
3. Lower third: accessible HTML copy and three unambiguous choice buttons.
4. On selection: haptic response if available, immediate one-tap commit, then a brief consequence beat.
5. Result: mapped illustration for the actual immutable settlement band, coin count, full takeaway, next quest.

## QA

- Narration never recommends or reveals which option has the highest payoff.
- Time-limited Adobe share URLs are **not** committed or hotlinked for production.
- Test iOS/Android Telegram WebView, slow networks, reduced motion, and persistence.
- Do not rewrite `game-core.mjs` during the visual integration.
- Deploy only a Vercel preview until release approved.

# GWAPOHOLICS v2.1 — Adaptive Audio QA Gate

## Current scope
- Native Web Audio remains the default. Tone.js is NOT installed or enabled.
- The optional adapter is injectable and disabled by default.
- Splash reveal routes through the audio director; business/XP event wiring remains future work.
- No changes to economy, authoritative settlement, or production.

## Before activating Tone.js
1. Select a pinned Tone.js release, verify its license and dependency footprint, and bundle locally (no remote CDN at runtime).
2. Load lazily after explicit user gesture, never before Telegram session verification; verify audio-context resume in Telegram iOS and Android.
3. Avoid two simultaneous sound engines: choose native or Tone adapter per cue, never both.
4. Add a feature flag defaulting to OFF with a safe fallback on failed import, audio unlock, or playback.
5. Ensure the user controls for music/effects/haptics remain authoritative, including persistence across sessions.
6. Verify volume, mute, background/foreground, device silent-mode behavior, and reduced-motion experience.
7. Verify no unconfirmed or duplicate settlement triggers an audio reward; do not trust UI balance changes as receipts.
8. Run unit tests, syntax checks, PostgreSQL integration, and Chromium/WebKit smoke tests on the exact candidate commit.
9. Capture device-level timing, memory, CPU, and audio interruption evidence before enabling.

## Acceptance
- Splash and gameplay remain fully usable with audio muted, unsupported, or disabled.
- No extra network requests to third-party audio services.
- No user-facing performance regression or clipped overlapping cues.
- No production merge/deploy without explicit owner approval.

# Cinematic Sprint 1A — full-screen Story Mode

Pilot: **The Streaming Pivot** only. The other four quests keep the classic layout until the founder approves Story Mode.

## What changed (presentation only)

| File | Role |
| --- | --- |
| `cinematic-view.mjs` | Full-screen stage renderer: edge-to-edge art (`<picture>` WebP + JPG), light/particle layer, adaptive shade, minimal HUD, one speaking character, typing bubble, bottom decision panel. |
| `story-director.mjs` | Scene state machine: `background → camera → details → enter → bubble → typing → choices`, then `locked → feedback → exit`. Owns every timer; a new shot, skip, or exit cancels them. Accepts one selection per shot. |
| `typewriter.mjs` | TypewriterDialogue: 30 ms/char default (clamped 10–80; `?typespeed=` for tuning), punctuation beats, tap-to-reveal, instant in reduced motion. The untyped text is pre-laid-out invisibly so the bubble never resizes per character. |
| `story-runtime.mjs` | Display direction per scene (focal point, camera preset, glow, particles, emotion, result effect) and consequence reactions keyed by the exact outcome text the player is shown. |
| `app.mjs` | Routes Streaming Pivot screens to Story Mode; choices still go through `chooseStep` / `completeChain` unchanged. |

`game-core.mjs` and `cases.mjs` are untouched: 1,000 G start, 4×3 decisions, settlement, 100 G minimum, recovery cooldown and replay protection are identical.

## Flow

Mission intro (GWAP-O, push-in toward the DVD/streaming floor) → round 1–4 (crossfade to that round's art; Advisor / Market Force / GWAP-O narrate the dilemma and setup) → choice feedback (chosen card pulses, others dim, green flash) → consequence beat (GWAP-O reacts to the resolved outcome text: worried = shake + red flash, celebrating = green glow, reflecting/surprised = dim) → final result (band art; Future You gives the outcome and lesson while the settled coin change counts up) → next quest.

Result presentations: **strong** celebrating + falling coins + gold light; **steady** talking + green glow + drift; **rough** reflecting + cool dim + pan; **collapse** worried + red impact flash + pull-back.

## Controls and accessibility

- Tap anywhere on the scene to hurry; tap the bubble or **Skip** to reveal all text and the decisions. **Esc** skips, Space/Enter hurries. Pause (❚❚) exits home with progress kept.
- Motion toggle (✦) applies in place without restarting the shot. With the OS reduced-motion setting and no explicit choice, text and decisions appear immediately.
- The typed layer is `aria-hidden`; a visually hidden copy holds the full dialogue and one polite live region announces each shot once. Decision panels are `inert` until narration ends; keyboard users get focus moved to the prompt.
- Safe areas: `env(safe-area-inset-*)` plus Telegram `--tg-safe-area-inset-*` / `--tg-content-safe-area-inset-*`. Height follows `viewportStableHeight`. Vertical swipes are disabled only while in Story Mode.
- Hidden app: the current shot completes instantly and ambient loops pause.

## Performance

- WebP variants (q78) cut scene + portrait weight from 1.13 MB to 0.67 MB; JPG remains the fallback.
- Preloads only the next scene and its speaker; the result scene is preloaded at the final choice (one band, computed by the existing `chainResult`).
- Animations use `transform` / `opacity`; tints are opacity-faded overlay layers, not animated filters. Particles are 10–22 small elements.

## Honest limits

- Scene art is a single flattened illustration per beat. Depth comes from CSS camera moves, overlay lighting and particles, and independent cast/bubble layers — not from fake cut-out layers. Pointer parallax (mouse only) moves background, light and cast by different amounts.
- Character portraits are raster concepts on dark plates, shown with a soft radial mask. `CHARACTER_ART[*].cutout` switches to transparent exports when they exist.

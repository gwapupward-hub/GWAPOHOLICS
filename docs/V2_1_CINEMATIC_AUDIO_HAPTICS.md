# v2.1 Cinematic Audio & Haptics

This change is presentation-only. It does not alter game state, choice evaluation, server requests, receipts, scoring, coin settlement, or founder economics.

## Sound and licensing record

The score and sound cues are composed procedurally in `sensory-layer.mjs` using Web Audio oscillators and envelopes. No music recording, downloaded sample, external audio URL, runtime audio request, or third-party composition is included. This makes the delivered implementation free of third-party audio assets and their attribution/royalty obligations. The motif is an original implementation written for this feature; this is **not** evidence of a separate commissioned music-library license. If the release requires a third-party/library track rather than the included original synthesized score, obtain and archive the supplier's license and track-specific rights before use.

Music and effects use separate gain buses. Music is a quiet, original ambient motif; effects respond to scene reveal, decisions, impact and success. Web Audio starts only after a user gesture, resumes on Telegram activation/foreground, and pauses while hidden. Browser autoplay failures are non-fatal.

## Settings and accessibility

- A keyboard- and screen-reader-labeled settings dialog independently controls music, music level, effects, effects level and Telegram haptics.
- Preferences are versioned and stored via Telegram DeviceStorage where available, with guarded localStorage fallback. Storage/API failures never block gameplay.
- Native Telegram `impactOccurred`, `notificationOccurred` and `selectionChanged` calls are guarded by the haptics preference; impact bursts are throttled to one per 60 ms.
- The game is fully playable with sound/haptics disabled or unsupported. Controls have accessible names, the dialog has a heading, range controls have labels, and focus returns to its opener.
- Reduced-motion remains governed by the existing cinematic preference and CSS; audio is independent and can be muted separately.

## Verification status and Preview device checks

Automated coverage is in `tests/sensory-layer.test.mjs` and runs as part of `npm test`. It covers settings normalization/persistence, native haptic opt-out/throttling, optional APIs, gesture-gated audio, and visibility lifecycle. CI must still run against the pushed commit; a green automated run does not replace physical-device checks.

Before acceptance, use the isolated Preview / `@TestGwap_bot` only:
1. On a physical iPhone and Android device, verify music begins only after a tap, toggles/levels persist after closing and reopening the Mini App, and the score pauses/resumes across app/background transitions and screen lock.
2. Verify settings dialog screen-reader labels, keyboard focus/escape, 200% zoom, reduced-motion setting, mute controls, and layout at 320 px and short viewport heights.
3. Confirm supported Telegram haptics on choice, progress and result events; confirm no vibration when disabled or unsupported and no repeated buzz during rapid taps.
4. Check headphones/speaker volume and that effects do not mask narration; test interrupted Web Audio context recovery and storage-denied mode.
5. Confirm Preview-only build, no production deployment or bot setting changes. No merge or deployment is authorized by this implementation request.

## Completion follow-up

- Presentation integration is explicit through the scene director and confirmed settlement callback; no MutationObserver surveillance of gameplay DOM.
- Telegram feedback uses one guarded controller rather than mutating Telegram's host API.
- An original procedural score switches between menu, mission, tension, danger, victory, and Founder moods with a smoothed gain transition.
- No external music recordings or samples are incorporated. The intended score is original code-created synthesis; confirm the musical result in Preview before release.
- CI on the draft PR is the authoritative full repository test gate; physical iOS Telegram verification remains mandatory and Android remains pending if a device is not available.

## Cinematic string escalation and result payoff

- Original procedural bowed-string-like synthesis with two detuned oscillator layers and an optional low-pass filter; no external recording, loop, sample, or copyrighted composition.
- Tempo follows only accepted game progress: **64 → 78 → 94 → 112 → 136 BPM** for zero through four committed choices. It resets for each new mission or Origin quest. Visual suspense never predicts or influences financial outcome.
- The motif rises subtly as the player advances, giving urgency without a continuously loud alarm. Music remains independently muted or volume-limited through Settings; existing SFX and haptic opt-outs remain effective.
- When a settled money/score result actually enters the visible screen, a short original layered-string victory fanfare plays once. Financial setbacks get an encouraging, dignified resolving phrase rather than a misleading win cue.
- Presentation-only: no edits to server authority, coin settlement, quest scoring, wallets, ledger, or game state.
- Follow-up QA: verify progression in Telegram iPhone headphones and speakers, timing against count-up animation and narrated dialogue, restart/foreground behavior, audio opt-out, keyboard/reduced motion, and a complete 4-decision quest.

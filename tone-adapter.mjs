/**
 * Optional Tone.js adapter. Supply a loaded Tone namespace from a bundler or
 * locally hosted module; never fetch third-party scripts during gameplay.
 * Defaults to disabled until device QA approves the experiment.
 */
export function createToneAdapter({ Tone, enabled = false, getSettings = () => ({}), isVisible = () => true } = {}) {
  let synth = null;
  let disposed = false;
  const pitches = Object.freeze({
    "splash.reveal": ["C4", "G4"],
    "business.confirmed": ["C5", "E5", "G5"],
    "business.rejected": ["G3", "D3"],
    "founder.milestone": ["G4", "C5", "E5", "G5"]
  });
  function play(event) {
    const settings = getSettings();
    if (!enabled || disposed || !Tone || !isVisible() || settings.effects === false || !(Number(settings.effectsVolume ?? 1) > 0)) return false;
    if (!Object.hasOwn(pitches, event)) return false;
    // Never initiate a browser audio unlock outside a user gesture.
    if (Tone.context?.state !== "running") return false;
    try {
      if (!synth) synth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.02, decay: 0.12, sustain: 0.1, release: 0.25 } }).toDestination();
      const start = Tone.now() + 0.015;
      for (const [i, note] of pitches[event].entries()) synth.triggerAttackRelease(note, "16n", start + i * 0.11, Math.min(0.4, Number(settings.effectsVolume ?? 0.3) * 0.4));
      return true;
    } catch { return false; }
  }
  function dispose() {
    disposed = true;
    try { synth?.dispose?.(); } catch { /* optional */ }
    synth = null;
  }
  return { play, dispose };
}

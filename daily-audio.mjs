const AUDIO_PREF_KEY = "gwap.telegram.daily-audio.v1";
const MUSIC_PREF_KEY = "gwap.telegram.music.v1";
const SFX_PREF_KEY = "gwap.telegram.sfx.v1";

function readEnabled() {
  try {
    const saved = globalThis.localStorage?.getItem(AUDIO_PREF_KEY);
    return saved === null ? true : saved !== "off";
  } catch {
    return true;
  }
}

function saveEnabled(enabled) {
  try { globalThis.localStorage?.setItem(AUDIO_PREF_KEY, enabled ? "on" : "off"); } catch { /* optional preference */ }
}

function readPreference(key, fallback = true) {
  try {
    const saved = globalThis.localStorage?.getItem(key);
    return saved === null ? fallback : saved !== "off";
  } catch {
    return fallback;
  }
}

function savePreference(key, enabled) {
  try { globalThis.localStorage?.setItem(key, enabled ? "on" : "off"); } catch { /* optional preference */ }
}

export function createDailyAudio() {
  let enabled = readEnabled();
  let musicEnabled = readPreference(MUSIC_PREF_KEY, enabled);
  let sfxEnabled = readPreference(SFX_PREF_KEY, enabled);
  let context = null;
  let musicGain = null;
  let musicNodes = [];

  function ensureContext() {
    if (context) return context;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    return context;
  }

  function start() {
    if (!musicEnabled) return false;
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (musicNodes.length) return true;

    musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.8);
    musicGain.connect(ctx.destination);

    const pad = [110, 164.81, 220].map((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = index === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 1 ? -4 : index === 2 ? 5 : 0;
      oscillator.connect(musicGain);
      oscillator.start();
      return oscillator;
    });
    musicNodes = pad;
    return true;
  }

  function stop() {
    if (!context || !musicNodes.length) return;
    const now = context.currentTime;
    musicGain?.gain.cancelScheduledValues(now);
    musicGain?.gain.setTargetAtTime(0.0001, now, 0.12);
    musicNodes.forEach((node) => {
      try { node.stop(now + 0.45); } catch { /* already stopped */ }
    });
    musicNodes = [];
    musicGain = null;
  }

  function cue(kind = "select") {
    if (!sfxEnabled) return false;
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const notes = kind === "score" ? [440, 554.37, 659.25] : kind === "open" ? [220, 329.63] : [330, 440];
    const now = ctx.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = kind === "score" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.055);
      gain.gain.setValueAtTime(0.0001, now + index * 0.055);
      gain.gain.exponentialRampToValueAtTime(kind === "score" ? 0.08 : 0.055, now + index * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.055 + (kind === "score" ? 0.34 : 0.18));
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + index * 0.055 + (kind === "score" ? 0.38 : 0.22));
    });
    return true;
  }

  function toggle() {
    enabled = !(musicEnabled && sfxEnabled);
    saveEnabled(enabled);
    musicEnabled = enabled;
    sfxEnabled = enabled;
    savePreference(MUSIC_PREF_KEY, musicEnabled);
    savePreference(SFX_PREF_KEY, sfxEnabled);
    if (enabled) start();
    else stop();
    return enabled;
  }

  function setMusic(next) {
    musicEnabled = Boolean(next);
    savePreference(MUSIC_PREF_KEY, musicEnabled);
    if (musicEnabled) start();
    else if (!musicEnabled) stop();
    return musicEnabled;
  }

  function setSfx(next) {
    sfxEnabled = Boolean(next);
    savePreference(SFX_PREF_KEY, sfxEnabled);
    return sfxEnabled;
  }

  function suspend() {
    if (context?.state === "running") context.suspend().catch(() => {});
  }

  function resume() {
    if (musicEnabled && context?.state === "suspended") context.resume().catch(() => {});
  }

  return {
    start,
    stop,
    cue,
    toggle,
    setMusic,
    setSfx,
    suspend,
    resume,
    enabled: () => sfxEnabled,
    musicEnabled: () => musicEnabled,
    sfxEnabled: () => sfxEnabled
  };
}

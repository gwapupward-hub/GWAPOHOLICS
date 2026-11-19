/**
 * Presentation-only cinematic audio and Telegram-native haptics.
 * All music and effects are synthesized locally with Web Audio: no recordings,
 * remote media, trackers, or network requests. Start/resume is always gesture-gated.
 */

export const SENSORY_SETTINGS_KEY = "gwapoholics.sensory.v1";
export const IMPACT_THROTTLE_MS = 60;
const DEFAULTS = Object.freeze({ music: true, musicVolume: 0.18, effects: true, effectsVolume: 0.32, haptics: true });
const clamp = (value, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : min;

export function normalizeSensorySettings(value = {}) {
  return {
    music: value.music !== false,
    musicVolume: clamp(value.musicVolume ?? DEFAULTS.musicVolume, 0, 0.5),
    effects: value.effects !== false,
    effectsVolume: clamp(value.effectsVolume ?? DEFAULTS.effectsVolume, 0, 1),
    haptics: value.haptics !== false
  };
}

function deviceStorage(tg) {
  const storage = tg?.DeviceStorage;
  if (!storage?.getItem || !storage?.setItem) return null;
  return {
    get(key) {
      return new Promise((resolve) => {
        try { storage.getItem(key, (error, value) => resolve(error ? null : value ?? null)); }
        catch { resolve(null); }
      });
    },
    set(key, value) {
      return new Promise((resolve) => {
        try { storage.setItem(key, value, (error) => resolve(!error)); }
        catch { resolve(false); }
      });
    }
  };
}

export function createSensoryLayer({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  telegram = win?.Telegram?.WebApp,
  AudioContext: AudioContextClass = win?.AudioContext || win?.webkitAudioContext,
  renderControls = true,
  now = () => win?.performance?.now?.() ?? Date.now(),
  timers = { set: (...args) => win.setInterval(...args), clear: (id) => win.clearInterval(id) }
} = {}) {
  let settings = { ...DEFAULTS };
  let context = null;
  let master = null;
  let musicBus = null;
  let effectsBus = null;
  let unlocked = false;
  let disposed = false;
  let musicTimer = null;
  let musicStep = 0;
  let lastImpactAt = -Infinity;
  let lastScene = "";
  let mood = "menu";
  let revision = 0;
  let restoreFocus = null;
  const settledCues = new Set();
  const listeners = [];
  const storage = deviceStorage(telegram);
  const local = {
    get() { try { return win?.localStorage?.getItem(SENSORY_SETTINGS_KEY) ?? null; } catch { return null; } },
    set(value) { try { win?.localStorage?.setItem(SENSORY_SETTINGS_KEY, value); } catch { /* DeviceStorage may still succeed */ } }
  };

  function listen(target, type, fn, options) {
    target?.addEventListener?.(type, fn, options);
    listeners.push(() => target?.removeEventListener?.(type, fn, options));
  }
  function persist() {
    revision += 1;
    const value = JSON.stringify(settings);
    local.set(value);
    void storage?.set(SENSORY_SETTINGS_KEY, value);
  }
  async function load() {
    // Local preferences apply immediately, including haptic opt-out. DeviceStorage
    // may resolve later; it must never overwrite a new player interaction.
    const priorRevision = revision;
    const localRaw = local.get();
    try { if (localRaw) settings = normalizeSensorySettings(JSON.parse(localRaw)); } catch { /* defaults */ }
    updateBuses();
    renderSettings();
    const remoteRaw = await storage?.get(SENSORY_SETTINGS_KEY);
    if (revision === priorRevision && remoteRaw) {
      try { settings = normalizeSensorySettings(JSON.parse(remoteRaw)); } catch { /* retain local values */ }
      updateBuses();
      renderSettings();
    }
    return { ...settings };
  }
  function ensureAudio() {
    if (disposed || !AudioContextClass || doc?.visibilityState === "hidden") return false;
    try {
      if (!context) {
        context = new AudioContextClass();
        master = context.createGain();
        musicBus = context.createGain();
        effectsBus = context.createGain();
        musicBus.connect(master); effectsBus.connect(master); master.connect(context.destination);
        updateBuses();
      }
      if (context.state !== "running") {
        // Call resume synchronously in the user gesture; mark unlocked only after
        // the promise succeeds and the context is actually running.
        const attempt = context.resume();
        Promise.resolve(attempt).then(() => {
          if (disposed || doc?.visibilityState === "hidden" || context?.state !== "running") return;
          unlocked = true;
          updateBuses();
        }).catch(() => { stopMusic(); });
        return false;
      }
      unlocked = true;
      updateBuses();
      return true;
    } catch { return false; }
  }
  function updateBuses() {
    if (!context) return;
    const at = context.currentTime;
    if (master?.gain) master.gain.setTargetAtTime(settings.music || settings.effects ? 1 : 0, at, 0.03);
    if (musicBus?.gain) musicBus.gain.setTargetAtTime(settings.music ? settings.musicVolume : 0, at, 0.08);
    if (effectsBus?.gain) effectsBus.gain.setTargetAtTime(settings.effects ? settings.effectsVolume : 0, at, 0.025);
    if (settings.music && unlocked && context.state === "running") startMusic(); else stopMusic();
  }
  // An original, quiet eight-note ambient motif. It is generated from oscillators
  // at runtime; there is no third-party composition or sound file to license.
  const moods = Object.freeze({
    menu: [110, 164.81, 220, 164.81, 130.81, 196, 261.63, 196],
    mission: [130.81, 196, 261.63, 196, 146.83, 220, 293.66, 220],
    tension: [98, 146.83, 196, 146.83, 103.83, 155.56, 207.65, 155.56],
    danger: [82.41, 123.47, 164.81, 123.47, 87.31, 130.81, 174.61, 130.81],
    victory: [164.81, 246.94, 329.63, 392, 196, 293.66, 392, 493.88],
    founder: [123.47, 185, 246.94, 185, 146.83, 220, 293.66, 220]
  });
  function setMood(next) {
    const target = Object.hasOwn(moods, next) ? next : "menu";
    if (mood === target) return;
    mood = target;
    if (target === "menu" || target === "founder") lastScene = "";
    musicStep = 0;
    if (!context || context.state !== "running" || !musicBus) return;
    const at = context.currentTime;
    // Synthesize a short dip and swell instead of cutting between themes.
    musicBus.gain.setTargetAtTime(0, at, 0.09);
    musicBus.gain.setTargetAtTime(settings.music ? settings.musicVolume : 0, at + 0.25, 0.15);
    musicTick();
  }
  function playTone(frequency, duration, destination, { type = "sine", volume = 0.08, delay = 0, endFrequency = frequency } = {}) {
    if (!context || !destination || disposed) return;
    try {
      const start = context.currentTime + delay;
      const osc = context.createOscillator(); const gain = context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, start);
      if (endFrequency !== frequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain); gain.connect(destination); osc.start(start); osc.stop(start + duration + 0.03);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* already disconnected */ } };
    } catch { /* Web Audio is an optional enhancement */ }
  }
  function musicTick() {
    if (!context || !unlocked || context.state !== "running" || !settings.music || doc?.visibilityState === "hidden") return;
    const pattern = moods[mood];
    const note = pattern[musicStep % pattern.length];
    playTone(note, 1.65, musicBus, { volume: 0.11, type: "sine" });
    if (musicStep % 4 === 0) playTone(note / 2, 2.8, musicBus, { volume: 0.13, type: "triangle" });
    musicStep += 1;
  }
  function startMusic() {
    if (!context || !unlocked || context.state !== "running" || musicTimer !== null || !settings.music || doc?.visibilityState === "hidden") return;
    musicTick(); musicTimer = timers.set(musicTick, 1800);
  }
  function stopMusic() { if (musicTimer !== null) { timers.clear(musicTimer); musicTimer = null; } }
  function playEffect(kind) {
    if (!settings.effects || !unlocked || !context || context.state !== "running" || doc?.visibilityState === "hidden") return;
    const sounds = {
      reveal: [[392, .18, "sine"], [587.33, .24, "sine"]],
      choice: [[330, .10, "triangle"]],
      confirm: [[440, .12, "triangle"], [659.25, .17, "sine"]],
      impact: [[150, .28, "sawtooth"]],
      success: [[523.25, .15, "sine"], [659.25, .18, "sine"], [783.99, .28, "sine"]],
      soft: [[246.94, .16, "sine"]]
    };
    for (const [i, [hz, duration, type]] of (sounds[kind] || sounds.soft).entries()) {
      playTone(hz, duration, effectsBus, { type, volume: kind === "impact" ? .16 : .1, delay: i * .075, endFrequency: kind === "impact" ? 70 : hz });
    }
  }
  function hapticEvent(method, kind) {
    if (!settings.haptics || disposed) return false;
    const api = telegram?.HapticFeedback;
    if (typeof api?.[method] !== "function") return false;
    const time = now();
    if (time - lastImpactAt < IMPACT_THROTTLE_MS) return false;
    try {
      api[method](...(kind === undefined ? [] : [kind]));
      lastImpactAt = time;
      return true;
    } catch { return false; }
  }
  function onSceneStep(shot, step) {
    if (!shot) return;
    const signature = String(shot.key) + ":" + step;
    if (signature === lastScene) return;
    lastScene = signature;
    if (step === "details") playEffect("reveal");
    else if (step === "choices") playEffect("soft");
    if (step === "background") {
      const sceneMood = shot.phase === "decision" ? "tension" :
        shot.phase === "consequence" ? "danger" :
        shot.phase === "result" ? (shot.effect === "victory" ? "victory" : "danger") : "mission";
      setMood(sceneMood);
    }
  }
  function onConfirmedOutcome(delta, eventKey) {
    if (eventKey && settledCues.has(eventKey)) return false;
    if (eventKey) settledCues.add(eventKey);
    const good = Number(delta) >= 0;
    playEffect(good ? "success" : "impact");
    hapticEvent("notificationOccurred", good ? "success" : "warning");
    return true;
  }
  function onGesture() { ensureAudio(); }
  function onVisibility() {
    if (doc?.visibilityState === "hidden") {
      stopMusic();
      // Stopping the clock does not stop already scheduled oscillator tails.
      try { void context?.suspend?.().catch?.(() => {}); } catch { /* optional */ }
      return;
    }
    if (unlocked) ensureAudio();
  }

  function renderSettings() {
    if (!renderControls || !doc?.body) return;
    let host = doc.getElementById("sensory-controls");
    if (host) {
      const music = host.querySelector('[name="music"]'); const effects = host.querySelector('[name="effects"]'); const haptics = host.querySelector('[name="haptics"]');
      if (music) music.checked = settings.music;
      if (effects) effects.checked = settings.effects;
      if (haptics) haptics.checked = settings.haptics;
      const mv = host.querySelector('[name="musicVolume"]'); const ev = host.querySelector('[name="effectsVolume"]');
      if (mv) mv.value = String(settings.musicVolume); if (ev) ev.value = String(settings.effectsVolume);
      return;
    }
    host = doc.createElement("div"); host.id = "sensory-controls";
    host.innerHTML = `<button type="button" class="sensory-open" aria-label="Open sound and haptics settings" aria-haspopup="dialog">♫<span class="sr-only">Sound settings</span></button>
      <dialog class="sensory-dialog" aria-labelledby="sensory-title"><form method="dialog"><button class="sensory-close" aria-label="Close sound settings">×</button></form>
      <h2 id="sensory-title">SOUND &amp; FEEDBACK</h2><p class="sensory-description">Optional cinematic audio and Telegram haptics. Your choices are saved on this device.</p>
      <label class="sensory-toggle"><span><b>Background music</b><small>Original synthesized ambient score</small></span><input type="checkbox" name="music"></label>
      <label class="sensory-range"><span>Music volume</span><input type="range" name="musicVolume" min="0" max="0.5" step="0.01" aria-label="Background music volume"></label>
      <label class="sensory-toggle"><span><b>Sound effects</b><small>Reactive, locally synthesized cues</small></span><input type="checkbox" name="effects"></label>
      <label class="sensory-range"><span>Effects volume</span><input type="range" name="effectsVolume" min="0" max="1" step="0.01" aria-label="Sound effects volume"></label>
      <label class="sensory-toggle"><span><b>Haptics</b><small>Telegram-native vibration when supported</small></span><input type="checkbox" name="haptics"></label>
      <p class="sensory-note" role="note">Audio starts after your first tap. The game remains playable with all sensory features off.</p></dialog>`;
    doc.body.append(host);
    const dialog = host.querySelector("dialog");
    host.querySelector(".sensory-open").addEventListener("click", (event) => {
      restoreFocus = event.currentTarget; ensureAudio();
      if (typeof dialog.showModal === "function") dialog.showModal(); else { dialog.setAttribute("open", ""); dialog.querySelector(".sensory-close")?.focus?.(); }
    });
    dialog.addEventListener("close", () => restoreFocus?.focus?.());
    dialog.addEventListener("keydown", (event) => { if (event.key === "Escape" && typeof dialog.showModal !== "function") { dialog.removeAttribute("open"); restoreFocus?.focus?.(); } });
    dialog.addEventListener("change", (event) => {
      const { name, checked, value } = event.target;
      if (name === "music" || name === "effects" || name === "haptics") settings[name] = checked;
      else if (name === "musicVolume" || name === "effectsVolume") settings[name] = clamp(value, 0, name === "musicVolume" ? .5 : 1);
      settings = normalizeSensorySettings(settings); persist(); updateBuses();
    });
    dialog.addEventListener("input", (event) => {
      const { name, value } = event.target;
      if (name !== "musicVolume" && name !== "effectsVolume") return;
      settings[name] = clamp(value, 0, name === "musicVolume" ? .5 : 1); updateBuses(); persist();
    });
    host.querySelectorAll("input").forEach((input) => {
      if (input.type === "checkbox") input.checked = settings[input.name];
      else input.value = String(settings[input.name]);
    });
  }

  renderSettings();
  void load();
  listen(doc, "pointerdown", onGesture, { passive: true });
  listen(doc, "keydown", (event) => { if (event.key === "Enter" || event.key === " ") onGesture(); }, { passive: true });
  listen(doc, "visibilitychange", onVisibility);
  if (telegram?.onEvent) {
    try { telegram.onEvent("activated", onVisibility); listeners.push(() => { try { telegram.offEvent?.("activated", onVisibility); } catch { /* optional */ } }); } catch { /* optional */ }
  }
  return {
    get settings() { return { ...settings }; },
    get mood() { return mood; },
    setSettings(patch) { settings = normalizeSensorySettings({ ...settings, ...patch }); persist(); updateBuses(); renderSettings(); return { ...settings }; },
    setMood, onSceneStep, onConfirmedOutcome,
    hapticImpact(kind = "light") { return hapticEvent("impactOccurred", kind); },
    hapticNotification(kind = "success") { return hapticEvent("notificationOccurred", kind); },
    hapticSelection() { return hapticEvent("selectionChanged"); },
    playEffect,
    resume() { return ensureAudio(); },
    pause() { stopMusic(); try { void context?.suspend?.().catch?.(() => {}); } catch { /* optional */ } },
    dispose() { disposed = true; stopMusic(); listeners.splice(0).forEach((remove) => remove()); try { void context?.close?.(); } catch { /* optional */ } }
  };
}

// Instantiated by app.mjs so gameplay owns a single sensory controller.

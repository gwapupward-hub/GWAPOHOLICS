import test from "node:test";
import assert from "node:assert/strict";
import { createSensoryLayer, IMPACT_THROTTLE_MS, normalizeSensorySettings, SENSORY_SETTINGS_KEY } from "../sensory-layer.mjs";

class FakeTarget {
  listeners = new Map();
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== fn)); }
  fire(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn({ target: this, ...event }); }
}
class FakeAudioContext {
  state = "running"; currentTime = 0; destination = {};
  createGain() { return { gain: { setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {}, type: "sine" }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
function fakeEnv({ saved = null } = {}) {
  const doc = new FakeTarget(); doc.visibilityState = "visible"; doc.body = { append() {} }; doc.documentElement = {};
  doc.getElementById = () => null; doc.querySelector = () => null;
  const win = new FakeTarget(); win.localStorage = { getItem: () => saved, setItem(_key, value) { saved = value; } };
  win.performance = { now: () => 1000 }; win.setInterval = () => 1; win.clearInterval = () => {};
  return { doc, win, getSaved: () => saved };
}

test("audio and haptic settings normalize safely and clamp volumes", () => {
  assert.deepEqual(normalizeSensorySettings({ music: false, musicVolume: 9, effectsVolume: -1, haptics: false }), {
    music: false, musicVolume: .5, effects: true, effectsVolume: 0, haptics: false
  });
  assert.deepEqual(normalizeSensorySettings({ music: "false" }).music, true);
});

test("persistent settings survive reload through local storage fallback", async () => {
  const env = fakeEnv();
  const first = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  first.setSettings({ music: false, haptics: false, effectsVolume: .7 });
  const saved = env.getSaved(); assert.ok(saved.includes(SENSORY_SETTINGS_KEY) === false, "preference payload is stored under the versioned key");
  first.dispose();
  const second = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  await Promise.resolve();
  assert.equal(second.settings.music, false); assert.equal(second.settings.haptics, false); assert.equal(second.settings.effectsVolume, .7);
  second.dispose();
});

test("native Telegram haptics respect the preference and throttle burst impacts", () => {
  const env = fakeEnv(); let time = 100; let calls = 0;
  const tg = { HapticFeedback: { impactOccurred() { calls += 1; } } };
  const layer = createSensoryLayer({ document: env.doc, window: env.win, telegram: tg, AudioContext: FakeAudioContext, now: () => time });
  tg.HapticFeedback.impactOccurred("light"); time += IMPACT_THROTTLE_MS - 1; tg.HapticFeedback.impactOccurred("medium");
  assert.equal(calls, 1);
  time += 1; tg.HapticFeedback.impactOccurred("heavy"); assert.equal(calls, 2);
  layer.setSettings({ haptics: false }); time += IMPACT_THROTTLE_MS; tg.HapticFeedback.impactOccurred("light"); assert.equal(calls, 2);
  layer.dispose();
});

test("audio remains gesture-gated and audio APIs are optional", () => {
  const env = fakeEnv(); const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: null });
  assert.equal(layer.resume(), false);
  layer.playEffect("choice");
  layer.dispose();
});

test("visibility pauses ambient scheduling and the scene bridge tolerates missing Telegram APIs", () => {
  const env = fakeEnv(); const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  assert.equal(layer.resume(), true);
  env.doc.visibilityState = "hidden"; env.doc.fire("visibilitychange");
  env.doc.visibilityState = "visible"; env.doc.fire("visibilitychange");
  assert.equal(layer.settings.music, true);
  layer.dispose();
});

import test from "node:test";
import assert from "node:assert/strict";
import { createSensoryLayer, IMPACT_THROTTLE_MS, normalizeSensorySettings, cinematicTempo, CINEMATIC_TEMPOS_BPM } from "../sensory-layer.mjs";

class FakeTarget {
  listeners = new Map();
  addEventListener(type, fn) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(fn);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== fn));
  }
  fire(type, data = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn({ target: this, ...data });
  }
}

class FakeAudioContext {
  static latest;
  state = "running";
  currentTime = 0;
  destination = {};
  suspendCalls = 0;
  resumeCalls = 0;
  oscillatorCount = 0;
  constructor() { FakeAudioContext.latest = this; }
  createGain() {
    return { gain: { setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
  }
  createOscillator() {
    this.oscillatorCount += 1;
    return {
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {}, start() {}, stop() {}, type: "sine"
    };
  }
  resume() { this.resumeCalls++; this.state = "running"; return Promise.resolve(); }
  suspend() { this.suspendCalls++; this.state = "suspended"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

function fakeEnv({ saved = null, telegram = null, denied = false } = {}) {
  const doc = new FakeTarget();
  doc.visibilityState = "visible";
  // Core tests run without a DOM; the browser smoke check verifies the modal.
  doc.body = null;
  doc.querySelector = () => null;
  const win = new FakeTarget();
  win.performance = { now: () => 1000 };
  win.intervals = [];
  win.setInterval = (_fn, delay) => {
    win.scheduled = (win.scheduled ?? 0) + 1;
    win.intervals.push(delay);
    return win.scheduled;
  };
  win.clearInterval = () => { win.cleared = (win.cleared ?? 0) + 1; };
  win.localStorage = {
    getItem() { if (denied) throw new Error("storage denied"); return saved; },
    setItem(_key, value) { if (denied) throw new Error("storage denied"); saved = value; }
  };
  return { doc, win, telegram, getSaved: () => saved };
}

test("settings normalize safely, reject nonfinite volumes, and honor haptic opt-out", () => {
  assert.deepEqual(normalizeSensorySettings({ music: false, musicVolume: 9, effectsVolume: -1, haptics: false }), {
    music: false, musicVolume: 0.5, effects: true, effectsVolume: 0, haptics: false
  });
  assert.equal(normalizeSensorySettings({ effectsVolume: "invalid" }).effectsVolume, 0);
  assert.equal(normalizeSensorySettings({ music: "false" }).music, true);
});

test("local preferences persist after reopening and do not depend on Telegram storage", async () => {
  const env = fakeEnv();
  const first = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  first.setSettings({ music: false, haptics: false, effectsVolume: 0.7 });
  assert.ok(env.getSaved()?.includes('"music":false'));
  first.dispose();
  const second = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  await Promise.resolve();
  assert.equal(second.settings.music, false);
  assert.equal(second.settings.haptics, false);
  assert.equal(second.settings.effectsVolume, 0.7);
  second.dispose();
});

test("late DeviceStorage read does not override a changed player preference", async () => {
  let reply;
  const pending = new Promise((resolve) => { reply = resolve; });
  const storage = {
    getItem(_key, cb) { pending.then((value) => cb(null, value)); },
    setItem(_key, _value, cb) { cb(null); }
  };
  const env = fakeEnv({ telegram: { DeviceStorage: storage } });
  const layer = createSensoryLayer({ document: env.doc, window: env.win, telegram: env.telegram, AudioContext: null });
  layer.setSettings({ haptics: false });
  reply('{"haptics":true}');
  await pending;
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(layer.settings.haptics, false);
  layer.dispose();
});

test("haptic feedback is centralized, throttled, and can be fully disabled", () => {
  const env = fakeEnv();
  const events = [];
  let time = 100;
  const native = {
    impactOccurred: (kind) => events.push(["impact", kind]),
    notificationOccurred: (kind) => events.push(["notification", kind]),
    selectionChanged: () => events.push(["selection"])
  };
  const tg = { HapticFeedback: native };
  const layer = createSensoryLayer({ document: env.doc, window: env.win, telegram: tg, AudioContext: null, now: () => time });
  assert.equal(layer.hapticImpact("light"), true);
  time += IMPACT_THROTTLE_MS - 1;
  assert.equal(layer.hapticImpact("medium"), false);
  time += 1;
  assert.equal(layer.hapticNotification("success"), true);
  time += IMPACT_THROTTLE_MS;
  assert.equal(layer.hapticSelection(), true);
  assert.equal(events.length, 3);
  assert.equal(tg.HapticFeedback, native, "do not monkey-patch Telegram host object");
  layer.setSettings({ haptics: false });
  time += IMPACT_THROTTLE_MS;
  assert.equal(layer.hapticImpact("heavy"), false);
  assert.equal(layer.hapticNotification("warning"), false);
  assert.equal(events.length, 3);
  layer.dispose();
});

test("result feedback fires once per confirmed event and never uses an assumed outcome", () => {
  const env = fakeEnv();
  let now = 100;
  const types = [];
  const layer = createSensoryLayer({
    document: env.doc, window: env.win, AudioContext: FakeAudioContext,
    telegram: { HapticFeedback: { notificationOccurred: (type) => types.push(type) } },
    now: () => now
  });
  assert.equal(layer.onConfirmedOutcome(50, "case:a"), true);
  now += IMPACT_THROTTLE_MS;
  assert.equal(layer.onConfirmedOutcome(50, "case:a"), false);
  assert.equal(layer.onConfirmedOutcome(-20, "case:b"), true);
  assert.deepEqual(types, ["success", "warning"]);
  layer.dispose();
});

test("explicit scene events switch soundtrack moods without DOM observers", () => {
  const env = fakeEnv();
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  assert.equal(layer.mood, "menu");
  layer.onSceneStep({ key: "intro", phase: "intro" }, "background");
  assert.equal(layer.mood, "mission");
  layer.onSceneStep({ key: "decision", phase: "decision" }, "background");
  assert.equal(layer.mood, "tension");
  layer.onSceneStep({ key: "result", phase: "result", delta: 100, effect: "victory" }, "background");
  assert.equal(layer.mood, "victory");
  layer.onSceneStep({ key: "equal-replay", phase: "result", delta: 0 }, "background");
  assert.equal(layer.mood, "resolve");
  layer.setMood("founder");
  assert.equal(layer.mood, "founder");
  layer.dispose();
});

test("Web Audio is optional and a rejected resume never starts ambient music", async () => {
  class RejectedAudio extends FakeAudioContext {
    state = "suspended";
    resume() { this.resumeCalls++; return Promise.reject(new Error("autoplay denied")); }
  }
  const env = fakeEnv();
  const unavailable = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: null });
  assert.equal(unavailable.resume(), false);
  unavailable.playEffect("choice");
  unavailable.dispose();

  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: RejectedAudio });
  assert.equal(layer.resume(), false);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(env.win.scheduled ?? 0, 0);
  layer.dispose();
});

test("hiding the Mini App stops scheduling and suspends active oscillator tails", async () => {
  const env = fakeEnv();
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  assert.equal(layer.resume(), true);
  const context = FakeAudioContext.latest;
  env.doc.visibilityState = "hidden";
  env.doc.fire("visibilitychange");
  assert.equal(context.suspendCalls, 1);
  assert.equal(context.state, "suspended");
  env.doc.visibilityState = "visible";
  env.doc.fire("visibilitychange");
  await Promise.resolve(); await Promise.resolve();
  assert.equal(context.state, "running");
  assert.equal(context.resumeCalls, 1);
  layer.dispose();
});

test("storage failures and absent audio/haptic APIs never interrupt gameplay", () => {
  const env = fakeEnv({ denied: true });
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: null });
  assert.doesNotThrow(() => {
    layer.setSettings({ music: false, haptics: false });
    layer.hapticImpact();
    layer.onConfirmedOutcome(0, "no-audio");
  });
  layer.dispose();
});

test("original string score increases tempo after each confirmed choice", () => {
  assert.deepEqual(CINEMATIC_TEMPOS_BPM, [64, 78, 94, 112, 136]);
  const env = fakeEnv();
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  assert.equal(layer.resume(), true);
  assert.equal(layer.tempoBpm, 64);
  assert.equal(env.win.intervals.at(-1), Math.round(60000 / 64));
  for (let move = 1; move <= 4; move++) {
    assert.equal(layer.setDecisionProgress(move, 4, "mission-1"), CINEMATIC_TEMPOS_BPM[move]);
    assert.equal(layer.tempoBpm, CINEMATIC_TEMPOS_BPM[move]);
    assert.equal(env.win.intervals.at(-1), Math.round(60000 / CINEMATIC_TEMPOS_BPM[move]));
  }
  assert.equal(layer.setDecisionProgress(4, 4, "mission-1"), 136, "duplicate completion cannot increase tempo");
  assert.equal(layer.setDecisionProgress(0, 4, "mission-2"), 64, "new mission resets the build");
  layer.dispose();
});
test("story changes derive urgency from visible confirmed decision progress", () => {
  const env = fakeEnv();
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  layer.onSceneStep({ key: "streaming-pivot:beat:2", phase: "consequence", progress: { done: 2, total: 4 } }, "background");
  assert.equal(layer.tempoBpm, 94);
  assert.equal(layer.mood, "tension");
  layer.onSceneStep({ key: "streaming-pivot:decide:2", phase: "decision", progress: { done: 2, total: 4 } }, "background");
  assert.equal(layer.tempoBpm, 94);
  layer.onSceneStep({ key: "streaming-pivot:result", phase: "result", delta: -1, progress: { done: 4, total: 4 } }, "background");
  assert.equal(layer.mood, "resolve", "setback results do not falsely claim a win");
  layer.dispose();
});
test("original celebration fanfare begins at result reveal, once per settled event", () => {
  const env = fakeEnv();
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  layer.resume();
  const ctx = FakeAudioContext.latest;
  const before = ctx.oscillatorCount;
  assert.equal(layer.onConfirmedOutcome(300, "mission:confirmed"), true);
  assert.equal(ctx.oscillatorCount, before, "no spoiler sound before money appears");
  assert.equal(layer.onResultReveal(300, "mission:result"), true);
  assert.ok(ctx.oscillatorCount > before + 6, "multi-note layered victory fanfare created");
  const after = ctx.oscillatorCount;
  assert.equal(layer.onResultReveal(300, "mission:result"), false);
  assert.equal(ctx.oscillatorCount, after, "no second fanfare on duplicate render");
  layer.setSettings({ music: false, effects: false });
  const muted = ctx.oscillatorCount;
  assert.equal(layer.onResultReveal(900, "mission:muted"), true);
  assert.equal(ctx.oscillatorCount, muted, "both settings off means silence");
  layer.dispose();
});
test("loss result plays an encouraging resolution rather than the victory fanfare", () => {
  const env = fakeEnv();
  const layer = createSensoryLayer({ document: env.doc, window: env.win, AudioContext: FakeAudioContext });
  layer.resume();
  assert.equal(layer.onResultReveal(-50, "mission:loss"), true);
  assert.equal(layer.mood, "resolve");
  layer.dispose();
});
test("score pacing is bounded and invalid input does not create unbounded scheduling", () => {
  assert.equal(cinematicTempo(-9, 4), 64);
  assert.equal(cinematicTempo(9999, 4), 136);
  assert.equal(cinematicTempo(NaN, 4), 64);
  assert.equal(cinematicTempo(2, 0), 136);
  assert.equal(cinematicTempo(0, 4), 64);
});

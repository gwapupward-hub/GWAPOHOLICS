import test from "node:test";
import assert from "node:assert/strict";
import { createToneAdapter } from "../tone-adapter.mjs";

test("Tone adapter is disabled by default and does not unlock audio", () => {
  let calls = 0;
  const adapter = createToneAdapter({ Tone: { context: { state: "running" }, Synth: class { constructor() { calls++; } } } });
  assert.equal(adapter.play("splash.reveal"), false);
  assert.equal(calls, 0);
});
test("Tone adapter respects muted settings, visibility and locked context", () => {
  let calls = 0;
  const Tone = { context: { state: "suspended" }, Synth: class { constructor() { calls++; } } };
  const adapter = createToneAdapter({ Tone, enabled: true, getSettings: () => ({ effects: false }) });
  assert.equal(adapter.play("business.confirmed"), false);
  Tone.context.state = "running";
  assert.equal(adapter.play("business.confirmed"), false);
  assert.equal(calls, 0);
});
test("enabled adapter schedules a confirmed cue and disposes", () => {
  const notes = [];
  let disposed = 0;
  const Tone = { context: { state: "running" }, now: () => 10, Synth: class {
    toDestination() { return this; }
    triggerAttackRelease(...args) { notes.push(args); }
    dispose() { disposed++; }
  } };
  const adapter = createToneAdapter({ Tone, enabled: true, getSettings: () => ({ effects: true, effectsVolume: 0.5 }) });
  assert.equal(adapter.play("business.confirmed"), true);
  assert.equal(notes.length, 3);
  assert.ok(notes[1][2] > notes[0][2]);
  adapter.dispose();
  assert.equal(disposed, 1);
  assert.equal(adapter.play("business.confirmed"), false);
});

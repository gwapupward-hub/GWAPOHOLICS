import test from "node:test";
import assert from "node:assert/strict";
import { createTypewriter, charsOf, clampSpeed, DEFAULT_TYPE_SPEED } from "../typewriter.mjs";
import { fakeTimers } from "./helpers.mjs";

const typed = (frames) => frames.map((f) => f.chars.slice(0, f.shown).join(""));

test("typing speed defaults to the 25–40ms range and is clamped", () => {
  assert.ok(DEFAULT_TYPE_SPEED >= 25 && DEFAULT_TYPE_SPEED <= 40);
  assert.equal(clampSpeed("abc"), DEFAULT_TYPE_SPEED);
  assert.equal(clampSpeed(1), 10);
  assert.equal(clampSpeed(500), 80);
});

test("reveals text character by character, paragraph by paragraph", () => {
  const timers = fakeTimers();
  const frames = [];
  let done = 0;
  const tw = createTypewriter({ paragraphs: ["Hi.", "Go"], speed: 30, timers, onFrame: (f) => frames.push({ ...f }), onDone: () => { done += 1; } });
  tw.start();
  timers.advance(30);
  assert.deepEqual(typed(frames), ["H"]);
  timers.advance(10_000);
  assert.deepEqual(typed(frames), ["H", "Hi", "Hi.", "G", "Go"]);
  assert.equal(done, 1);
  assert.equal(tw.done, true);
});

test("tap-to-reveal completes every paragraph immediately and only once", () => {
  const timers = fakeTimers();
  const last = {};
  let done = 0;
  const tw = createTypewriter({ paragraphs: ["First line.", "Second line."], timers, onFrame: (f) => { last[f.paragraph] = f.chars.slice(0, f.shown).join(""); }, onDone: () => { done += 1; } });
  tw.start();
  timers.advance(70);
  tw.complete();
  tw.complete();
  timers.advance(10_000);
  assert.deepEqual(last, { 0: "First line.", 1: "Second line." });
  assert.equal(done, 1);
  assert.equal(timers.pending, 0);
});

test("instant mode (reduced motion) shows full text without timers", () => {
  const timers = fakeTimers();
  let done = false;
  const tw = createTypewriter({ paragraphs: ["All at once."], instant: true, timers, onDone: () => { done = true; } });
  tw.start();
  assert.equal(done, true);
  assert.equal(timers.pending, 0);
});

test("dispose stops typing without firing onDone", () => {
  const timers = fakeTimers();
  let done = false;
  const tw = createTypewriter({ paragraphs: ["Leaving early"], timers, onDone: () => { done = true; } });
  tw.start();
  timers.advance(60);
  tw.dispose();
  timers.advance(10_000);
  assert.equal(done, false);
  assert.equal(timers.pending, 0);
});

test("characters are split by code point", () => {
  assert.deepEqual(charsOf("G🚀é"), ["G", "🚀", "é"]);
});

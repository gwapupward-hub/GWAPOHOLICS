import test from "node:test";
import assert from "node:assert/strict";
import { createSceneDirector, SCENE_STEPS, DEFAULT_TIMELINE } from "../story-director.mjs";
import { fakeTimers } from "./helpers.mjs";

function setup() {
  const timers = fakeTimers();
  const steps = [];
  const director = createSceneDirector({ timers, onStep: (s) => steps.push(s) });
  return { timers, steps, director };
}

test("a shot plays background → camera → details → enter → bubble → typing, then waits for narration", () => {
  const { timers, steps, director } = setup();
  director.play();
  timers.advance(DEFAULT_TIMELINE.typing + 1);
  assert.deepEqual(steps, SCENE_STEPS.slice(0, -1));
  timers.advance(60_000);
  assert.equal(director.step, "typing", "choices never appear before narration finishes");
  director.typingDone();
  assert.equal(director.step, "choices");
});

test("the whole pre-typing sequence is short", () => {
  assert.ok(DEFAULT_TIMELINE.typing <= 1200);
});

test("tapping early jumps to typing; skip reveals the decisions immediately", () => {
  const { timers, steps, director } = setup();
  director.play();
  assert.equal(director.hurry(), "typing");
  timers.advance(5000);
  assert.equal(steps.filter((s) => s === "typing").length, 1, "stale step timers were cancelled");
  director.play();
  assert.equal(director.skip(), "choices");
  assert.equal(timers.pending, 0);
});

test("reduced motion goes straight to choices with no timers", () => {
  const { timers, director } = setup();
  director.play({ reducedMotion: true });
  assert.equal(director.step, "choices");
  assert.equal(timers.pending, 0);
});

test("only one decision is accepted, and only after decisions are visible", () => {
  const { timers, steps, director } = setup();
  let commits = 0;
  director.play();
  assert.equal(director.select(() => { commits += 1; }), false, "cannot choose before narration ends");
  director.skip();
  assert.equal(director.select(() => { commits += 1; }), true);
  assert.equal(director.select(() => { commits += 1; }), false, "duplicate tap ignored");
  assert.equal(director.busy, true);
  timers.advance(5000);
  assert.equal(commits, 1);
  assert.deepEqual(steps.slice(-3), ["locked", "feedback", "exit"]);
});

test("disposing (navigating away) cancels pending steps and commits", () => {
  const { timers, director } = setup();
  let commits = 0;
  director.play();
  director.skip();
  director.select(() => { commits += 1; });
  director.dispose();
  timers.advance(10_000);
  assert.equal(commits, 0);
  assert.equal(timers.pending, 0);
  assert.equal(director.step, "idle");
});

test("a new shot invalidates timers from the previous shot", () => {
  const { timers, steps, director } = setup();
  director.play();
  timers.advance(200);
  director.play({ reducedMotion: true });
  timers.advance(10_000);
  assert.equal(director.step, "choices");
  assert.equal(steps.at(-1), "choices");
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SPLASH_TIMING, splashExitDelay, createOpeningSplash } from '../opening-splash.mjs';

test('opening splash has a cinematic minimum floor and a bounded standard handoff', () => {
  assert.ok(SPLASH_TIMING.floorMs >= 1800);
  assert.ok(SPLASH_TIMING.targetMs + SPLASH_TIMING.handoffMs <= 3000);
  assert.equal(splashExitDelay(0), SPLASH_TIMING.targetMs);
  assert.equal(splashExitDelay(1800), SPLASH_TIMING.targetMs - 1800);
  assert.equal(splashExitDelay(4000), 140);
});

test('opening splash tolerates unavailable DOM (non-browser imports)', () => {
  assert.equal(createOpeningSplash(), null);
});

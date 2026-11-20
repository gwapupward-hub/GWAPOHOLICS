import test from 'node:test';
import assert from 'node:assert/strict';
import { SPLASH_TIMING, splashExitDelay, createOpeningSplash } from '../opening-splash.mjs';

test('opening splash has a cinematic minimum floor and a bounded standard handoff', () => {
  assert.deepEqual({
    brandMs: SPLASH_TIMING.brandMs,
    syncMs: SPLASH_TIMING.syncMs,
    enterMs: SPLASH_TIMING.enterMs,
    floorMs: SPLASH_TIMING.floorMs,
    targetMs: SPLASH_TIMING.targetMs,
    handoffMs: SPLASH_TIMING.handoffMs
  }, { brandMs: 920, syncMs: 2340, enterMs: 4280, floorMs: 3800, targetMs: 5100, handoffMs: 520 });
  assert.equal(SPLASH_TIMING.targetMs + SPLASH_TIMING.handoffMs, 5620);
  assert.equal(SPLASH_TIMING.stallMs, 9000);
  assert.equal(splashExitDelay(0), SPLASH_TIMING.targetMs);
  assert.equal(splashExitDelay(3600), SPLASH_TIMING.targetMs - 3600);
  assert.equal(splashExitDelay(8000), 140);
});

test('opening splash tolerates unavailable DOM (non-browser imports)', () => {
  assert.equal(createOpeningSplash(), null);
});

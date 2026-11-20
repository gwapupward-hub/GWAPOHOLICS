import test from 'node:test';
import assert from 'node:assert/strict';
import { SPLASH_TIMING, splashExitDelay, createOpeningSplash } from '../opening-splash.mjs';

test('editorial splash has distinct hero windows, protected session and graceful handoff', () => {
  const t = SPLASH_TIMING;
  assert.deepEqual(
    [t.toplineMs, t.brandMs, t.sparkMs, t.titleMs, t.taglineMs,
      t.deckMs, t.bootMs, t.syncMs, t.enterMs, t.targetMs],
    [320, 1050, 2230, 3000, 4220, 5440, 6020, 6900, 7700, 8300]
  );
  assert.ok(t.brandMs - t.toplineMs >= 600, 'topline receives its own moment');
  assert.ok(t.titleMs - t.sparkMs >= 600, 'brand retains a quiet spotlight');
  assert.ok(t.taglineMs - t.titleMs >= 1100, 'logo title reads alone');
  assert.ok(t.deckMs - t.taglineMs >= 1100, 'tagline reads alone');
  assert.ok(t.bootMs - t.deckMs >= 500, 'closing message settles');
  assert.equal(t.targetMs + t.handoffMs, 8910);
  assert.equal(t.skipMs, 3600);
  assert.equal(t.stallMs, 9000);
  assert.equal(splashExitDelay(0), 8300);
  assert.equal(splashExitDelay(3600), 4700);
  assert.equal(splashExitDelay(8000), 340);
  assert.equal(splashExitDelay(12000), 340);
});

test('opening splash tolerates unavailable DOM (non-browser imports)', () => {
  assert.equal(createOpeningSplash(), null);
});

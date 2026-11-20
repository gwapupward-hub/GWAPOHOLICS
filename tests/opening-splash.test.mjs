import test from 'node:test';
import assert from 'node:assert/strict';
import { SPLASH_TIMING, splashExitDelay, createOpeningSplash } from '../opening-splash.mjs';

test('editorial splash has distinct hero windows, protected session and graceful handoff', () => {
  const t = SPLASH_TIMING;
  assert.deepEqual(
    [t.toplineMs, t.brandMs, t.sparkMs, t.titleMs, t.taglineMs, t.deckMs,
      t.openingExitMs, t.wealthMs, t.wealthWordMs, t.wealthSubMs,
      t.wealthExitMs, t.loadingMs, t.syncMs, t.enterMs, t.targetMs],
    [320, 1050, 2230, 3000, 4220, 5440,
      6280, 7020, 7470, 8730, 10820, 11610, 12500, 14000, 15400]
  );
  assert.ok(t.brandMs - t.toplineMs >= 600, 'topline receives its own moment');
  assert.ok(t.titleMs - t.sparkMs >= 600, 'brand retains a quiet spotlight');
  assert.ok(t.taglineMs - t.titleMs >= 1100, 'logo title reads alone');
  assert.ok(t.wealthMs - t.openingExitMs >= 600, 'chapters have a quiet fade');
  assert.ok(t.wealthSubMs - t.wealthWordMs >= 1200, 'ASCENDANCY reads alone');
  assert.ok(t.loadingMs - t.wealthExitMs >= 700, 'loading scene is isolated');
  assert.equal(t.targetMs + t.handoffMs, 16150);
  assert.equal(t.skipMs, 3600);
  assert.equal(t.stallMs, 9000);
  assert.equal(splashExitDelay(0), 15400);
  assert.equal(splashExitDelay(3600), 11800);
  assert.equal(splashExitDelay(12000), 3400);
  assert.equal(splashExitDelay(22000), 340);
});

test('opening splash tolerates unavailable DOM (non-browser imports)', () => {
  assert.equal(createOpeningSplash(), null);
});

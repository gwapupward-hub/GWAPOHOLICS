import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_SETTINGS_KEY, SESSION_SIGNOUT_KEY, normalizePlayerSettings, loadPlayerSettings, savePlayerSettings,
  isManuallySignedOut, setManualSignout,
  renderPlayerSettings, renderPrivacyPage, renderTermsPage
} from '../player-settings.mjs';

test('settings defaults are privacy-accurate and opt-outs are explicit', () => {
  assert.deepEqual(normalizePlayerSettings(), { notifications: true, hideHeaderBalance: false });
  assert.deepEqual(normalizePlayerSettings({ notifications: false, hideHeaderBalance: true }),
    { notifications: false, hideHeaderBalance: true });
  assert.deepEqual(normalizePlayerSettings({ notifications: 'false', hideHeaderBalance: 'true' }),
    { notifications: true, hideHeaderBalance: false });
});

test('settings persist without storing identity, session tokens or gameplay values', () => {
  const values = new Map();
  const storage = {
    getItem: (name) => values.get(name),
    setItem: (name, value) => values.set(name, value)
  };
  const preferences = savePlayerSettings({ notifications: false, hideHeaderBalance: true }, storage);
  assert.deepEqual(loadPlayerSettings(storage), preferences);
  assert.deepEqual([...values.keys()], [PLAYER_SETTINGS_KEY]);
  assert.ok(!values.get(PLAYER_SETTINGS_KEY).includes('initData'));
  assert.ok(!values.get(PLAYER_SETTINGS_KEY).includes('balance'));
});

test('settings survive broken storage and malformed JSON without blocking gameplay', () => {
  const broken = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.deepEqual(loadPlayerSettings(broken), normalizePlayerSettings());
  assert.deepEqual(savePlayerSettings({ notifications: false }, broken),
    { notifications: false, hideHeaderBalance: false });
  assert.deepEqual(loadPlayerSettings({ getItem() { return '[bad'; } }), normalizePlayerSettings());
});

test('game settings exposes separate controls and plain notification limitations', () => {
  const page = renderPlayerSettings({
    sound: { music: false, effects: false, haptics: false, musicVolume: 0.1, effectsVolume: 0.75 },
    prefs: { notifications: false, hideHeaderBalance: true },
    telegram: true
  });
  for (const field of ['music', 'musicVolume', 'effects', 'effectsVolume', 'haptics', 'notifications']) {
    assert.match(page, new RegExp('name="' + field + '"'));
  }
  assert.match(page, /In-game notifications/);
  assert.match(page, /Not controlled by this switch/);
  assert.match(page, /data-action="settings-logout-confirm"/);
  assert.match(page, /data-view="privacy"/);
  assert.match(page, /data-view="terms"/);
  assert.match(page, /data-settings-output="effectsVolume">75%/);
  assert.match(page, /name="music"[^>]*aria-label="Background music"[^>]*>/);
});

test('demo mode does not present an actionable logout or account deletion', () => {
  const page = renderPlayerSettings({ telegram: false });
  assert.doesNotMatch(page, /data-action="settings-logout"/);
  assert.match(page, /Browser demo has no account session/);
});

test('privacy settings and terms are explicitly Preview disclosures', () => {
  const privacy = renderPrivacyPage({ hideHeaderBalance: true });
  const terms = renderTermsPage();
  assert.match(privacy, /name="hideHeaderBalance"[^>]*checked/);
  assert.match(privacy, /session cookie/);
  assert.match(privacy, /does not delete saved gameplay/);
  assert.match(privacy, /not a final legal privacy policy/);
  assert.match(terms, /not a finalized or legally reviewed Terms of Service/);
  assert.match(terms, /cannot be withdrawn, sold, exchanged, or redeemed/);
});

test('explicit signout prevents automatic session re-entry until sign-in succeeds', () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k)
  };
  assert.equal(isManuallySignedOut(storage), false);
  setManualSignout(true, storage);
  assert.equal(values.get(SESSION_SIGNOUT_KEY), '1');
  assert.equal(isManuallySignedOut(storage), true);
  setManualSignout(false, storage);
  assert.equal(isManuallySignedOut(storage), false);
});

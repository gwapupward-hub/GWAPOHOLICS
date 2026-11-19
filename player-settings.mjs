/**
 * GWAPOHOLICS player settings are device-local presentation preferences.
 * Never store Telegram initData, session cookies, or virtual G balances here.
 */
export const PLAYER_SETTINGS_KEY = 'gwapoholics.player-settings.v1';
export const SESSION_SIGNOUT_KEY = 'gwapoholics.manual-signout.v1';
const DEFAULTS = Object.freeze({ notifications: true, hideHeaderBalance: false });

export function normalizePlayerSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    notifications: source.notifications !== false,
    hideHeaderBalance: source.hideHeaderBalance === true
  };
}

export function loadPlayerSettings(storage) {
  try {
    const local = storage ?? globalThis.localStorage;
    const raw = local?.getItem?.(PLAYER_SETTINGS_KEY);
    return normalizePlayerSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizePlayerSettings();
  }
}

export function savePlayerSettings(value, storage) {
  const normalized = normalizePlayerSettings(value);
  try { (storage ?? globalThis.localStorage)?.setItem?.(PLAYER_SETTINGS_KEY, JSON.stringify(normalized)); } catch { /* optional storage */ }
  return normalized;
}

export function isManuallySignedOut(storage) {
  try { return (storage ?? globalThis.localStorage)?.getItem?.(SESSION_SIGNOUT_KEY) === '1'; }
  catch { return false; }
}
export function setManualSignout(enabled, storage) {
  try {
    const local = storage ?? globalThis.localStorage;
    if (enabled) local?.setItem?.(SESSION_SIGNOUT_KEY, '1');
    else local?.removeItem?.(SESSION_SIGNOUT_KEY);
  } catch { /* browsers may deny preference storage */ }
}

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
);
const checked = (yes) => yes ? ' checked' : '';
const section = (title, intro, body) =>
  '<section class="settings-group"><div class="settings-group-heading"><h2>' + title + '</h2><p>' + intro +
  '</p></div><div class="settings-group-body">' + body + '</div></section>';

function toggle(name, title, description, enabled, category) {
  return '<label class="settings-row settings-toggle">' +
    '<span class="settings-row-copy"><strong>' + title + '</strong><small>' + description + '</small></span>' +
    '<input type="checkbox" name="' + name + '" data-settings-category="' + category +
    '" aria-label="' + title + '"' + checked(enabled) + '></label>';
}
function range(name, title, volume) {
  const percent = Math.round((Number(volume) || 0) * 100);
  const maximum = name === 'musicVolume' ? '0.5' : '1';
  return '<label class="settings-range"><span class="settings-range-head"><strong>' + title +
    '</strong><output data-settings-output="' + name + '">' + percent + '%</output></span>' +
    '<input type="range" name="' + name + '" data-settings-category="sound" min="0" max="' + maximum +
    '" step="0.01" value="' + esc(volume) + '" aria-label="' + title + '"></label>';
}
function nav(label, explanation, target) {
  return '<button class="settings-link" type="button" data-action="nav" data-view="' + target + '">' +
    '<span><strong>' + label + '</strong><small>' + explanation + '</small></span><span aria-hidden="true">›</span></button>';
}

export function renderPlayerSettings({ sound = {}, prefs = DEFAULTS, telegram = false } = {}) {
  const p = normalizePlayerSettings(prefs);
  const audio = section('Sound & feedback', 'Shape your cinematic experience.',
    toggle('music', 'Background music', 'Original synthesized game soundtrack', sound.music !== false, 'sound') +
    range('musicVolume', 'Music volume', sound.musicVolume ?? 0.18) +
    toggle('effects', 'Sound effects', 'Choices, consequences and achievements', sound.effects !== false, 'sound') +
    range('effectsVolume', 'Effects volume', sound.effectsVolume ?? 0.32) +
    toggle('haptics', 'Haptic feedback', 'Telegram vibrations on supported devices', sound.haptics !== false, 'sound'));
  const play = section('Gameplay & notifications', 'Personalize what happens on this device.',
    toggle('notifications', 'In-game notifications', 'Optional game notices; critical errors still appear', p.notifications, 'player') +
    '<div class="settings-static"><strong>Telegram bot messages</strong><small>Not controlled by this switch. Manage bot notifications in Telegram; game push alerts are not configured.</small></div>');
  const account = section('Account & privacy', 'Your gameplay remains attached to your Telegram identity.',
    nav('Privacy settings', 'Header balance visibility and how data is handled', 'privacy') +
    (telegram ?
      '<button class="settings-link settings-signout" type="button" data-action="settings-logout"><span><strong>Sign out of game session</strong><small>Clears this Mini App session, not your Telegram account or G progress</small></span><span aria-hidden="true">›</span></button>' :
      '<div class="settings-static"><strong>Sign out</strong><small>Available only in an authenticated Telegram session. Browser demo has no account session.</small></div>'));
  const legal = section('Legal & help', 'Preview disclosures; formal documents require approval.',
    nav('Terms & conditions', 'Read the Preview terms overview', 'terms') +
    nav('Privacy & data information', 'Read the Preview privacy overview', 'privacy'));
  const dialog = telegram ? '<dialog id="game-logout-dialog" class="settings-confirm" aria-labelledby="game-logout-title">' +
    '<h2 id="game-logout-title">Sign out of this game session?</h2>' +
    '<p>Your progress remains on the server. Opening GWAPOHOLICS with Telegram can sign you back into the same account.</p>' +
    '<div class="settings-confirm-actions"><button type="button" data-action="settings-logout-cancel">Cancel</button>' +
    '<button type="button" class="settings-danger" data-action="settings-logout-confirm">Sign out</button></div></dialog>' : '';
  return '<div class="player-settings-page page-enter"><div class="settings-eyebrow">YOUR GAME · YOUR RULES</div>' +
    '<header class="settings-head"><h1>SETTINGS<span>.</span></h1><p>Make the game feel right for you.</p></header>' +
    audio + play + account + legal + '<p class="settings-foot">These preferences do not change the virtual G economy, your score, or your saved progress.</p>' +
    dialog + '</div>';
}

export function renderPrivacyPage({ hideHeaderBalance = false } = {}) {
  return '<div class="player-settings-page page-enter"><button type="button" class="settings-back" data-action="nav" data-view="settings">‹ Back to settings</button>' +
    '<header class="settings-head"><h1>PRIVACY<span>.</span></h1><p>Control what appears on your screen.</p></header>' +
    section('On-screen privacy', 'This is a display-only option; it is not account anonymity.',
      toggle('hideHeaderBalance', 'Hide header balance', 'Conceals the game capital shown in the standard top bar only', hideHeaderBalance, 'player')) +
    section('How the Preview works', 'Information for testers, not a final legal privacy policy.',
      '<div class="settings-copy"><p>The Telegram Mini App uses signed Telegram launch data to authenticate a player and a short-lived, secure HttpOnly session cookie for authorized requests. Your G balance, decisions, and game receipts are stored by the game server to preserve progress.</p>' +
      '<p>Sound and display preferences are saved locally; supported Telegram clients may also store sensory preferences using Telegram DeviceStorage. Turning off optional notifications does not stop security or gameplay error messages.</p>' +
      '<p>Signing out clears the game session cookie but does not delete saved gameplay, disconnect Telegram, revoke existing Telegram permissions, or erase personal data from the server.</p></div>') +
    section('Your data', 'Account deletion and export tools are not part of this Preview.',
      '<div class="settings-static"><strong>Data requests</strong><small>A verified support and deletion process must be established before public release. No deletion action is exposed in this Preview.</small></div>') +
    '<p class="settings-foot">Preview disclosure only — a complete privacy policy requires owner and legal review before launch.</p></div>';
}

export function renderTermsPage() {
  return '<div class="player-settings-page page-enter"><button type="button" class="settings-back" data-action="nav" data-view="settings">‹ Back to settings</button>' +
    '<header class="settings-head"><h1>TERMS<span>.</span></h1><p>Preview terms and gameplay overview.</p></header>' +
    section('About GWAPOHOLICS', 'A testing-stage educational simulation, not a financial product.',
      '<div class="settings-copy"><p>GWAPOHOLICS presents fictional business scenarios and simulated outcomes. Virtual G coins are educational game units; they are not money, cryptocurrency, or an investment, and cannot be withdrawn, sold, exchanged, or redeemed.</p>' +
      '<p>Gameplay decisions and narrative outcomes do not constitute financial, investment, or legal advice. Features may change during testing.</p>' +
      '<p>Players should not attempt to manipulate game services, compromise another player’s account, or abuse the test infrastructure.</p>' +
      '<p>This is a Preview information page, not a finalized or legally reviewed Terms of Service agreement. No acceptance or consent is recorded by viewing it.</p></div>') +
    '<p class="settings-foot">Formal terms, jurisdiction, support contact, and release-specific policies must be finalized before public launch.</p></div>';
}

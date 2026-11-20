/**
 * GWAPOHOLICS opening splash. Presentation only: never mints coins, authenticates
 * users, or treats a visual progress value as proof of a valid session.
 * The caller owns Telegram ready()/expand() and the authoritative auth request.
 */

// The letters are fixed GWAP-owned strings, not user-supplied markup. The tiny
// stagger is declarative CSS, never a per-frame JavaScript animation.
function springLetters(word, accentAfter = Infinity) {
  return Array.from(word, (letter, index) =>
    `<span class="splash-letter${index >= accentAfter ? ' is-green' : ''}" aria-hidden="true" style="--letter-delay:${index * 48}ms">${letter}</span>`
  ).join('');
}

export const SPLASH_TIMING = Object.freeze({
  // Three acts: GWAP origin → ASCENDANCY → isolated secure loading.
  // The 9s auth stall guard remains independent of the cinematic runtime.
  toplineMs: 320,
  brandMs: 1050,
  sparkMs: 2230,
  titleMs: 3000,
  taglineMs: 4220,
  deckMs: 5440,
  openingExitMs: 6280,
  wealthMs: 7020,
  wealthWordMs: 7470,
  wealthSubMs: 8730,
  wealthExitMs: 10820,
  loadingMs: 11610,
  syncMs: 12500,
  enterMs: 14000,
  floorMs: 6100,
  targetMs: 15400,
  handoffMs: 750,
  skipMs: 3600,
  stallMs: 9000
});

export function splashExitDelay(elapsedMs, timing = SPLASH_TIMING) {
  // A late successful login still gets a readable completion beat, not a flash.
  return Math.max(340, Math.max(timing.floorMs, timing.targetMs) - Math.max(0, elapsedMs));
}

export function createOpeningSplash({
  host,
  app,
  window: win = globalThis.window,
  onRetry = () => {},
  onBrandImpact = () => {},
  motionEnabled = true,
  timing: overrides = {}
} = {}) {
  if (!host || !app || !win) return null;
  const timing = { ...SPLASH_TIMING, ...overrides };
  const doc = host.ownerDocument;
  const timers = new Set();
  const clock = () => win.performance?.now?.() ?? Date.now();
  const priorAria = app.getAttribute('aria-hidden');
  const priorInert = app.inert;
  let begunAt = clock();
  let attempt = 0;
  let resolved = false;
  let closed = false;
  let stallTimer = null;
  let exitTimer = null;
  let statusTimer = null;
  let skipTimer = null;
  let exiting = false;

  host.innerHTML = `<section class="splash-stage" aria-label="GWAPOHOLICS starting">
    <div class="splash-ambience" aria-hidden="true"></div>
    <div class="splash-grid" aria-hidden="true"></div>
    <div class="splash-motes" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
    <div class="splash-center splash-scene-opening" aria-label="Your GWAPOHOLICS origin">
      <span class="splash-topline">✦ GRIND WITH A PURPOSE ✦</span>
      <div class="splash-emblem" aria-hidden="true">
        <div class="splash-badge"><img src="./brand.svg" alt="" width="96" height="96" decoding="async"></div>
        <span class="splash-spark splash-spark-orange">✦</span>
        <span class="splash-spark splash-spark-purple">✦</span>
      </div>
      <h1 class="splash-title" aria-label="GWAPOHOLICS">${springLetters('GWAPOHOLICS', 4)}</h1>
      <p class="splash-tagline" aria-label="Build your empire">
        <span class="splash-word" aria-hidden="true" style="--word-delay:0ms">BUILD</span>
        <span class="splash-word" aria-hidden="true" style="--word-delay:110ms">YOUR</span>
        <strong class="splash-word" aria-hidden="true" style="--word-delay:220ms">EMPIRE!</strong>
      </p>
      <span class="splash-deck">EVERY EMPIRE STARTS WITH A MOVE.</span>
    </div>
    <section class="splash-wealth splash-scene-wealth" aria-label="Ascendancy. From concrete to crown.">
      <div class="splash-wealth-orbit splash-orbit-one" aria-hidden="true"></div>
      <div class="splash-wealth-orbit splash-orbit-two" aria-hidden="true"></div>
      <span class="splash-wealth-kicker">THE ART OF THE RISE</span>
      <h2 class="splash-wealth-word" aria-label="ASCENDANCY">${springLetters('ASCENDANCY')}</h2>
      <div class="splash-wealth-rule" aria-hidden="true"><span>✦</span></div>
      <p class="splash-wealth-sub">FROM <strong>CONCRETE</strong> TO <em>CROWN.</em></p>
      <p class="splash-wealth-note">OPPORTUNITY DOESN'T WAIT. NEITHER DOES AMBITION.</p>
      <span class="splash-wealth-filigree" aria-hidden="true">G · W · A · P</span>
    </section>
    <section class="splash-boot splash-scene-loading" aria-label="Securing your empire access">
      <span class="splash-loader-kicker">GWAPOHOLICS / PRIVATE ENTRY</span>
      <div class="splash-loader-mark" aria-hidden="true">
        <span class="splash-loader-ring"></span>
        <span class="splash-loader-ring splash-loader-ring-inner"></span>
        <img src="./brand.svg" width="56" height="56" alt="" decoding="async">
      </div>
      <h2 class="splash-loader-title">YOUR NEXT <em>MOVE.</em></h2>
      <p class="splash-loader-caption">A WORLD OF OPPORTUNITY IS OPENING.</p>
      <div class="splash-loading-progress">
        <div class="splash-boot-head"><span>SECURE ENTRY <b>◉</b></span><span>SEASON 01 / ARRIVING</span></div>
        <div class="splash-meter" role="progressbar" aria-label="Opening sequence" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8"><span class="splash-meter-fill"></span></div>
        <p class="splash-status" role="status" aria-live="polite" aria-atomic="true">PREPARING SECURE ENTRY...</p>
        <button class="splash-retry" type="button" hidden>RETRY SECURE CONNECTION ↗</button>
        <p class="splash-footnote">EDUCATIONAL SIMULATION · VIRTUAL G ONLY</p>
      </div>
    </section>
    <button class="splash-skip" type="button" aria-label="Skip the opening animation and enter the game" hidden>SKIP INTRO <span aria-hidden="true">↗</span></button>
  </section>`;

  const stage = host.querySelector('.splash-stage');
  // Drive CSS and session-status cues from one storyboard to prevent drift.
  for (const [name, ms] of [
    ['topline', timing.toplineMs],
    ['brand', timing.brandMs],
    ['spark', timing.sparkMs],
    ['title', timing.titleMs],
    ['tagline', timing.taglineMs],
    ['deck', timing.deckMs],
    ['opening-out', timing.openingExitMs],
    ['wealth', timing.wealthMs],
    ['wealth-word', timing.wealthWordMs],
    ['wealth-sub', timing.wealthSubMs],
    ['wealth-out', timing.wealthExitMs],
    ['loading', timing.loadingMs]
  ]) stage.style.setProperty(`--splash-${name}-delay`, `${ms}ms`);

  const skip = host.querySelector('.splash-skip');
  const bar = host.querySelector('.splash-meter');
  const fill = host.querySelector('.splash-meter-fill');
  const status = host.querySelector('.splash-status');
  const retry = host.querySelector('.splash-retry');

  function queue(fn, delay) {
    const id = win.setTimeout(() => { timers.delete(id); if (!closed) fn(); }, Math.max(0, delay));
    timers.add(id);
    return id;
  }
  function cancel(id) {
    if (id === null) return;
    win.clearTimeout(id);
    timers.delete(id);
  }
  function progress(fraction) {
    const value = Math.min(1, Math.max(0, Number(fraction) || 0));
    fill.style.setProperty('--splash-progress', String(value));
    bar.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  }
  function cue(label, value, immediate = false) {
    if (value !== undefined) progress(value);
    cancel(statusTimer);
    statusTimer = null;
    if (!motionEnabled || immediate || status.textContent === label) {
      status.classList.remove('splash-status-changing');
      status.textContent = label;
      return;
    }
    status.classList.add('splash-status-changing');
    statusTimer = queue(() => {
      statusTimer = null;
      status.textContent = label;
      status.classList.remove('splash-status-changing');
    }, 280);
  }
  function revealSkip() {
    if (closed || exiting || !resolved || !motionEnabled) return;
    const remaining = Math.max(0, timing.skipMs - (clock() - begunAt));
    cancel(skipTimer);
    skipTimer = queue(() => {
      if (!closed && resolved && !exiting) skip.hidden = false;
    }, remaining);
  }
  function beginHandoff() {
    if (closed || exiting || !resolved) return;
    exiting = true;
    cancel(exitTimer);
    cancel(skipTimer);
    skip.hidden = true;
    host.classList.add('splash-exit');
    queue(finish, motionEnabled ? timing.handoffMs : 0);
  }
  function skipIntro() {
    // Visual shortcut only: never reveal the game before authoritative auth.
    if (closed || !resolved) return;
    beginHandoff();
  }
  function hideRetry() {
    host.classList.remove('splash-stalled');
    retry.hidden = true;
    retry.disabled = false;
  }
  function failure(stalled = false) {
    if (closed || resolved) return;
    host.classList.remove('splash-reconnecting');
    host.classList.add('splash-stalled');
    retry.hidden = false;
    retry.disabled = false;
    skip.hidden = true;
    cue(stalled ? 'STILL CONNECTING TO YOUR EMPIRE...' : 'SECURE SIGN-IN UNAVAILABLE.', undefined, true);
    retry.focus({ preventScroll: true });
  }
  function finish() {
    if (closed) return;
    closed = true;
    for (const id of timers) win.clearTimeout(id);
    timers.clear();
    retry.removeEventListener('click', tryAgain);
    skip.removeEventListener('click', skipIntro);
    host.replaceChildren();
    host.classList.remove('splash-active', 'splash-exit', 'splash-stalled', 'splash-reconnecting', 'story-static');
    doc.documentElement.classList.remove('splash-open');
    app.inert = priorInert;
    if (priorAria === null) app.removeAttribute('aria-hidden');
    else app.setAttribute('aria-hidden', priorAria);
  }
  function complete() {
    if (closed || resolved) return;
    resolved = true;
    cancel(stallTimer);
    hideRetry();
    const elapsed = clock() - begunAt;
    // Quick auth stays in the storyboard; slow auth resolves truthfully and
    // gets a calm confirmation before handoff, without replaying intro beats.
    if (!motionEnabled) {
      // No animation to watch: respect reduced-motion users' time.
      cue('READY TO BUILD · ENTERING EMPIRE...', 1, true);
      exitTimer = queue(beginHandoff, 680);
      return;
    }
    if (elapsed >= timing.enterMs) cue('READY TO BUILD · ENTERING EMPIRE...', 1);
    revealSkip();
    exitTimer = queue(beginHandoff, splashExitDelay(elapsed, timing));
  }
  function track(work) {
    if (closed) return Promise.resolve(false);
    const token = ++attempt;
    resolved = false;
    cancel(stallTimer);
    cancel(exitTimer);
    cancel(skipTimer);
    skip.hidden = true;
    hideRetry();
    if (token > 1) {
      host.classList.add('splash-reconnecting');
      cue('RECONNECTING TO EMPIRE...', 0.45);
    }
    stallTimer = queue(() => {
      if (token === attempt && !resolved) failure(true);
    }, timing.stallMs);
    return Promise.resolve(work).then(
      (ok) => {
        if (token !== attempt || closed) return false;
        if (ok === false) { cancel(stallTimer); failure(); return false; }
        complete();
        return true;
      },
      () => {
        if (token !== attempt || closed) return false;
        cancel(stallTimer);
        failure();
        return false;
      }
    );
  }
  function tryAgain() {
    if (closed) return;
    retry.disabled = true;
    hideRetry();
    host.classList.add('splash-reconnecting');
    cue('RECONNECTING TO EMPIRE...', 0.45, true);
    try { onRetry(); }
    catch { failure(); }
  }

  app.inert = true;
  app.setAttribute('aria-hidden', 'true');
  doc.documentElement.classList.add('splash-open');
  host.classList.add('splash-active');
  if (!motionEnabled) host.classList.add('story-static');
  progress(0.08);
  retry.addEventListener('click', tryAgain);
  skip.addEventListener('click', skipIntro);
  queue(() => {
    if (doc.visibilityState !== 'hidden') {
      try { onBrandImpact(); } catch { /* no Telegram haptics in ordinary browsers */ }
    }
  }, timing.brandMs + 450);
  queue(() => {
    if (!host.classList.contains('splash-stalled')) {
      cue(resolved ? 'PLAYER VERIFIED · OPENING YOUR WORLD...' : 'SECURING PLAYER SESSION...', 0.62);
    }
  }, timing.syncMs);
  queue(() => {
    if (!host.classList.contains('splash-stalled')) {
      cue(resolved ? 'READY TO BUILD · ENTERING EMPIRE...' : 'VERIFYING EMPIRE SESSION...', resolved ? 1 : 0.84);
    }
  }, timing.enterMs);

  return { track, complete, fail: () => failure(), dispose: finish, get active() { return !closed; } };
}

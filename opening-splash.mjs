/**
 * GWAPOHOLICS opening splash. Presentation only: never mints coins, authenticates
 * users, or treats a visual progress value as proof of a valid session.
 * The caller owns Telegram ready()/expand() and the authoritative auth request.
 */
export const SPLASH_TIMING = Object.freeze({
  brandMs: 460,
  syncMs: 1170,
  enterMs: 2140,
  floorMs: 1900,
  targetMs: 2550,
  handoffMs: 260,
  stallMs: 9000
});

export function splashExitDelay(elapsedMs, timing = SPLASH_TIMING) {
  // Even a slow successful request gets one readable completion beat.
  return Math.max(140, Math.max(timing.floorMs, timing.targetMs) - Math.max(0, elapsedMs));
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

  host.innerHTML = `<section class="splash-stage" aria-label="GWAPOHOLICS starting">
    <div class="splash-ambience" aria-hidden="true"></div>
    <div class="splash-grid" aria-hidden="true"></div>
    <div class="splash-motes" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
    <div class="splash-center">
      <span class="splash-topline">✦ GRIND WITH A PURPOSE ✦</span>
      <div class="splash-emblem" aria-hidden="true">
        <div class="splash-badge"><img src="./brand.svg" alt="" width="96" height="96" decoding="async"></div>
        <span class="splash-spark splash-spark-orange">✦</span>
        <span class="splash-spark splash-spark-purple">✦</span>
      </div>
      <h1 class="splash-title">GWAP<em>OHOLICS</em></h1>
      <p class="splash-tagline">BUILD YOUR <strong>EMPIRE!</strong></p>
      <span class="splash-deck">EVERY EMPIRE STARTS WITH A MOVE.</span>
    </div>
    <div class="splash-boot">
      <div class="splash-boot-head"><span>EMPIRE OS <b>◉</b></span><span>SEASON 01 / ONLINE</span></div>
      <div class="splash-meter" role="progressbar" aria-label="Opening sequence" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8"><span class="splash-meter-fill"></span></div>
      <p class="splash-status" role="status" aria-live="polite" aria-atomic="true">INITIALIZING EMPIRE...</p>
      <button class="splash-retry" type="button" hidden>RETRY SECURE CONNECTION ↗</button>
      <p class="splash-footnote">EDUCATIONAL SIMULATION · VIRTUAL G ONLY</p>
    </div>
  </section>`;

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
  function cue(label, value) {
    status.textContent = label;
    if (value !== undefined) progress(value);
  }
  function hideRetry() {
    host.classList.remove('splash-stalled');
    retry.hidden = true;
    retry.disabled = false;
  }
  function failure(stalled = false) {
    if (closed || resolved) return;
    host.classList.add('splash-stalled');
    retry.hidden = false;
    retry.disabled = false;
    cue(stalled ? 'STILL CONNECTING TO YOUR EMPIRE...' : 'SECURE SIGN-IN UNAVAILABLE.');
    retry.focus({ preventScroll: true });
  }
  function finish() {
    if (closed) return;
    closed = true;
    for (const id of timers) win.clearTimeout(id);
    timers.clear();
    retry.removeEventListener('click', tryAgain);
    host.replaceChildren();
    host.classList.remove('splash-active', 'splash-exit', 'splash-stalled', 'story-static');
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
    queue(() => cue('ENTERING STAGE...', 1), Math.max(0, timing.enterMs - elapsed));
    queue(() => {
      host.classList.add('splash-exit');
      queue(finish, motionEnabled ? timing.handoffMs : 0);
    }, splashExitDelay(elapsed, timing));
  }
  function track(work) {
    if (closed) return Promise.resolve(false);
    const token = ++attempt;
    resolved = false;
    cancel(stallTimer);
    hideRetry();
    if (token > 1) cue('RECONNECTING TO EMPIRE...', 0.55);
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
    cue('RECONNECTING TO EMPIRE...', 0.45);
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
  queue(() => {
    if (doc.visibilityState !== 'hidden') {
      try { onBrandImpact(); } catch { /* no Telegram haptics in ordinary browsers */ }
    }
  }, timing.brandMs + 110);
  queue(() => { if (!resolved && !host.classList.contains('splash-stalled')) cue('SYNCING PLAYER & RUN...', 0.62); }, timing.syncMs);
  queue(() => { if (!resolved && !host.classList.contains('splash-stalled')) cue('VERIFYING EMPIRE SESSION...', 0.84); }, timing.enterMs);

  return { track, complete, fail: () => failure(), dispose: finish, get active() { return !closed; } };
}

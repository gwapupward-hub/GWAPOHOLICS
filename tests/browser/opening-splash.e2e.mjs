import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../../game-core.mjs';
import { publicGameView } from '../../server/game-service.mjs';
import { ENGINES, launch } from './engines.mjs';

const BASE = 'http://127.0.0.1:4173/';
const NOW = 1800000000000;

function mockTelegram() {
  window.__bootImpacts = [];
  window.Telegram = { WebApp: {
    initData: 'mock-signed-payload-verified-only-by-test-server',
    initDataUnsafe: { user: { first_name: 'Ada' } },
    ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, onEvent() {},
    BackButton: { onClick() {}, show() {}, hide() {} },
    HapticFeedback: { impactOccurred(kind) { window.__bootImpacts.push(kind); }, notificationOccurred() {} }
  } };
}

async function open(engine, { reducedMotion = 'no-preference', failFirst = false, width = 390 } = {}) {
  const browser = await launch(engine);
  const context = await browser.newContext({
    viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 2, reducedMotion
  });
  await context.addInitScript(mockTelegram);
  let sessionRequests = 0;
  await context.route('https://telegram.org/js/**', route => route.fulfill({
    status: 200, contentType: 'application/javascript', body: '/* Telegram mocked */'
  }));
  await context.route('**/api/session', route => {
    sessionRequests++;
    return route.fulfill({ status: failFirst && sessionRequests === 1 ? 503 : 200,
      contentType: 'application/json', body: '{"authenticated":true}' });
  });
  await context.route('**/api/game', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ state: publicGameView(createGame(NOW, 777), NOW) })
  }));
  await context.route('**/api/v2/founder', route => route.fulfill({
    status: 404, contentType: 'application/json', body: '{"error":"not_found"}'
  }));
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { browser, page, pageErrors, requests: () => sessionRequests };
}

for (const engine of ENGINES) {
  test(`[${engine.name}] splash gates game until verified login, then hands off cleanly`, async () => {
    const { browser, page, pageErrors, requests } = await open(engine);
    try {
      await page.locator('#opening-splash.splash-active').waitFor();
      assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
      assert.equal(await page.locator('.splash-badge img').getAttribute('src'), './brand.svg');
      assert.match(await page.locator('.splash-title').textContent(), /GWAPOHOLICS/);
      // A deliberate storyboard: badge gets the first spotlight, then title,
      // then tagline. Avoid overlapping all the initial pop-in animations.
      await page.waitForTimeout(2100);
      const early = await page.evaluate(() => ({
        badge: Number(getComputedStyle(document.querySelector('.splash-badge')).opacity),
        title: Number(getComputedStyle(document.querySelector('.splash-title')).opacity),
        tagline: Number(getComputedStyle(document.querySelector('.splash-tagline')).opacity)
      }));
      assert.ok(early.badge > 0.9, JSON.stringify(early));
      assert.ok(early.title < 0.05, JSON.stringify(early));
      assert.ok(early.tagline < 0.05, JSON.stringify(early));
      await page.waitForTimeout(1850);
      const named = await page.evaluate(() => ({
        title: Number(getComputedStyle(document.querySelector('.splash-title')).opacity),
        tagline: Number(getComputedStyle(document.querySelector('.splash-tagline')).opacity)
      }));
      assert.ok(named.title > 0.85, JSON.stringify(named));
      assert.ok(named.tagline < 0.05, JSON.stringify(named));
      assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
      await page.locator('.splash-skip').waitFor({ state: 'visible', timeout: 4000 });
      await page.locator('.splash-status').getByText(/READY TO BUILD/).waitFor({ timeout: 9000 });
      assert.equal(await page.locator('.splash-meter').getAttribute('aria-valuenow'), '100');
      await page.locator('#opening-splash.splash-active').waitFor({ state: 'hidden', timeout: 12000 });
      assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
      assert.equal(await page.locator('#app').getAttribute('aria-hidden'), null);
      assert.ok(await page.locator('.arcade-home').count() === 1);
      assert.equal(requests(), 1);
      assert.deepEqual(pageErrors, []);
    } finally { await browser.close(); }
  });

  test(`[${engine.name}] splash supports 320px, reduced motion and retry without bypassing auth`, async () => {
    const { browser, page, pageErrors, requests } = await open(engine, {
      reducedMotion: 'reduce', failFirst: true, width: 320
    });
    try {
      await page.locator('#opening-splash.splash-active').waitFor();
      await page.locator('.splash-retry').waitFor({ state: 'visible', timeout: 4000 });
      assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
      assert.equal(await page.locator('.splash-skip').isVisible(), false);
      const animation = await page.locator('.splash-motes i').first().evaluate(el => getComputedStyle(el).animationName);
      assert.equal(animation, 'none');
      const viewport = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('body *')].filter(el => {
          const box = el.getBoundingClientRect();
          return box.right > window.innerWidth + 1 || box.left < -1;
        }).slice(0, 8).map(el => ({ tag: el.tagName, cls: el.className?.baseVal ?? el.className,
          width: Math.round(el.getBoundingClientRect().width) }))
      }));
      assert.ok(viewport.scrollWidth <= viewport.width + 1, JSON.stringify(viewport));
      await page.locator('.splash-retry').tap();
      // Reduced-motion players get a prompt static reveal without an 8s hold.
      await page.locator('#opening-splash.splash-active').waitFor({ state: 'hidden', timeout: 5500 });
      assert.equal(await page.locator('.splash-skip').count(), 0);
      assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
      assert.ok(await page.locator('.arcade-home').count() === 1);
      assert.equal(requests(), 2);
      assert.deepEqual(pageErrors, []);
    } finally { await browser.close(); }
  });

  test(`[${engine.name}] authenticated players may skip the intro without bypassing session checks`, async () => {
    const { browser, page, pageErrors, requests } = await open(engine, { failFirst: true });
    try {
      await page.locator('.splash-retry').waitFor({ state: 'visible', timeout: 4000 });
      assert.equal(await page.locator('.splash-skip').isVisible(), false);
      assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
      await page.locator('.splash-retry').tap();
      await page.locator('.splash-skip').waitFor({ state: 'visible', timeout: 6500 });
      assert.equal(await page.locator('#app').evaluate(el => el.inert), true);
      await page.locator('.splash-skip').tap();
      await page.locator('#opening-splash.splash-active').waitFor({ state: 'hidden', timeout: 3500 });
      assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
      assert.equal(await page.locator('#app').getAttribute('aria-hidden'), null);
      assert.ok(await page.locator('.arcade-home').count() === 1);
      assert.equal(requests(), 2);
      assert.deepEqual(pageErrors, []);
    } finally { await browser.close(); }
  });
}

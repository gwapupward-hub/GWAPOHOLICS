import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173/?preview=1';

test('preview landing page opens local demo and persists settings', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 873 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce'
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /PLAY THE DEMO/i }).waitFor();
    assert.match(await page.locator('.preview-page').innerText(), /LOCAL-ONLY PLAY/);
    await page.getByRole('button', { name: /OPEN SETTINGS/i }).click();
    assert.match(await page.locator('.settings-page').innerText(), /Terms & conditions/i);

    const sound = page.locator('[data-action="toggle-setting"][data-setting="sound"]');
    const before = await sound.getAttribute('aria-pressed');
    await sound.click();
    assert.notEqual(await sound.getAttribute('aria-pressed'), before);
    assert.equal(await page.evaluate(() => localStorage.getItem('gwap.telegram.sfx.v1')), 'off');
    const music = page.locator('[data-action="toggle-setting"][data-setting="music"]');
    await music.click();
    assert.equal(await page.evaluate(() => localStorage.getItem('gwap.telegram.music.v1')), 'off');
    await music.click();
    assert.equal(await page.evaluate(() => localStorage.getItem('gwap.telegram.music.v1')), 'on');

    await page.locator('summary').filter({ hasText: 'Privacy settings' }).click();
    assert.match(await page.locator('.settings-card').nth(1).innerText(), /Demo progress/);
    await page.locator('summary').filter({ hasText: 'Terms & conditions' }).click();
    assert.match(await page.locator('.settings-card').nth(2).innerText(), /educational simulation/i);

    await page.getByRole('button', { name: '← BACK' }).click();
    await page.getByRole('button', { name: /PLAY THE DEMO/i }).click();
    await page.locator('[data-action="open-daily"]').waitFor();
    assert.match(await page.locator('.prototype-tag').innerText(), /LOCAL-ONLY COINS/);
  } finally {
    await context.close();
    await browser.close();
  }
});

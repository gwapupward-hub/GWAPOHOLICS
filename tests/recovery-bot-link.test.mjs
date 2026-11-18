import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOT_USERNAME } from '../config.mjs';

test('isolated recovery build directs users to the recovery Telegram bot only', () => {
  assert.equal(BOT_USERNAME, 'GwapRecovery_bot');
  const href = `https://t.me/${encodeURIComponent(BOT_USERNAME)}?startapp`;
  assert.equal(href, 'https://t.me/GwapRecovery_bot?startapp');
  assert.ok(!href.includes('TestGwap_bot'));
  assert.ok(!href.includes('GwapoholicsBot'));
});

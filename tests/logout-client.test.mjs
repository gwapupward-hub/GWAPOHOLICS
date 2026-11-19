import test from 'node:test';
import assert from 'node:assert/strict';
import { logoutTelegramSession } from '../server-client.mjs';

test('logout clears the signed session through the existing authorized API contract', async () => {
  const sent = [];
  assert.equal(await logoutTelegramSession({ fetcher: async (url, options) => {
    sent.push({ url, options });
    return { ok: true, status: 200 };
  } }), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/api/logout');
  assert.equal(sent[0].options.method, 'POST');
  assert.equal(sent[0].options.credentials, 'same-origin');
  assert.equal(sent[0].options.cache, 'no-store');
  assert.equal(sent[0].options.headers['X-GWAP-Request'], '1');
  assert.deepEqual(JSON.parse(sent[0].options.body), {});
  assert.doesNotMatch(JSON.stringify(sent), /initData|telegram_bot_token|DATABASE_URL/i);
});

test('a failed logout rejects so the UI retains the authenticated session', async () => {
  await assert.rejects(logoutTelegramSession({
    fetcher: async () => ({ ok: false, status: 503 })
  }), /Secure game service unavailable/);
});

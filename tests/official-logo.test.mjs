import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const OFFICIAL_ASSET = new URL('../GWAPOHOLICS_512_single_path.svg', import.meta.url);
const APP_FAVICON = new URL('../brand.svg', import.meta.url);
const APPROVED_SHA256 = 'cd9243dca3e76f71f9e567aa0401a04300c0268a0d0b4cd655419437e58af7cf';

test('locked GWAPOHOLICS silhouette master is byte-identical to founder-approved upload', () => {
  const master = readFileSync(OFFICIAL_ASSET);
  const sha256 = createHash('sha256').update(master).digest('hex');
  assert.equal(sha256, APPROVED_SHA256, 'do not redraw, alter or silently replace the approved master');
  assert.equal(master.length, 3980, 'master must preserve exact uploaded file bytes');
});

test('official master is transparent black with a 512x512 canvas and a single SVG path', () => {
  const svg = readFileSync(OFFICIAL_ASSET, 'utf8');
  assert.match(svg, /<svg\b[^>]*\bwidth="512"\s+height="512"\s+viewBox="0 0 512 512"/);
  assert.equal((svg.match(/<path\b/g) || []).length, 1);
  assert.match(svg, /<path\b[^>]*\bfill="#000000"/);
  assert.equal((svg.match(/<(?!\/)([A-Za-z][\w:-]*)\b/g) || []).length, 2,
    'only svg and path elements are allowed in the canonical master');
  assert.doesNotMatch(svg, /<(?:rect|image|script|style|defs|circle|linearGradient)\b/i);
});

test('app favicon uses the exact approved silhouette, not the old multi-color logo', () => {
  assert.deepEqual(readFileSync(APP_FAVICON), readFileSync(OFFICIAL_ASSET));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<link\s+rel="icon"\s+href="\.\/brand\.svg"\s+type="image\/svg\+xml"/);
});

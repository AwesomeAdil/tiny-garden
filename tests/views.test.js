import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewScale, worldOffset } from '../web/js/core/pixel.js';

test('3440x1440 is scale 3', () => {
  assert.deepEqual(viewScale(3440, 1440), { s: 3, w: 1146, h: 480 });
});

test('1512x944 at 2x is scale 4', () => {
  assert.deepEqual(viewScale(3024, 1888), { s: 4, w: 756, h: 472 });
});

test('viewScale never crops the world', () => {
  for (let dW = 700; dW <= 4000; dW += 37) for (let dH = 320; dH <= 2200; dH += 41) {
    const r = viewScale(dW, dH);
    assert.ok((r.w >= 640 && r.h >= 300) || r.s === 1, `${dW}x${dH} -> ${JSON.stringify(r)}`);
  }
});

test('worldOffset centres the world', () => {
  assert.deepEqual(worldOffset(1146, 480), { ox: 253, oy: 90 });
  assert.deepEqual(worldOffset(640, 300), { ox: 0, oy: 0 });
  assert.deepEqual(worldOffset(757, 301), { ox: 58, oy: 0 });
});

test('no corner label elements', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('id="where"'));
  assert.ok(!html.includes('id="playtag"'));
});

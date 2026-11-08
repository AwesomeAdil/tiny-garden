import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewScale, worldOffset, worldView, toWorld, toCanvas } from '../web/js/core/pixel.js';

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

test('worldView fits the world to the canvas and centres it', () => {
  const a = worldView(1146, 480); assert.equal(a.k, 1.6); assert.deepEqual([a.ox, a.oy], [61, 0]);
  const b = worldView(756, 472); assert.ok(Math.abs(b.k - 756 / 640) < 1e-9); assert.equal(b.ox, 0); assert.equal(b.oy, Math.floor((472 - 300 * b.k) / 2));
  assert.deepEqual(worldView(640, 300), { k: 1, ox: 0, oy: 0 });
  // the whole world is on the canvas, and one axis is filled
  for (const [W, H] of [[1146, 480], [756, 472], [688, 288], [2000, 300]]) {
    const v = worldView(W, H), [x0, y0] = toCanvas(v, 0, 0), [x1, y1] = toCanvas(v, 640, 300);
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= W && y1 <= H, `${W}x${H}`);
    assert.ok(W - (x1 - x0) < 2 || H - (y1 - y0) < 2, `${W}x${H} fills an axis`);
    const p = toWorld(v, { x: toCanvas(v, 123, 45)[0], y: toCanvas(v, 123, 45)[1] }); assert.ok(Math.abs(p.x - 123) < 1e-9 && Math.abs(p.y - 45) < 1e-9);
  }
});

test('no corner label elements', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('id="where"'));
  assert.ok(!html.includes('id="playtag"'));
});

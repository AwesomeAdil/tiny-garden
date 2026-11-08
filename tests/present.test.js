import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { PixCtx } = await import('../web/js/core/pixctx.js');
const { present, dirtyBox } = await import('../web/js/core/present.js');

const W = 640, H = 300;
const rec = () => { const calls = []; return { calls, putImageData: (img, dx, dy, ...dirty) => calls.push([dx, dy, ...dirty]) } };
// A frame: a flat background, a horizon, and one walker (3x5 px) at x, y.
function frame(c, x, y) {
  c.fillStyle = '#14151f'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#8bd5ca'; c.fillRect(0, 200, W, 4);
  c.fillStyle = '#f5a97f'; c.fillRect(x, y, 3, 5);
}

test('a frame where only one walker moved puts only that walker\'s rows (and columns)', () => {
  const c = new PixCtx(W, H), prev = new Uint32Array(W * H), ctx = rec();
  frame(c, 100, 120); present(ctx, c, prev, true);
  assert.deepEqual(ctx.calls[0], [0, 0, 0, 0, W, H], 'a forced frame puts the whole canvas');
  frame(c, 102, 120); present(ctx, c, prev, false);
  assert.equal(ctx.calls.length, 2, 'one put per frame');
  assert.deepEqual(ctx.calls[1], [0, 0, 100, 120, 5, 5], 'only rows 120..124 (columns 100..104) are put');
  assert.deepEqual(prev, c.px, 'prev holds the frame that is on screen');
});

test('an unchanged frame puts nothing; two movers put one box around both', () => {
  const c = new PixCtx(W, H), prev = new Uint32Array(W * H), ctx = rec();
  const two = (y1, x2) => { frame(c, 10, y1); c.fillRect(x2, 250, 3, 5) };
  two(50, 300); present(ctx, c, prev, true);
  two(50, 300); present(ctx, c, prev, false);
  assert.equal(ctx.calls.length, 1, 'nothing changed: nothing put');
  two(51, 301); present(ctx, c, prev, false);
  assert.deepEqual(ctx.calls[1], [0, 0, 10, 50, 294, 205], 'rows 50..254, columns 10..303');
  assert.deepEqual(prev, c.px);
});

test('dirtyBox finds the box around every changed pixel', () => {
  const w = 8, h = 6, a = new Uint32Array(w * h), b = a.slice();
  assert.equal(dirtyBox(a, b, w, h), null);
  b[w * 2 + 3] = 1; assert.deepEqual(dirtyBox(a, b, w, h), [3, 2, 1, 1]);
  b[w * 3 + 6] = 1; b[w * 4 + 1] = 1; assert.deepEqual(dirtyBox(a, b, w, h), [1, 2, 6, 3], 'a middle row widens it');
  b[w * 5 + 0] = 1; assert.deepEqual(dirtyBox(a, b, w, h), [0, 2, 7, 4]);
});

test('present copies exactly what it puts, so the next frame compares against the screen', () => {
  const c = new PixCtx(W, H), prev = new Uint32Array(W * H), ctx = rec();
  frame(c, 100, 120); present(ctx, c, prev, true);
  for (let x = 100; x < 140; x += 2) { frame(c, x, 120 + (x % 7)); present(ctx, c, prev, false); assert.deepEqual(prev, c.px) }
});

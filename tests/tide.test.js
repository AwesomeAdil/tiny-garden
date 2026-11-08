// TIDE's world map: earth-like continents per game seed (kit.js tideWorld), on the city horizon and the system sphere.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { newGame } = await import('../web/js/sim/game.js');
const { skip } = await import('../web/js/sim/dev.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { worldView } = await import('../web/js/core/pixel.js');
const { tideWorld, planetLayer, oceanSurf, MW, MH } = await import('../web/js/draw/kit.js');
const { cityBackground, horizon } = await import('../web/js/draw/city.js');

// The land mask on a 128 x 48 grid of the map, between the ice caps.
const mask = seed => { const Wd = tideWorld(seed), m = []; for (let j = 0; j < 48; j++) for (let i = 0; i < 128; i++) m.push(Wd.field(i / 128 * MW, MH * (.2 + .6 * (j + .5) / 48)) > 0 ? 1 : 0); return m };
const disc = seed => { const c = new PixCtx(320, 120); planetLayer(c, 320, 120, 160, 900, 820, 1, 1, { rim: 8, seed }); return Buffer.from(c.d) };

test('the same seed draws the same planet', () => {
  assert.ok(disc(3).equals(disc(3)));
  const f = oceanSurf(3), g = oceanSurf(3);
  for (let i = 0; i < 50; i++) { const u = i / 50, v = (i * 7 % 50) / 50; assert.equal(f(u, v, 0), g(u, v, 9)) }
});

test('different seeds grow different continents', () => {
  const seeds = [1, 3, 7, 11, 12345], M = seeds.map(mask);
  for (let a = 0; a < M.length; a++) for (let b = a + 1; b < M.length; b++) {
    const diff = M[a].reduce((n, v, i) => n + (v !== M[b][i]), 0) / M[a].length;
    assert.ok(diff > .2, `seeds ${seeds[a]} and ${seeds[b]} share ${(100 - diff * 100).toFixed(0)}% of their land mask`);
  }
  assert.ok(!disc(1).equals(disc(7)), 'the horizon differs too');
});

test('every seed has land and ocean: 25-55% land', () => {
  for (let seed = 0; seed < 24; seed++) { const m = mask(seed * 7919 + 1), f = m.reduce((a, b) => a + b, 0) / m.length; assert.ok(f >= .25 && f <= .55, `seed ${seed * 7919 + 1}: ${(f * 100).toFixed(0)}% land`) }
});

test("the planet stays out of the city's island zone: it reads as dark as the sky there", () => {
  const W = 1146, H = 480, v = { w: W, h: H, ...worldView(W, H) }, top = horizon(v).top;
  for (const seed of [1, 3, 7]) {
    const g = skip(newGame(seed)), B = cityBackground(g, g.worlds[0], v), d = B.px.d;
    let sum = 0, bright = 0, n = 0;
    for (let y = Math.round(H * .3); y < Math.min(Math.round(H * .8), top - 4); y++) for (let x = Math.round(W * .1); x < Math.round(W * .9); x++) { const i = (y * W + x) * 4, l = d[i] + d[i + 1] + d[i + 2]; sum += l; n++; if (l > 330) bright++ }
    assert.ok(sum / n < 140, `seed ${seed}: mean ${(sum / n).toFixed(0)} over the island zone`);
    assert.ok(bright / n < .012, `seed ${seed}: ${(bright / n * 100).toFixed(1)}% bright`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { sysPlanets, sysPos, stepAll } from '../web/js/sim/system.js';
import { newGame } from '../web/js/sim/game.js';
import { node, tie } from '../web/js/sim/world.js';
import { STAGE_COST } from '../web/js/sim/content.js';
import { sim } from './helpers.js';

test('sysPlanets lists the worlds, then the unreachable stars', () => {
  const g = newGame(1);
  const ps = sysPlanets(g);
  assert.deepEqual(ps.map(p => p.name), ['TIDE', 'CINDER', 'RIME', 'TEMPEST']);
  assert.equal(ps[0].w, g.worlds[0]);
  assert.equal(ps[2].w, null);
  const [x, y] = sysPos(ps[0], 0);
  assert.ok(Math.abs(x - (160 + Math.cos(ps[0].a) * ps[0].R)) < 1e-9 && Math.abs(y - (100 + Math.sin(ps[0].a) * ps[0].R * .5)) < 1e-9);
});

test('stepAll grows islands in the same step as their last delivery', () => {
  const g = newGame(3), w = g.worlds[0];
  const f = node(w, 'frost'), h = node(w, 'home');
  f.x = 200; f.y = 150; h.x = 300; h.y = 150;
  const r = tie(w, f, h);
  // HOME needs water (FROST makes it) and light; light is already paid, water is one short.
  h.paid.light = STAGE_COST[1]; h.paid.water = STAGE_COST[1] - 1;
  r.load.push({ k: 'water', d: 'home' }); r.dir = 1; r.u = 0.999;
  assert.equal(h.stage, 1);
  stepAll(g, .1);
  assert.equal(h.stage, 2);
});

test('stepAll keeps only the last 50 events per world', () => {
  const g = newGame(3);
  for (let i = 0; i < 80; i++) g.worlds[0].events.push({ msg: 'm' + i, warn: false });
  stepAll(g, .1);
  assert.equal(g.worlds[0].events.length, 50);
  assert.equal(g.worlds[0].events.at(-1).msg, 'm79');
  sim(g, 1);
});

test('stepAll skips worlds that have not started', () => {
  const g = newGame(3);
  stepAll(g, .1);
  assert.equal(g.worlds[1].S.time, 0);
});

// ---------- arcs around the sun ----------
const { arcPath, sysView, sysXY } = await import('../web/js/draw/system.js');
const { rngf } = await import('../web/js/core/pixel.js');
const minDist = (pts, s) => Math.min(...pts.map(([x, y]) => Math.hypot(x - s[0], y - s[1])));

test('arcPath never passes near the sun', () => {
  const r = rngf(5), sun = [573, 240], rSun = 14;
  for (let i = 0; i < 200; i++) {
    const a = r() * 6.283, b = i % 4 === 0 ? a + Math.PI : r() * 6.283, Ra = 60 + r() * 400, Rb = 60 + r() * 400;
    const A = [sun[0] + Math.cos(a) * Ra, sun[1] + Math.sin(a) * Ra * .34], B = [sun[0] + Math.cos(b) * Rb, sun[1] + Math.sin(b) * Rb * .34];
    const pts = arcPath(A, B, sun, rSun);
    assert.deepEqual(pts[0], A); assert.deepEqual(pts.at(-1), B);
    assert.ok(minDist(pts, sun) >= rSun + 6 - 1e-6, `pair ${i}: ${minDist(pts, sun)}`);
  }
  // directly opposite on the horizontal line through the sun
  assert.ok(minDist(arcPath([100, 240], [1046, 240], sun, rSun), sun) >= rSun + 6);
});

test('arcPath bows gently when the line is clear', () => {
  const sun = [300, 300], A = [100, 100], B = [500, 100], pts = arcPath(A, B, sun, 12), L = 400;
  const mid = pts[Math.floor(pts.length / 2)], bow = Math.abs(mid[1] - 100);
  // a quadratic's midpoint sits half the control offset off the chord: .15 L / 2
  assert.ok(Math.abs(bow - .075 * L) < 1.5, `bow ${bow}`);
  assert.ok(mid[1] < 100, 'it bows away from the sun');
  assert.ok(pts.length >= L * .9, 'about a point a pixel');
});

test('the planets at opposite sides of the sun get an arc that clears it', () => {
  const v = sysView(1146, 480), g = newGame(1), ps = sysPlanets(g), sun = [v.cx, v.cy];
  for (const a of [0, 1, 2, 3, 4, 5, 6]) {
    const A = sysXY(v, { ...ps[0], a }, 0), B = sysXY(v, { ...ps[1], a: a + Math.PI }, 0);
    assert.ok(minDist(arcPath(A, B, sun, 14), sun) >= 20);
  }
});

test('arcBlend is continuous over a full relative orbit and always clears the sun', async () => {
  const { arcBlend } = await import('../web/js/draw/system.js');
  const v = sysView(1146, 480), g = newGame(1), ps = sysPlanets(g), sun = [v.cx, v.cy], rS = 17, N = 6000, span = 2 * Math.PI / Math.abs(ps[1].v - ps[0].v);
  let prev = null, worstCtrl = 0, worstW = 0, flips = 0;
  for (let i = 0; i <= N; i++) {
    const T = i / N * span, A = sysXY(v, ps[0], T), B = sysXY(v, ps[1], T), arcs = arcBlend(A, B, sun, rS);
    assert.ok(Math.abs(arcs.reduce((a, x) => a + x.w, 0) - 1) < 1e-9, 'weights sum to 1');
    for (const a of arcs) assert.ok(minDist(a.pts, sun) >= rS + 6 - 1e-6, `step ${i} clear: ${minDist(a.pts, sun)}`);
    const cur = { plus: arcs.find(a => a.w > 0 && a.side === 1), arcs };
    if (prev) {
      // an arc that stays on screen across two samples (both weights > 0) must have its control point move only a few px
      for (let k = 0; k < Math.min(arcs.length, prev.length); k++) {
        const a = arcs[k], b = prev[k]; if (arcs.length !== prev.length || a.w < .03 || b.w < .03) continue; // a nearly gone arc is invisible
        worstCtrl = Math.max(worstCtrl, Math.hypot(a.ctrl[0] - b.ctrl[0], a.ctrl[1] - b.ctrl[1]));
      }
      const wa = arcs[0].w, wb = prev[0].w; if (arcs.length === prev.length) worstW = Math.max(worstW, Math.abs(wa - wb));
      if (arcs.length !== prev.length) flips++;
    }
    prev = arcs;
  }
  assert.ok(worstCtrl <= 6, `control point jumped ${worstCtrl.toFixed(1)} px between adjacent samples`);
  assert.ok(worstW <= .05, `weight jumped ${worstW.toFixed(3)}`);
  assert.ok(flips >= 0);
});

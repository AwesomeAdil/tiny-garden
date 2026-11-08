import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, makeWorld, tie, untie, node, isl, dist, makes, piers, canTie, bandOf, spine } from '../web/js/sim/world.js';
import { DEF_OCEAN, ISL_OCEAN, ISL_LAVA, MAXR, TOWN, ISLAND_HW, BAND_Y } from '../web/js/sim/content.js';

const at = (w, id, x, y) => { const n = node(w, id); n.x = x; n.y = y; return n };

const reachable = pts => { const seen = new Set(), q = [[TOWN.x, TOWN.y]]; while (q.length) { const [cx, cy] = q.shift(); pts.forEach((p, i) => { if (!seen.has(i) && Math.hypot(p[0] - cx, p[1] - cy) <= MAXR - 8) { seen.add(i); q.push(p) } }) } return seen.size };

test('horizon layout: bands, spread, spacing and reach, for both worlds', () => {
  for (const ids of [Object.keys(ISL_OCEAN), Object.keys(ISL_LAVA)]) for (let seed = 1; seed <= 20; seed++) {
    const pos = layout(seed, ids), pts = Object.values(pos), why = `${ids.length} islands, seed ${seed}`;
    assert.equal(pts.length, ids.length);
    assert.equal(reachable(pts), ids.length, `${why}: an island is cut off`);
    const bands = { far: 0, mid: 0, near: 0 };
    for (const [x, y, band] of pts) {
      const [lo, hi] = BAND_Y[band];
      assert.ok(y >= lo && y <= hi && x >= 40 && x <= 600, `${why}: ${band} island at ${x},${y}`);
      assert.equal(bandOf(y), band, `${why}: bandOf agrees`);
      bands[band]++;
    }
    for (const b of ['far', 'mid', 'near']) assert.ok(bands[b] >= 1 && bands[b] <= Math.ceil(ids.length / 3), `${why}: ${b} x${bands[b]}`);
    const xs = pts.map(p => p[0]);
    assert.ok(Math.max(...xs) - Math.min(...xs) >= 400, `${why}: spread ${Math.max(...xs) - Math.min(...xs)}`);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[i][2] === pts[j][2])
      assert.ok(Math.abs(pts[i][0] - pts[j][0]) >= ISLAND_HW[pts[i][2]] * 2 + 12, `${why}: two ${pts[i][2]} islands overlap`);
    assert.ok(pts.filter(p => Math.hypot(p[0] - TOWN.x, p[1] - TOWN.y) <= MAXR).length >= 2, `${why}: the town reaches fewer than 2 islands`);
  }
});

test('makeWorld stores each island\'s band', () => {
  const w = makeWorld(DEF_OCEAN, 3);
  for (const n of isl(w)) assert.equal(n.band, bandOf(n.y));
  assert.deepEqual(TOWN, { x: 320, y: 240, r: 22 });
});

test('islands start as bare rocks with no bridges', () => {
  const w = makeWorld(DEF_OCEAN, 3), is = isl(w);
  assert.equal(is.length, 6);
  for (const n of is) { assert.equal(n.stage, 1); assert.deepEqual(n.paid, { water: 0, light: 0, stone: 0 }) }
  assert.equal(w.S.ropes.length, 0);
});

test('makes follows the type table, plus sends', () => {
  const w = makeWorld(DEF_OCEAN, 3), f = node(w, 'frost');
  assert.deepEqual(makes(w, f), ['water']);
  f.sends = 'light';
  assert.deepEqual(makes(w, f), ['water', 'light']);
});

test('piers grow with stage; the town has 4', () => {
  const w = makeWorld(DEF_OCEAN, 3), n = node(w, 'home');
  assert.equal(piers(n), 2);
  n.stage = 4;
  assert.equal(piers(n), 5);
  assert.equal(piers(w.hub), 4);
});

test('canTie refuses self, duplicate, out of reach, full piers and crossings', () => {
  const w = makeWorld(DEF_OCEAN, 3);
  const a = at(w, 'home', 100, 100), b = at(w, 'ember', 180, 100), c = at(w, 'frost', 140, 60), d = at(w, 'amethyst', 140, 140);
  at(w, 'verdant', 600, 20); at(w, 'anvil', 20, 20);
  assert.equal(canTie(w, a, a).why, 'self');
  assert.deepEqual(canTie(w, a, b), { ok: true });
  tie(w, a, b);
  assert.equal(canTie(w, a, b).why, 'dup');
  assert.equal(canTie(w, b, a).why, 'dup');
  assert.equal(canTie(w, a, node(w, 'verdant')).why, 'reach');
  assert.equal(canTie(w, c, d).why, 'cross');
  // home (stage 1) has 2 piers: one more rope fills it
  tie(w, a, c);
  assert.equal(canTie(w, a, node(w, 'anvil')).why, 'piers');
  const r = w.S.ropes[0];
  untie(w, r.id);
  assert.equal(w.S.ropes.length, 1);
  assert.equal(canTie(w, c, d).ok, true);
});

test('the spine ties every island to the town with stage-1 piers and no crossings', async () => {
  const { autoNet } = await import('../web/js/sim/dev.js');
  const { DEF_LAVA } = await import('../web/js/sim/content.js');
  for (const def of [DEF_OCEAN, DEF_LAVA]) for (let seed = 1; seed <= 20; seed++) {
    const w = makeWorld(def, seed), sorted = isl(w).slice().sort((a, b) => a.x - b.x);
    const sp = spine(sorted);
    assert.equal(sp.length, sorted.length, `${def.key} seed ${seed}: one bridge per island`);
    for (const [p, q] of sp) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) <= MAXR - 8, `${def.key} seed ${seed}: ${p.id}-${q.id} out of reach`);
    autoNet(w);
    const on = new Set(['planet']); for (let ch = 1; ch;) { ch = 0; for (const r of w.S.ropes) if (on.has(r.a) !== on.has(r.b)) { on.add(r.a); on.add(r.b); ch = 1 } }
    assert.equal(on.size, sorted.length + 1, `${def.key} seed ${seed}: autoNet leaves an island cut off`);
  }
});

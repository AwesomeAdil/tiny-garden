import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, makeWorld, tie, untie, node, isl, dist, makes, piers, canTie } from '../web/js/sim/world.js';
import { DEF_OCEAN, ISL_OCEAN, MAXR, TOWN } from '../web/js/sim/content.js';

const at = (w, id, x, y) => { const n = node(w, id); n.x = x; n.y = y; return n };

test('layout puts every island inside 640x300 and reachable from the town', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const pos = layout(seed, Object.keys(ISL_OCEAN));
    const pts = Object.values(pos);
    assert.equal(pts.length, 6);
    for (const [x, y] of pts) assert.ok(x > 0 && x < 640 && y > 0 && y < TOWN.y - 20, `seed ${seed}: ${x},${y}`);
    const seen = new Set(), q = [[TOWN.x, TOWN.y]];
    while (q.length) { const [cx, cy] = q.shift(); pts.forEach((p, i) => { if (!seen.has(i) && Math.hypot(p[0] - cx, p[1] - cy) <= MAXR - 8) { seen.add(i); q.push(p) } }) }
    assert.equal(seen.size, 6, `seed ${seed} leaves an island cut off`);
  }
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

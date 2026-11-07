import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, makeWorld, tie, node, dist } from '../web/js/sim/world.js';
import { tangled, allPairs, hops, nextHop } from '../web/js/sim/graph.js';
import { ISL_OCEAN, DEF_OCEAN, MAXR } from '../web/js/sim/content.js';

const mk = (id, x, y) => ({ id, kind: 'island', x, y, r: 12, stock: {} });

test('layout places every island inside the map, 46px apart, all reachable from the planet', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const pos = layout(seed, Object.keys(ISL_OCEAN), 'home');
    assert.equal(Object.keys(pos).length, 6);
    const pts = Object.values(pos);
    for (const [x, y] of pts) assert.ok(x >= 22 && x <= 298 && y >= 26 && y <= 182);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) >= 46);
    const seen = new Set([-1]), q = [[160, 100]], all = pts;
    const done = new Set();
    while (q.length) { const [cx, cy] = q.shift(); all.forEach((p, i) => { if (!done.has(i) && Math.hypot(p[0] - cx, p[1] - cy) <= MAXR - 8) { done.add(i); q.push(p) } }) }
    assert.equal(done.size, 6);
  }
});

test('makeWorld starts with the planet, the start island found, 10 Rock', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  assert.equal(w.hub.stock.rock, 10);
  assert.deepEqual([...w.S.found].sort(), ['home', 'planet']);
  assert.equal(w.started, false);
  assert.equal(w.S.nodes.length, 7);
  assert.deepEqual(layout(7, Object.keys(ISL_OCEAN), 'home'), w.POS);
});

test('tie caps length at MAXR and gives unique ids', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  const a = mk('a', 0, 0), b = mk('b', 50, 0), c = mk('c', 300, 0);
  const r1 = tie(w, a, b), r2 = tie(w, a, c);
  assert.notEqual(r1.id, r2.id);
  assert.equal(r1.len, Math.min(112, dist(a, b) + 12));
  assert.equal(r2.len, 112);
  assert.equal(w.S.ropes.length, 2);
});

test('tangled flags crossing ropes only', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  w.S.nodes = [mk('a', 0, 0), mk('b', 100, 100), mk('c', 100, 0), mk('d', 0, 100)];
  const r1 = tie(w, node(w, 'a'), node(w, 'b')), r2 = tie(w, node(w, 'c'), node(w, 'd'));
  assert.deepEqual([...tangled(w)].sort(), [r1.id, r2.id].sort());
  w.S.ropes = [];
  const s1 = tie(w, node(w, 'a'), node(w, 'b')), s2 = tie(w, node(w, 'a'), node(w, 'c'));
  assert.equal(tangled(w).size, 0, `${s1.id},${s2.id} share an endpoint`);
});

test('hops and nextHop follow the rope graph', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  tie(w, node(w, 'planet'), node(w, 'home'));
  tie(w, node(w, 'home'), node(w, 'ember'));
  allPairs(w);
  assert.equal(hops(w, 'planet', 'ember'), 2);
  assert.equal(nextHop(w, 'planet', 'ember'), 'home');
  assert.equal(hops(w, 'planet', 'frost'), Infinity);
  assert.equal(nextHop(w, 'planet', 'frost'), undefined);
});

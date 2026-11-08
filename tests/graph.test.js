import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, tie, node } from '../web/js/sim/world.js';
import { arcs, allPairs, hops, nextHop, cycleWay } from '../web/js/sim/graph.js';
import { DEF_OCEAN } from '../web/js/sim/content.js';

test('one-way arcs', () => {
  const w = makeWorld(DEF_OCEAN, 3), r = tie(w, node(w, 'home'), node(w, 'ember'));
  r.way = 1;
  assert.ok(arcs(w, 'home').includes('ember'));
  assert.ok(!arcs(w, 'ember').includes('home'));
  r.way = -1;
  assert.ok(!arcs(w, 'home').includes('ember'));
  assert.ok(arcs(w, 'ember').includes('home'));
});

test('cycleWay goes both, a→b, b→a, both', () => {
  assert.equal(cycleWay({ way: 0 }), 1);
  assert.equal(cycleWay({ way: 1 }), -1);
  assert.equal(cycleWay({ way: -1 }), 0);
});

test('hops respects direction', () => {
  const w = makeWorld(DEF_OCEAN, 3);
  tie(w, node(w, 'home'), node(w, 'ember')).way = 1;
  tie(w, node(w, 'ember'), node(w, 'frost')).way = 1;
  allPairs(w);
  assert.equal(hops(w, 'frost', 'home'), Infinity);
  assert.equal(hops(w, 'home', 'frost'), 2);
  assert.equal(nextHop(w, 'home', 'frost'), 'ember');
  assert.equal(nextHop(w, 'frost', 'home'), undefined);
});

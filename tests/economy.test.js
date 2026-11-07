import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, node, tie } from '../web/js/sim/world.js';
import { allPairs } from '../web/js/sim/graph.js';
import { DEF_OCEAN } from '../web/js/sim/content.js';
import { ropeCost, ropeUp, upkeep, surplus, slots, crowd, ropeSpeed, rateOf, destFor, ropesAt } from '../web/js/sim/economy.js';
import { sim } from './helpers.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);
const mk = () => makeWorld(DEF_OCEAN, 7);

test('rope cost grows with the square of length', () => assert.deepEqual([30, 50, 70, 90, 110].map(ropeCost), [1, 3, 5, 8, 12]));

test('upkeep: bridges by length, islands by level, patch kit', () => {
  const w = mk();
  const r = tie(w, w.hub, node(w, 'home')); r.len = 60;
  near(upkeep(w).b, .6);
  node(w, 'home').level = 3;
  const u = upkeep(w);
  near(u.i, .7); near(u.all, 1.3);
  w.S.patch = 1;
  near(upkeep(w).all, 1.3 * .75);
  w.S.patch = 2;
  near(upkeep(w).all, 1.3 * .5);
});

test('slots and crowding', () => {
  const w = mk();
  ['home', 'ember', 'frost', 'amethyst', 'verdant'].forEach(id => tie(w, w.hub, node(w, id)));
  assert.equal(ropesAt(w, 'planet'), 5);
  assert.equal(slots(w.hub), 4);
  assert.equal(slots({ kind: 'island', dock: 1 }), 4);
  assert.equal(crowd(w, w.hub), 1);
  const r = w.S.ropes[0];
  near(ropeSpeed(w, r), 1 / 1.35);
  r.fast = true;
  near(ropeSpeed(w, r), 1.5 / 1.35);
  w.S.unpaid = true;
  near(ropeSpeed(w, r), .5 * 1.5 / 1.35);
});

test('town square keeps a minute of upkeep before sharing Rock', () => {
  const w = mk();
  const r = tie(w, w.hub, node(w, 'home')); r.len = 150;           // up = 1.2
  const r2 = tie(w, w.hub, node(w, 'ember')); r2.len = 150;        // up = 1.2
  const r3 = tie(w, w.hub, node(w, 'frost')); r3.len = 30;         // up = .4 -> 2.8, ceil 3
  w.hub.stock.rock = 10;
  near(upkeep(w).all, 2.8);
  assert.equal(surplus(w, w.hub, 'rock'), 7);
  r3.len = 60; near(upkeep(w).all, 3.0);                           // .2+.4 -> 1.2+1.2+.6
  w.S.found.add('home'); node(w, 'home').level = 2;                // +.35 -> 3.35 -> ceil 4
  assert.equal(surplus(w, w.hub, 'rock'), 6);
  assert.equal(surplus(w, w.hub, 'heat'), 0);
});

test('gentle: unmet needs run at 0.35', () => {
  const w = mk();
  near(rateOf(w, node(w, 'home')), .5 * .35 * 1.0);
  node(w, 'home').stock.water = 1;
  near(rateOf(w, node(w, 'home')), .5);
  // frost makes the world's bonus kind (water): x1.5
  near(rateOf(w, node(w, 'frost')), .45 * .35 * 1.5);
});

test('goods go where they are asked for', () => {
  const w = mk(); w.started = true;
  tie(w, w.hub, node(w, 'home')); tie(w, node(w, 'home'), node(w, 'amethyst'));
  allPairs(w);
  w.S.found.add('amethyst');
  assert.equal(destFor(w, node(w, 'home'), 'rock'), 'amethyst');
  node(w, 'home').stock.water = 50;
  assert.equal(node(w, 'amethyst').stock.rock, 0);
  sim({ worlds: [w] }, 90);
  assert.ok(node(w, 'amethyst').stock.rock > 0);
});

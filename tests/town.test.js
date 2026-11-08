import test from 'node:test';
import assert from 'node:assert/strict';
import { node, isl, tie } from '../web/js/sim/world.js';
import { TOWN_COST, CABLE_COST, cableOpen, townCost, growTown } from '../web/js/sim/town.js';
import { freshGame, sim } from './helpers.js';

const at = (w, id, x, y) => { const n = node(w, id); n.x = x; n.y = y; return n };

test('town grows by receiving all three goods', () => {
  const g = freshGame(3), w = g.worlds[0];
  isl(w).forEach((n, i) => { n.x = 40 + i * 20; n.y = 20 });
  tie(w, w.hub, at(w, 'frost', 260, 240));
  tie(w, w.hub, at(w, 'ember', 320, 200));
  tie(w, w.hub, at(w, 'home', 380, 240));
  assert.deepEqual(townCost(w), { water: TOWN_COST[1], light: TOWN_COST[1], stone: TOWN_COST[1] });
  assert.equal(w.hub.stage, 1);
  sim(g, 4000);
  assert.ok(w.hub.stage >= 2);
  assert.deepEqual(w.hub.paid.water <= TOWN_COST[w.hub.stage], true);
});

test('cable unlocks only when every island is at stage 3', () => {
  const g = freshGame(3), w = g.worlds[0];
  w.hub.stage = 4;
  isl(w).forEach(n => { n.stage = 3 });
  assert.equal(cableOpen(w), true);
  assert.deepEqual(townCost(w), { water: CABLE_COST, light: CABLE_COST, stone: CABLE_COST });
  isl(w)[0].stage = 2;
  assert.equal(cableOpen(w), false);
  assert.deepEqual(townCost(w), { water: 0, light: 0, stone: 0 });
  isl(w)[0].stage = 3; w.S.cable = true;
  assert.equal(cableOpen(w), false);
  assert.equal(cableOpen(g.worlds[1]), false, 'CINDER has no next world');
});

test('paying the cable starts CINDER and adds a cable', () => {
  const g = freshGame(3), w = g.worlds[0];
  w.hub.stage = 4;
  isl(w).forEach(n => { n.stage = 3 });
  growTown(g, w);
  assert.equal(w.S.cable, false);
  for (const k of ['water', 'light', 'stone']) w.hub.paid[k] = CABLE_COST;
  assert.equal(g.worlds[1].started, false);
  growTown(g, w);
  assert.equal(w.S.cable, true);
  assert.equal(g.worlds[1].started, true);
  assert.deepEqual(g.cables, [{ a: 0, b: 1 }]);
  assert.deepEqual(w.hub.paid, { water: 0, light: 0, stone: 0 });
  assert.ok(w.events.some(e => e.msg.includes('CINDER')));
  growTown(g, w);
  assert.equal(g.cables.length, 1);
});

test('town stages up one stage per call and resets paid', () => {
  const g = freshGame(3), w = g.worlds[0];
  for (const k of ['water', 'light', 'stone']) w.hub.paid[k] = 9999;
  growTown(g, w);
  assert.equal(w.hub.stage, 2);
  assert.deepEqual(w.hub.paid, { water: 0, light: 0, stone: 0 });
});

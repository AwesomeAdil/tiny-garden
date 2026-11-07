import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, node, tie } from '../web/js/sim/world.js';
import { DEF_OCEAN } from '../web/js/sim/content.js';
import { step } from '../web/js/sim/step.js';
import { upkeep } from '../web/js/sim/economy.js';
import { autoNet, sim } from './helpers.js';

const run = (w, s) => { for (let t = 0; t < s - 1e-9; t += .1) step(w, .1) };

test('step discovers islands reachable from the planet', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  tie(w, w.hub, node(w, 'home'));
  tie(w, node(w, 'home'), node(w, 'ember'));
  step(w, .1);
  assert.ok(w.S.found.has('ember'));
  assert.ok(!w.S.found.has('frost'));
  assert.ok(w.events.some(e => e.msg.startsWith('You found EMBER!')));
});

test('a thriving island levels up every 45 s', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  tie(w, w.hub, node(w, 'home'));
  const home = node(w, 'home');
  home.stock.water = 50;
  step(w, .1);
  home.stock.water = 50; run(w, 45.9);
  assert.equal(home.level, 2);
  home.stock.water = 50; run(w, 45);
  assert.equal(home.level, 3);
  home.stock.water = 50; run(w, 100);
  assert.equal(home.level, 3);
  assert.ok(w.events.some(e => e.msg === 'HOME grew to level 3.'));
});

test('unpaid upkeep frays bridges, paying again mends them', () => {
  const w = makeWorld(DEF_OCEAN, 7);
  ['ember', 'frost', 'amethyst'].forEach(id => tie(w, w.hub, node(w, id)));
  w.hub.stock.rock = 0;
  for (let i = 0; i < 6000 && !w.S.unpaid; i++) step(w, .1);
  assert.equal(w.S.unpaid, true);
  w.hub.stock.rock = 20;
  run(w, 30);
  assert.equal(w.S.unpaid, false);
  assert.ok(w.events.some(e => e.warn && /out of Rock/.test(e.msg)));
  assert.ok(w.events.some(e => !e.warn && e.msg === 'Upkeep paid again. The bridges hold.'));
});

const city = seed => {
  const w = makeWorld(DEF_OCEAN, seed); w.started = true;
  tie(w, w.hub, node(w, 'home'));
  autoNet(w);
  w.hub.stock.rock = 10;
  sim({ worlds: [w] }, 900);
  return w;
};
const lv3 = w => w.S.nodes.filter(n => n.kind === 'island' && n.level === 3).length;

test('a full city stays solvent for 15 minutes', () => {
  // Seed 4 is excluded: page 38 itself runs dry on that layout (see next test).
  for (const seed of [1, 2, 3, 5]) {
    const w = city(seed);
    assert.equal(w.S.unpaid, false, `seed ${seed} unpaid`);
    assert.ok(lv3(w) >= 5, `seed ${seed}: ${lv3(w)} islands at level 3 (upkeep ${upkeep(w).all.toFixed(2)})`);
  }
});

test('seed 4 matches page 38: the city runs dry (upkeep 8.7/min on a tight layout)', () => {
  const w = city(4);
  assert.equal(w.S.unpaid, true);
  assert.equal(lv3(w), 6);
});

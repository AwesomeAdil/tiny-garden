import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_ITEMS, canBuy, buy, launch } from '../web/js/sim/shop.js';
import { newGame } from '../web/js/sim/game.js';
import { node, tie } from '../web/js/sim/world.js';
import { slots, ropeSpeed, upkeep } from '../web/js/sim/economy.js';

const setup = () => { const g = newGame(3); const w = g.worlds[0]; w.started = true; return [g, w]; };
const give = (w, o) => Object.entries(o).forEach(([k, n]) => w.hub.stock[k] += n);

test('shop items are data with the documented shape', () => {
  assert.deepEqual(SHOP_ITEMS.map(i => i.id), ['cable', 'dock', 'fast', 'survey', 'patch']);
  const [g, w] = setup();
  for (const it of SHOP_ITEMS) {
    assert.equal(typeof it.icon, 'string');
    assert.equal(typeof it.what(g, w), 'string');
    assert.equal(typeof it.cost(g, w), 'object');
    assert.ok(['none', 'node', 'rope'].includes(it.target));
  }
});

test('each shop item does what it says', () => {
  const [g, w] = setup();
  const home = node(w, 'home');
  tie(w, w.hub, home);
  const rope = w.S.ropes[0];
  // dock
  const before = slots(home), rock0 = w.hub.stock.rock;
  assert.equal(canBuy(g, w, 'dock', home), false);
  assert.equal(buy(g, w, 'dock', home), false);
  assert.equal(w.hub.stock.rock, rock0);
  give(w, { rock: 4, tools: 2 });
  assert.equal(canBuy(g, w, 'dock', home), true);
  assert.equal(buy(g, w, 'dock', home), true);
  assert.equal(slots(home), before + 1);
  assert.equal(w.hub.stock.rock, rock0);
  assert.equal(w.hub.stock.tools, 0);
  // fast
  give(w, { tools: 2, heat: 2 });
  const sp = ropeSpeed(w, rope);
  assert.equal(buy(g, w, 'fast', rope), true);
  assert.equal(ropeSpeed(w, rope), sp * 1.5);
  give(w, { tools: 2, heat: 2 });
  assert.equal(canBuy(g, w, 'fast', rope), false);
  // survey
  give(w, { light: 4 });
  assert.equal(buy(g, w, 'survey'), true);
  assert.equal(w.S.survey, true);
  give(w, { light: 4 });
  assert.equal(canBuy(g, w, 'survey'), false);
  // patch
  const up = upkeep(w).all;
  w.hub.stock.tools = 0; w.hub.stock.growth = 0;
  give(w, { tools: 12, growth: 9 });
  assert.equal(buy(g, w, 'patch'), true);
  assert.ok(Math.abs(upkeep(w).all - up * .75) < 1e-9);
  assert.equal(buy(g, w, 'patch'), true);
  assert.equal(canBuy(g, w, 'patch'), false);
  assert.equal(buy(g, w, 'patch'), false);
  assert.equal(w.S.patch, 2);
});

test('a target-needing item without a target cannot be bought', () => {
  const [g, w] = setup();
  give(w, { rock: 4, tools: 2 });
  assert.equal(canBuy(g, w, 'dock', null), false);
});

test('the cable costs the goal and launching starts the next world', () => {
  const [g, w] = setup();
  assert.equal(canBuy(g, w, 'cable'), false);
  give(w, w.def.goal);
  assert.equal(buy(g, w, 'cable'), true);
  assert.equal(w.S.cable, true);
  assert.equal(g.worlds[1].started, true);
  assert.equal(g.cables.length, 1);
  assert.deepEqual({ a: g.cables[0].a, b: g.cables[0].b }, { a: 0, b: 1 });
  assert.equal(canBuy(g, w, 'cable'), false);
});

test("v1 ends at CINDER's cable", () => {
  const [g] = setup();
  const c = g.worlds[1];
  launch(g, c);
  assert.equal(c.S.cable, true);
  assert.equal(g.cables.length, 0);
  assert.equal(g.worlds.filter(x => x.started).length, 1);
  assert.ok(c.events.some(e => /the next planet comes later/i.test(e.msg)));
});

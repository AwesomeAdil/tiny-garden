import test from 'node:test';
import assert from 'node:assert/strict';
import { nearStarS, cableGeom, sysPlanets, sysPos, stepAll, wantsFrom } from '../web/js/sim/system.js';
import { launch } from '../web/js/sim/shop.js';
import { newGame } from '../web/js/sim/game.js';
import { WORLD_DEFS } from '../web/js/sim/content.js';
import { autoNet, sim } from './helpers.js';

test('the star blocks a cable that passes close to it', () => {
  assert.equal(nearStarS([100, 100], [220, 100]), 0);
  assert.ok(nearStarS([100, 40], [220, 40]) >= 15);
  const at = (x, y) => { const R = Math.hypot(x - 160, (y - 100) * 2); return { R, v: 0, a: Math.atan2((y - 100) * 2, x - 160), r: 6 } };
  const mk = (p, q) => {
    const defs = [{ ...WORLD_DEFS[0], sys: at(...p) }, { ...WORLD_DEFS[1], sys: at(...q) }];
    const g = newGame(1, defs);
    return cableGeom(g, { a: 0, b: 1 });
  };
  assert.equal(mk([100, 100], [220, 100]).blocked, true);
  assert.equal(mk([100, 40], [220, 40]).blocked, false);
});

test('sysPlanets lists the worlds, then the unreachable stars', () => {
  const g = newGame(1);
  const ps = sysPlanets(g);
  assert.deepEqual(ps.map(p => p.name), ['TIDE', 'CINDER', 'RIME', 'TEMPEST']);
  assert.equal(ps[0].w, g.worlds[0]);
  assert.equal(ps[2].w, null);
  const [x, y] = sysPos(ps[0], 0);
  assert.ok(Math.abs(x - (160 + Math.cos(ps[0].a) * ps[0].R)) < 1e-9 && Math.abs(y - (100 + Math.sin(ps[0].a) * ps[0].R * .5)) < 1e-9);
});

test('the cable carries Growth to CINDER, which cannot make it', () => {
  const g = newGame(3);
  autoNet(g.worlds[0]);
  g.worlds[0].started = true;
  launch(g, g.worlds[0]);
  g.worlds[0].hub.stock.growth = 10;
  assert.equal(g.worlds[1].hub.stock.growth, 0);
  for (let i = 0; i < 6000 && g.worlds[1].hub.stock.growth === 0; i++) stepAll(g, .1);
  assert.ok(g.worlds[1].hub.stock.growth > 0);
});

test('cable priority sends the chosen good first', () => {
  const mk = pri => {
    const g = newGame(3); g.worlds[0].started = true; launch(g, g.worlds[0]);
    const h = g.worlds[0].hub.stock; h.growth = 5; h.water = 5; h.tools = 5; h.heat = 5;
    g.ui.pri = pri;
    g.cables[0].blocked = false;
    // run until the cable picks up a load (it may be blocked by the star for a while)
    for (let i = 0; i < 20000 && g.cables[0].load.length === 0; i++) stepAll(g, .1);
    return g.cables[0].load;
  };
  assert.deepEqual(mk('growth'), ['growth', 'growth', 'growth', 'growth']);
  assert.equal(mk('auto')[0], 'heat');
});

test('wantsFrom ignores goods a world makes itself', () => {
  const g = newGame(3);
  assert.equal(wantsFrom(g, 1, 'rock'), false);
  assert.equal(wantsFrom(g, 1, 'growth'), true);
  assert.equal(wantsFrom(g, 0, 'growth'), true);   // VERDANT not found yet
  g.worlds[0].S.found.add('verdant');
  assert.equal(wantsFrom(g, 0, 'growth'), false);
});

test('stepAll keeps only the last 50 events per world', () => {
  const g = newGame(3);
  g.worlds[0].started = true;
  for (let i = 0; i < 80; i++) g.worlds[0].events.push({ msg: 'm' + i, warn: false });
  stepAll(g, .1);
  assert.equal(g.worlds[0].events.length, 50);
  assert.equal(g.worlds[0].events.at(-1).msg, 'm79');
  sim(g, 1);
});

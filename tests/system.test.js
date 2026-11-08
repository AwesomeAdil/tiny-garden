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

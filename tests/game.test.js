import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance, catchUp } from '../web/js/sim/game.js';
import { launch } from '../web/js/sim/shop.js';
import { DEF_OCEAN, DEF_LAVA, WORLD_DEFS } from '../web/js/sim/content.js';
import { node } from '../web/js/sim/world.js';
import { serialize } from '../web/js/sim/save.js';
import { autoNet } from './helpers.js';

test('newGame builds every world from WORLD_DEFS and ties each hub to its start', () => {
  const g = newGame(3);
  assert.equal(g.worlds.length, WORLD_DEFS.length);
  assert.deepEqual(g.worlds.map(w => w.started), [true, false]);
  g.worlds.forEach(w => assert.ok(w.S.ropes.some(r => r.a === 'planet' && r.b === w.def.start)));
  assert.deepEqual(g.ui, { view: 'planet', world: 0, speed: 1, pri: 'auto', sysSel: null, galSel: null, names: true });
  assert.deepEqual(g.cables, []);
  assert.equal(g.savedAt, 0);
  assert.equal(newGame(3, WORLD_DEFS, 99).savedAt, 99);
  assert.deepEqual(newGame(3).worlds[1].POS, newGame(3).worlds[1].POS);
});

test('a new world needs only content', () => {
  const test3 = {
    key: 'test', name: 'TESTA', full: 'test world', surfKey: 'rocky', start: 'a',
    isl: {
      a: { name: 'AAA', col: '#fff', top: '#888', leaf: ['#fff', '#ccc', '#888'], deco: 'house', makes: 'rock', needs: ['water'], rate: .5, quirk: '' },
      b: { name: 'BBB', col: '#fff', top: '#888', leaf: ['#fff', '#ccc', '#888'], deco: 'sparks', makes: 'water', needs: ['rock'], rate: .5, quirk: '' },
    },
    goal: { tools: 1 }, bonusKind: 'rock', sys: { R: 80, v: .01, a: 0, r: 6 }, seedOffset: 3, next: null,
  };
  const defs = [DEF_OCEAN, { ...DEF_LAVA, next: 'test' }, test3];
  const g = newGame(5, defs);
  assert.equal(g.worlds.length, 3);
  assert.equal(DEF_LAVA.next, null);
  launch(g, g.worlds[1]);
  assert.equal(g.worlds[2].started, true);
  assert.deepEqual({ a: g.cables[0].a, b: g.cables[0].b }, { a: 1, b: 2 });
  const copy = JSON.parse(JSON.stringify(g.cables));
  assert.deepEqual(copy, g.cables);
});

test('catch-up equals playing it live', () => {
  const mk = () => { const g = newGame(3); autoNet(g.worlds[0]); autoNet(g.worlds[1]); launch(g, g.worlds[0]); g.worlds[0].hub.stock.growth = 6; return g };
  const A = mk(), B = mk();
  advance(A, 600, 'wallpaper');
  for (let i = 0; i < 6000; i++) advance(B, .1, 'wallpaper');
  assert.deepEqual(serialize(A, 0), serialize(B, 0));
  assert.ok(A.worlds[0].S.time > 599.9);
});

test('catch-up is capped at 12 hours and never runs backwards', () => {
  const g = newGame(3);
  g.savedAt = 1000;
  const now = 1000 + 48 * 3600 * 1000;
  const t0 = g.worlds[0].S.time;
  assert.equal(catchUp(g, now), 43200);
  assert.ok(Math.abs(g.worlds[0].S.time - t0 - 43200) < 1e-3);
  assert.equal(g.savedAt, now);
  g.savedAt = now + 5000;
  const t1 = g.worlds[0].S.time;
  assert.equal(catchUp(g, now), 0);
  assert.equal(g.worlds[0].S.time, t1);
  assert.equal(g.savedAt, now);
});

test('4x only counts in play mode', () => {
  const g = newGame(3); g.ui.speed = 4;
  advance(g, 10, 'play');
  assert.ok(Math.abs(g.worlds[0].S.time - 40) < 1e-6);
  advance(g, 10, 'wallpaper');
  assert.ok(Math.abs(g.worlds[0].S.time - 50) < 1e-6);
});

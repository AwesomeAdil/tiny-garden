import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance, frame } from '../web/js/sim/game.js';
import { startClock, clockSavedAt } from '../web/js/sim/clock.js';
import { WORLD_DEFS } from '../web/js/sim/content.js';
import { autoNet } from './helpers.js';
import { serialize } from '../web/js/sim/save.js';

test('newGame has no bridges', () => {
  const g = newGame(3);
  assert.equal(g.worlds.length, WORLD_DEFS.length);
  assert.deepEqual(g.worlds.map(w => w.started), [true, false]);
  g.worlds.forEach(w => assert.deepEqual(w.S.ropes, []));
  assert.deepEqual(g.ui, { view: 'planet', world: 0, speed: 1, sysSel: null, galSel: null, galPan: { x: 0, y: 0 }, names: true, lessons: {} });
  assert.deepEqual(g.cables, []);
  assert.deepEqual(g.gifts, []);
  assert.equal(g.savedAt, 0);
  assert.equal(newGame(3, WORLD_DEFS, 99).savedAt, 99);
  assert.deepEqual(newGame(3).worlds[1].S.nodes.map(n => [n.x, n.y]), newGame(3).worlds[1].S.nodes.map(n => [n.x, n.y]));
});

test('catch-up equals playing it live', () => {
  const mk = () => { const g = newGame(3); autoNet(g.worlds[0]); return g };
  const A = mk(), B = mk();
  advance(A, 600, 'wallpaper');
  for (let i = 0; i < 6000; i++) advance(B, .1, 'wallpaper');
  assert.deepEqual(serialize(A, 1), serialize(B, 1));
  assert.ok(A.worlds[0].S.time > 599.9);
});

test('catch-up is capped at 12 hours and never runs backwards', () => {
  // Driven as main.js does: a clock booted from the save's time, then frames until it is current.
  const g = newGame(3), now = 1000 + 48 * 3600 * 1000, t0 = g.worlds[0].S.time;
  const c = startClock(now, 1000);
  assert.equal(c.behind, 43200);
  let ms = now; while (c.behind > 0) frame(g, c, ms += 100, 'wallpaper');
  assert.ok(Math.abs(g.worlds[0].S.time - t0 - 43200 - (ms - now) / 1000) < 1e-3);
  assert.equal(clockSavedAt(c), ms);
  const back = startClock(now, now + 5000), t1 = g.worlds[0].S.time;
  assert.equal(back.behind, 0);
  frame(g, back, now, 'wallpaper');
  assert.equal(g.worlds[0].S.time, t1);
});

test('4x only counts in play mode', () => {
  const g = newGame(3); g.ui.speed = 4;
  advance(g, 10, 'play');
  assert.ok(Math.abs(g.worlds[0].S.time - 40) < 1e-6);
  advance(g, 10, 'wallpaper');
  assert.ok(Math.abs(g.worlds[0].S.time - 50) < 1e-6);
});

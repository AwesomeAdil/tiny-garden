// Developer mode's sim helpers (web/js/sim/dev.js): each one does what its button says, through the real paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { isl } from '../web/js/sim/world.js';
import { SPOTS } from '../web/js/sim/picks.js';
import { openSpots } from '../web/js/sim/grow.js';
import { cost } from '../web/js/sim/flow.js';
import { EVENTS, TRAY_MAX } from '../web/js/sim/events.js';
import { TOWN_COST, CABLE_COST } from '../web/js/sim/town.js';
import { devGrow, devFill, devEvent, devGift, devTown, devCable, skip } from '../web/js/sim/dev.js';
import { sim } from './helpers.js';

const W0 = g => g.worlds[0];
const first = w => isl(w)[0];

test('devFill pays the current stage cost, so the next step grows it naturally', () => {
  const g = newGame(3), w = W0(g), n = first(w), c = cost(w, n);
  assert.equal(devFill(w, n), true);
  for (const k of Object.keys(c)) assert.equal(n.paid[k], c[k], k);
  assert.equal(n.stage, 1, 'not grown yet');
  sim(g, .1);
  assert.equal(n.stage, 2, 'the next step grew it');
});

test('devFill refuses an island at stage 4 and the town', () => {
  const g = newGame(3), w = W0(g), n = first(w); n.stage = 4;
  assert.equal(devFill(w, n), false);
  assert.equal(devFill(w, w.hub), false);
});

test('devGrow raises the stage by 1 through grow(): its spots open and its message shows', () => {
  const g = newGame(3), w = W0(g), n = first(w);
  assert.equal(openSpots(n).length, 0);
  assert.equal(devGrow(w, n), true);
  assert.equal(n.stage, 2);
  assert.deepEqual(openSpots(n).map(s => s.i), SPOTS.filter(s => s.i < 4 && s.opensAt <= 2).map(s => s.i));
  assert.ok(Object.values(n.paid).every(v => v === 0), 'paid resets like a real grow');
  assert.match(w.events.at(-1).msg, /grew to stage 2\./);
  assert.equal(devGrow(w, n), true); assert.equal(n.stage, 3);
  assert.deepEqual(openSpots(n).map(s => s.i), [0, 1, 2], 'stage 3 opens the pier spots');
  assert.equal(devGrow(w, n), true); assert.equal(n.stage, 4);
  assert.equal(devGrow(w, n), false, 'stage 4 is the top'); assert.equal(n.stage, 4);
});

test('devGrow only grows the island asked for', () => {
  const g = newGame(3), w = W0(g), [a, b] = isl(w);
  devGrow(w, a);
  assert.equal(b.stage, 1);
});

test('devEvent starts that visitor now, which leaves its gift when it ends', () => {
  for (const kind of Object.keys(EVENTS)) {
    const g = newGame(5), t = W0(g).S.time;
    assert.equal(devEvent(g, kind), true, kind);
    assert.deepEqual({ kind: g.ev.active.kind, t0: g.ev.active.t0, dur: g.ev.active.dur, world: g.ev.active.world }, { kind, t0: t, dur: EVENTS[kind].dur, world: 0 });
    assert.ok(g.ev.active.variant >= 0 && g.ev.active.variant < 6);
    assert.equal(devEvent(g, kind), false, 'one visitor at a time');
    sim(g, EVENTS[kind].dur + .2);
    assert.equal(g.ev.active, null);
    assert.equal(g.gifts.length, 1); assert.equal(g.gifts[0].kind, EVENTS[kind].gift);
  }
});

test('devEvent refuses an unknown kind; with the tray full the gift is lost, never over the cap', () => {
  const g = newGame(5);
  assert.equal(devEvent(g, 'comet'), false);
  for (let i = 0; i < TRAY_MAX; i++) assert.equal(devGift(g), true);
  assert.equal(devEvent(g, 'whale'), true);
  sim(g, EVENTS.whale.dur + .2);
  assert.equal(g.gifts.length, TRAY_MAX);
});

test('devGift adds one random gift to the tray, up to the cap', () => {
  const g = newGame(5);
  assert.equal(devGift(g), true);
  assert.equal(g.gifts.length, 1);
  assert.ok(['coral', 'hut', 'banner'].includes(g.gifts[0].kind));
  devGift(g); devGift(g);
  assert.equal(g.gifts.length, TRAY_MAX);
  assert.equal(devGift(g), false, 'the tray is full');
  assert.equal(g.gifts.length, TRAY_MAX);
  assert.equal(new Set(g.gifts.map(x => x.id)).size, TRAY_MAX, 'each gift has its own id');
});

test('devTown takes the town up one stage through growTown, and stops at 4', () => {
  const g = newGame(3), w = W0(g);
  assert.equal(devTown(g, w), true);
  assert.equal(w.hub.stage, 2);
  assert.match(w.events.at(-1).msg, /town grows/);
  assert.ok(Object.values(w.hub.paid).every(v => v === 0));
  devTown(g, w); devTown(g, w);
  assert.equal(w.hub.stage, 4);
  assert.equal(devTown(g, w), false);
  assert.equal(w.hub.stage, 4);
  assert.equal(TOWN_COST.length, 4);
});

test('devCable lifts islands to stage 3, pays the cable, starts CINDER and adds the cable', () => {
  const g = newGame(3), w = W0(g); first(w).stage = 4;
  assert.equal(devCable(g, w), true);
  assert.equal(w.S.cable, true);
  assert.equal(g.worlds[1].started, true);
  assert.deepEqual(g.cables, [{ a: 0, b: 1 }]);
  assert.ok(isl(w).every(n => n.stage >= 3));
  assert.equal(first(w).stage, 4, 'never lowers an island');
  assert.equal(w.hub.stage, 4);
  assert.match(w.events.at(-1).msg, /long cable reaches CINDER/);
  assert.equal(devCable(g, w), false, 'built once');
  assert.equal(g.cables.length, 1);
  assert.equal(devCable(g, g.worlds[1]), false, 'CINDER has no next world');
  assert.ok(CABLE_COST > 0);
});

test('skip works on a game already past it (Jump in a used sandbox)', () => {
  const g = newGame(4); first(W0(g)).stage = 4;
  skip(g);
  assert.equal(first(W0(g)).stage, 4, 'never lowers an island');
  assert.ok(isl(W0(g)).every(n => n.stage >= 3));
  assert.equal(g.worlds[1].started, true);
});

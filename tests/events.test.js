import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance } from '../web/js/sim/game.js';
import { stepEvents, endCatchup, placeGift, EVENTS, EVENT_MEAN, TRAY_MAX } from '../web/js/sim/events.js';
import { GIFTS, TRAVELLER_NAMES } from '../web/js/sim/picks.js';
import { node, isl, tie } from '../web/js/sim/world.js';
import { choose } from '../web/js/sim/grow.js';
import { walkSpeed, cost, step } from '../web/js/sim/flow.js';

const W0 = g => g.worlds[0];
const fire = g => { // force the next event and play it out
  W0(g).S.time = g.ev.nextAt;
  stepEvents(g, 0.1);
  while (g.ev.active) { W0(g).S.time += 10; stepEvents(g, 10) }
};

test('gift content', () => {
  assert.deepEqual(Object.keys(GIFTS).sort(), ['banner', 'coral', 'hut']);
  assert.ok(TRAVELLER_NAMES.length >= 12);
  assert.equal(EVENT_MEAN, 21600); assert.equal(TRAY_MAX, 3);
  assert.equal(EVENTS.whale.dur, 150);
});

test('events fire at about one per 6 hours', () => {
  const g = newGame(7); let count = 0, last = null;
  for (let t = 0; t < 600 * 3600; t += 10) {
    W0(g).S.time = t;
    stepEvents(g, 10);
    if (g.ev.active && g.ev.active !== last) { count++; last = g.ev.active }
    g.gifts.length = 0;
  }
  assert.ok(count > 85 && count < 115, `count ${count}`);
});

test('each event leaves a gift; the tray holds 3', () => {
  const g = newGame(3);
  for (let i = 0; i < 4; i++) fire(g);
  assert.equal(g.gifts.length, 3);
  assert.ok(g.gifts.every(x => GIFTS[x.kind] && Number.isInteger(x.variant) && x.variant >= 0 && x.variant < 6));
  assert.equal(new Set(g.gifts.map(x => x.id)).size, 3);
});

test('traveller gifts carry a name', () => {
  const g = newGame(11); let hut = null;
  for (let i = 0; i < 60 && !hut; i++) { fire(g); hut = g.gifts.find(x => x.kind === 'hut'); g.gifts.length = 0; if (hut) break }
  assert.ok(hut && TRAVELLER_NAMES.includes(hut.name));
});

test('catch-up fires at most one event', () => {
  const g = newGame(5);
  g.ev.nextAt = 100;
  advance(g, 12 * 3600, 'wallpaper', { catchup: true });
  assert.equal(g.gifts.length, 1);
  assert.equal(g.ev.active, null);
  assert.ok(g.ev.caught);
  assert.ok(g.ev.nextAt > W0(g).S.time);
  assert.match(g.ui.away, /while you were away\.$/);
  endCatchup(g);
  assert.equal(g.ev.caught, false);
  g.ev.nextAt = W0(g).S.time + 1;
  advance(g, 5, 'wallpaper');
  assert.ok(g.ev.active);
});

test('a game saved mid-event gives one gift when caught up, not two', () => {
  const g = newGame(5), w = W0(g);
  w.S.time = g.ev.nextAt;
  stepEvents(g, 0.1);
  assert.ok(g.ev.active);
  g.ev.nextAt = w.S.time + 10;
  advance(g, 12 * 3600, 'wallpaper', { catchup: true });
  endCatchup(g);
  assert.equal(g.gifts.length, 1);
  assert.equal(g.ev.active, null);
  assert.match(g.ui.away, /while you were away\.$/);
  advance(g, 600, 'wallpaper');
  assert.equal(g.gifts.length, 1, 'nothing left over resolves afterwards');
});

test('catch-up with caught already set only reschedules', () => {
  const g = newGame(5); g.ev.caught = true; g.ev.nextAt = 10;
  advance(g, 3600, 'wallpaper', { catchup: true });
  assert.equal(g.gifts.length, 0);
  assert.ok(g.ev.nextAt > W0(g).S.time);
});

test('gifts take an open spot; spot 4 is gift-only', () => {
  const g = newGame(2), w = W0(g), h = node(w, 'home');
  h.stage = 4;
  assert.equal(choose(w, h, 4, 'anything'), false);
  g.gifts.push({ id: 1, kind: 'coral', variant: 0 });
  assert.equal(placeGift(g, w, h, 0, 4), true);
  assert.equal(g.gifts.length, 0);
  assert.equal(h.spots[4].gift.kind, 'coral');
  assert.equal(h.gifts.length, 1);
  g.gifts.push({ id: 2, kind: 'banner', variant: 1 });
  assert.equal(placeGift(g, w, h, 0, 4), false); // used
  const low = isl(w).find(n => n.id !== 'home');
  low.stage = 1;
  assert.equal(placeGift(g, w, low, 0, 1), false); // not open
  assert.equal(placeGift(g, w, h, 5, 1), false); // no such gift
  assert.equal(g.gifts.length, 1);
});

const twoIslands = () => {
  const g = newGame(2), w = W0(g), [a, b] = isl(w);
  const r = tie(w, a, b);
  return { g, w, a, b, r };
};

test('coral speeds walkers by 15%', () => {
  const { w, a, b, r } = twoIslands();
  assert.equal(walkSpeed(w, r), 1);
  a.gifts.push({ id: 1, kind: 'coral', variant: 0 });
  assert.equal(walkSpeed(w, r), 1.15);
  b.gifts.push({ id: 2, kind: 'coral', variant: 1 });
  assert.equal(walkSpeed(w, r), 1.15);
});

test('hut speeds making by 10%', () => {
  const mk = hut => {
    const g = newGame(2), w = W0(g), n = isl(w)[0];
    if (hut) n.gifts.push({ id: 1, kind: 'hut', variant: 0, name: 'X' }, { id: 2, kind: 'hut', variant: 0, name: 'Y' });
    const other = isl(w)[1]; tie(w, n, other);
    n.out = { water: 0, light: 0, stone: 0 };
    return { w, n };
  };
  const a = mk(false), b = mk(true);
  step(a.w, 1); step(b.w, 1);
  const sum = o => Object.values(o).reduce((x, y) => x + y, 0);
  assert.ok(sum(a.n.out) > 0, 'island makes something');
  assert.ok(Math.abs(sum(b.n.out) / sum(a.n.out) - 1.1) < 1e-9);
});

test('banner cuts stage costs by 10%, rounded up, no stacking', () => {
  const g = newGame(2), w = W0(g), n = isl(w)[0];
  const base = cost(w, n);
  n.gifts.push({ id: 1, kind: 'banner', variant: 0 }, { id: 2, kind: 'banner', variant: 1 });
  const c = cost(w, n);
  for (const k of Object.keys(base)) assert.equal(c[k], base[k] > 0 ? Math.ceil(base[k] * .9) : 0);
});

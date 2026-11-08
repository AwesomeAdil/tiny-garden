import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance } from '../web/js/sim/game.js';
import { serialize, deserialize, isV1, SAVE_VERSION } from '../web/js/sim/save.js';
import { skip, autoNet, autoPick } from '../web/js/sim/dev.js';
import { WORLD_DEFS } from '../web/js/sim/content.js';
import { isl, node } from '../web/js/sim/world.js';
import { placeGift } from '../web/js/sim/events.js';
import { rename } from '../web/js/sim/grow.js';
import { catchUp } from '../web/js/sim/game.js';
import { allPairs } from '../web/js/sim/graph.js';

const trip = o => JSON.parse(JSON.stringify(o));

// A game with picks, one gift placed, one in the tray, a renamed island and a one-way rope.
const mk = () => {
  const g = newGame(5), w = g.worlds[0];
  autoNet(w);
  isl(w).forEach(n => { n.stage = 4 });
  autoPick(w);
  w.S.ropes[0].way = 1;
  const home = node(w, 'home');
  rename(home, 'MOSSY');
  g.gifts.push({ id: 1, kind: 'coral', variant: 2 }, { id: 2, kind: 'hut', variant: 1, name: 'MIRA' });
  placeGift(g, w, home, 0, 4);
  advance(g, 90, 'wallpaper');
  g.ev.active = { kind: 'whale', t0: w.S.time, dur: 150, world: 0, variant: 3 };
  return g;
};

test('round trip keeps stages, spots, picks, gifts, names, ways, events and town', () => {
  const g = mk(), o = trip(serialize(g, 42)), back = deserialize(o);
  assert.ok(back);
  assert.equal(o.v, SAVE_VERSION); assert.equal(SAVE_VERSION, 2);
  assert.equal(o.savedAt, 42); assert.equal(back.savedAt, 42);
  assert.deepEqual(serialize(back, 42), serialize(g, 42));
  const w = back.worlds[0], home = node(w, 'home');
  assert.equal(home.name, 'MOSSY');
  assert.equal(w.S.ropes[0].way, 1);
  assert.equal(home.spots[4].gift.kind, 'coral');
  assert.equal(home.gifts.length, 1);
  assert.deepEqual(back.gifts, [{ id: 2, kind: 'hut', variant: 1, name: 'MIRA' }]);
  assert.deepEqual(back.ev, g.ev);
  assert.ok(Object.keys(home.spots).length >= 2);
  assert.equal(w.hub, w.S.nodes.find(n => n.kind === 'planet'));
  assert.equal(w.def, WORLD_DEFS[0]);
  assert.deepEqual(w.HOP, g.worlds[0].HOP);
  assert.deepEqual(w.events, []);
  for (const k of ['POS', 'TANG', 'found']) assert.ok(!(k in o.worlds[0]) && !(k in o.worlds[0].S));
});

test('town and cable survive a round trip', () => {
  const g = skip(newGame(5)), back = deserialize(trip(serialize(g, 1)));
  assert.deepEqual(back.cables, g.cables);
  assert.equal(back.worlds[0].S.cable, true);
  assert.deepEqual(serialize(back, 1), serialize(g, 1));
});

test('a loaded game keeps playing the same as the original', () => {
  const g = mk(), back = deserialize(trip(serialize(g, 1)));
  advance(g, 120, 'wallpaper'); advance(back, 120, 'wallpaper');
  assert.deepEqual(serialize(back, 1), serialize(g, 1));
});

test('a v1 save is recognised, not loaded', () => {
  assert.equal(isV1({ v: 1 }), true);
  assert.equal(isV1({ v: 2 }), false);
  assert.equal(isV1(null), false);
  assert.equal(deserialize({ v: 1, seed: 1, worlds: [], cables: [], ui: {} }), null);
});

test('garbage returns null', () => {
  const ok = trip(serialize(mk(), 1));
  const bad = [null, undefined, {}, { v: 2 }, 'x', 5, [], { v: 2, worlds: [] },
    { ...ok, worlds: [{ ...ok.worlds[0], key: 'nope' }, ok.worlds[1]] },
    { ...ok, worlds: [{ key: 'ocean' }, { key: 'lava' }] },
    { ...ok, worlds: [{ ...ok.worlds[0], S: { ...ok.worlds[0].S, nodes: [] } }, ok.worlds[1]] },
    { ...ok, gifts: 'x' }, { ...ok, ev: null }];
  for (const b of bad) assert.equal(deserialize(b), null);
});

test('a cable that points outside the worlds is refused', () => {
  const o = trip(serialize(mk(), 1));
  for (const cb of [{ a: 0, b: 9 }, { a: -1, b: 1 }, { a: 0, b: 1.5 }, { a: 'x', b: 1 }, null])
    assert.equal(deserialize({ ...o, cables: [cb] }), null, JSON.stringify(cb));
  assert.ok(deserialize({ ...o, cables: [{ a: 0, b: 1 }] }));
});

test('a retired island is pruned with its ropes and its spots', () => {
  const g = mk(), o = trip(serialize(g, 1)), S = o.worlds[0].S;
  const gone = S.nodes.find(n => n.kind === 'island' && n.id !== 'home' && S.ropes.some(r => r.a === n.id || r.b === n.id));
  const before = S.ropes.length, touching = S.ropes.filter(r => r.a === gone.id || r.b === gone.id).length;
  S.ropes.forEach(r => { if (r.a === gone.id) r.a = 'retired'; if (r.b === gone.id) r.b = 'retired' });
  gone.id = 'retired';
  S.sel = { t: 'node', id: 'retired' };
  S.ropes.push({ id: 999, a: 'planet', b: 'nowhere', way: 0, u: 0, dir: 0, load: [], next: 0 });
  const home = S.nodes.find(n => n.id === 'home');
  home.spots[9] = { pick: 'x' }; home.spots.bogus = { gift: { id: 5, kind: 'coral', variant: 0 } };
  home.spots[1] = null;
  home.gifts.push({ id: 77, kind: 'nothing', variant: 0 });
  const back = deserialize(o);
  assert.ok(back);
  const w = back.worlds[0];
  assert.ok(!w.S.nodes.some(n => n.id === 'retired'));
  assert.ok(!w.S.ropes.some(r => r.a === 'retired' || r.b === 'retired' || r.b === 'nowhere'));
  assert.equal(w.S.ropes.length, before - touching);
  assert.deepEqual(w.S.sel, { t: 'node', id: 'planet' });
  const h = node(w, 'home');
  assert.deepEqual(Object.keys(h.spots).filter(k => !['0', '1', '2', '3', '4'].includes(k)), []);
  assert.ok(!h.spots[1]);
  assert.ok(!h.gifts.some(x => x.kind === 'nothing'));
  assert.equal(h.gifts.length, 1);
  advance(back, 60, 'wallpaper');
});

test('a selected rope that was dropped clears the selection', () => {
  const o = trip(serialize(mk(), 1)), S = o.worlds[0].S;
  S.ropes.push({ id: 998, a: 'planet', b: 'nowhere', way: 0, u: 0, dir: 0, load: [], next: 0 });
  S.sel = { t: 'rope', id: 998 };
  assert.deepEqual(deserialize(o).worlds[0].S.sel, { t: 'node', id: 'planet' });
});

test('tray gifts of an unknown kind are dropped', () => {
  const o = trip(serialize(mk(), 1));
  o.gifts.push({ id: 50, kind: 'bogus', variant: 0 });
  assert.deepEqual(deserialize(o).gifts, [{ id: 2, kind: 'hut', variant: 1, name: 'MIRA' }]);
});

test('worlds match by key, so a def can be inserted anywhere; cables and ui.world follow', () => {
  const g = skip(newGame(5)); g.ui.world = 1;
  const o = trip(serialize(g, 1)), [ocean, lava] = WORLD_DEFS;
  assert.deepEqual(o.cables.map(c => [c.a, c.b]), [[0, 1]]);
  const mid = { ...lava, key: 'mid', seedOffset: 3, next: null }, back = deserialize(o, [ocean, mid, lava]);
  assert.deepEqual(back.worlds.map(w => w.def.key), ['ocean', 'mid', 'lava']);
  assert.equal(back.worlds[1].started, false);
  assert.deepEqual(serialize(back, 1).worlds[2], o.worlds[1]);
  assert.deepEqual(back.cables.map(c => [c.a, c.b]), [[0, 2]]);
  assert.equal(back.ui.world, 2);
  advance(back, 30, 'wallpaper');
});

test('HOP is derived after loading', () => {
  const g = mk(), back = deserialize(trip(serialize(g, 1))), w = back.worlds[0];
  const hop = JSON.stringify(w.HOP); w.HOP = {}; allPairs(w);
  assert.equal(JSON.stringify(w.HOP), hop);
});

test('names default on for a save without the flag', () => {
  const o = trip(serialize(newGame(3), 1)); delete o.ui.names;
  assert.equal(deserialize(o).ui.names, true);
});

test('a bad active event is dropped and the game survives catch-up; bad ev numbers are refused', () => {
  const o = trip(serialize(mk(), 1));
  o.ev.active = { kind: 'nope', t0: 0, dur: 5, world: 0, variant: 0 };
  const back = deserialize(o);
  assert.ok(back);
  assert.equal(back.ev.active, null);
  back.savedAt = 0;
  catchUp(back, 3600 * 1000);
  for (const k of ['rs', 'nextAt', 'nextGift']) {
    const b = trip(serialize(mk(), 1)); b.ev[k] = 'x';
    assert.equal(deserialize(b), null, k);
  }
  const c = trip(serialize(mk(), 1)); c.ev.caught = 1; delete c.ev.active;
  assert.equal(deserialize(c).ev.caught, true);
  assert.equal(deserialize(c).ev.active, null);
});

test('island bands survive a save round-trip', async () => {
  const { newGame } = await import('../web/js/sim/game.js');
  const { serialize, deserialize } = await import('../web/js/sim/save.js');
  const g = newGame(4), back = deserialize(JSON.parse(JSON.stringify(serialize(g, 0))));
  const bands = w => w.S.nodes.filter(n => n.kind === 'island').map(n => n.band);
  assert.deepEqual(bands(back.worlds[0]), bands(g.worlds[0]));
  assert.ok(bands(g.worlds[0]).every(b => ['far', 'mid', 'near'].includes(b)));
});

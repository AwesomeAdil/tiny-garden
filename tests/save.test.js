import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance } from '../web/js/sim/game.js';
import { serialize, deserialize, migrate, SAVE_VERSION } from '../web/js/sim/save.js';
import { buy, launch } from '../web/js/sim/shop.js';
import { skip } from '../web/js/sim/dev.js';
import { WORLD_DEFS } from '../web/js/sim/content.js';
import { autoNet, sim } from './helpers.js';

const mk = () => {
  const g = newGame(5); const w = g.worlds[0];
  autoNet(w);
  w.hub.stock.rock = 60;
  const isle = w.S.nodes.find(n => n.kind === 'island' && w.S.ropes.some(r => r.b === n.id || r.a === n.id));
  buy(g, w, 'dock', isle.id); buy(g, w, 'fast', w.S.ropes[0].id);
  sim(g, 300);
  return g;
};
const trip = o => JSON.parse(JSON.stringify(o));

test('a save loads back exactly', () => {
  const g = mk(), back = deserialize(trip(serialize(g, 1)));
  assert.ok(back);
  assert.deepEqual(serialize(back, 1), serialize(g, 1));
  assert.equal(serialize(g, 7).v, SAVE_VERSION);
  assert.equal(serialize(g, 7).savedAt, 7);
  assert.equal(back.savedAt, 1);
});

test('a loaded game rebuilds references and derived state', () => {
  const g = mk(), back = deserialize(trip(serialize(g, 1)));
  back.worlds.forEach((w, i) => {
    assert.equal(w.def, WORLD_DEFS[i]);
    assert.ok(w.S.found instanceof Set);
    assert.ok(w.TANG instanceof Set);
    assert.equal(w.hub, w.S.nodes.find(n => n.kind === 'planet'));
    assert.deepEqual(w.events, []);
  });
  assert.deepEqual(back.worlds[0].HOP, g.worlds[0].HOP);
});

test('a loaded game keeps playing the same as the original', () => {
  const g = mk(), back = deserialize(trip(serialize(g, 1)));
  advance(g, 120, 'wallpaper'); advance(back, 120, 'wallpaper');
  assert.deepEqual(serialize(back, 1), serialize(g, 1));
});

test('garbage, wrong version and empty saves are refused', () => {
  const ok = trip(serialize(mk(), 1));
  const bad = [null, undefined, {}, { v: 2 }, 'x', 5, [], { v: 1, worlds: [] },
    { ...ok, worlds: [{ ...ok.worlds[0], key: 'nope' }, ok.worlds[1]] },
    { ...ok, worlds: [{ key: 'ocean' }, { key: 'lava' }] },
    { ...ok, worlds: [{ ...ok.worlds[0], S: { ...ok.worlds[0].S, nodes: [] } }, ok.worlds[1]] }];
  for (const b of bad) assert.equal(deserialize(b), null);
});

test('migrate is identity at v1 and defs can be supplied', () => {
  const o = trip(serialize(mk(), 1));
  assert.deepEqual(migrate(o), o);
});

test('worlds added to content later are appended fresh; mismatches are refused', () => {
  const g = mk(), o = trip(serialize(g, 1));
  const extra = { ...WORLD_DEFS[1], key: 'test', seedOffset: 3, next: null };
  const back = deserialize(o, [...WORLD_DEFS, extra]);
  assert.equal(back.worlds.length, 3);
  assert.equal(back.worlds[2].started, false);
  assert.equal(back.worlds[2].def, extra);
  assert.ok(back.worlds[2].S.ropes.some(r => r.a === 'planet' && r.b === extra.start));
  const a = serialize(back, 1), b = serialize(g, 1);
  assert.deepEqual(a.worlds.slice(0, 2), b.worlds);
  assert.deepEqual(a.cables, b.cables);
  assert.equal(deserialize(o, WORLD_DEFS.slice(0, 1)), null, 'a saved world the content no longer has');
  assert.equal(deserialize({ ...o, worlds: [o.worlds[0], o.worlds[0]] }), null, 'the same world twice');
});

test('names are on by default, survive a round trip, and old saves get the default', () => {
  const g = newGame(3);
  assert.equal(g.ui.names, true);
  g.ui.names = false;
  assert.equal(deserialize(trip(serialize(g, 1))).ui.names, false);
  const old = trip(serialize(newGame(3), 1)); delete old.ui.names;
  assert.equal(deserialize(old).ui.names, true);
  assert.deepEqual(migrate(old), old, 'no new save version: migrate stays identity');
});

test('a cable that points outside the worlds is refused', () => {
  const o = trip(serialize(mk(), 1));
  for (const cb of [{ a: 0, b: 9 }, { a: -1, b: 1 }, { a: 0, b: 1.5 }, { a: 'x', b: 1 }, null])
    assert.equal(deserialize({ ...o, cables: [cb && { u: 0, dir: 0, load: [], blocked: false, ...cb }] }), null, JSON.stringify(cb));
  assert.ok(deserialize({ ...o, cables: [{ a: 0, b: 1, u: 0, dir: 0, load: [], blocked: false }] }));
});

test('islands the content no longer has are dropped with their ropes, and the game keeps running', () => {
  const g = mk(), o = trip(serialize(g, 1)), S = o.worlds[0].S;
  const gone = S.nodes.find(n => n.kind === 'island' && S.ropes.some(r => r.a === n.id || r.b === n.id));
  const before = S.ropes.length, touching = S.ropes.filter(r => r.a === gone.id || r.b === gone.id).length;
  // As if a content update retired this island: its id is no longer in def.isl.
  S.ropes.forEach(r => { if (r.a === gone.id) r.a = 'retired'; if (r.b === gone.id) r.b = 'retired' });
  gone.id = 'retired';
  S.found.push('retired'); S.sel = { t: 'node', id: 'retired' };
  S.ropes.push({ id: 999, a: 'planet', b: 'nowhere', len: 50, u: 0, dir: 0, load: [], next: 0 });
  const back = deserialize(o);
  assert.ok(back);
  const w = back.worlds[0];
  assert.ok(!w.S.nodes.some(n => n.id === 'retired'));
  assert.ok(!w.S.ropes.some(r => r.a === 'retired' || r.b === 'retired' || r.b === 'nowhere'));
  assert.equal(w.S.ropes.length, before - touching);
  assert.ok(!w.S.found.has('retired'));
  assert.deepEqual(w.S.sel, { t: 'node', id: 'planet' });
  advance(back, 60, 'wallpaper');
});

test('a selected rope that was dropped clears the selection', () => {
  const o = trip(serialize(mk(), 1)), S = o.worlds[0].S;
  S.ropes.push({ id: 998, a: 'planet', b: 'nowhere', len: 50, u: 0, dir: 0, load: [], next: 0 });
  S.sel = { t: 'rope', id: 998 };
  assert.deepEqual(deserialize(o).worlds[0].S.sel, { t: 'node', id: 'planet' });
});

test('worlds match by key, so a def can be inserted anywhere; cables and ui.world follow', () => {
  const g = skip(newGame(5)); g.ui.world = 1;
  const o = trip(serialize(g, 1)), [ocean, lava] = WORLD_DEFS;
  assert.deepEqual(o.cables.map(c => [c.a, c.b]), [[0, 1]]);
  const mid = { ...lava, key: 'mid', seedOffset: 3, next: null }, back = deserialize(o, [ocean, mid, lava]);
  assert.ok(back);
  assert.deepEqual(back.worlds.map(w => w.def.key), ['ocean', 'mid', 'lava']);
  assert.equal(back.worlds[1].started, false);
  assert.deepEqual(serialize(back, 1).worlds[2], o.worlds[1], 'lava kept its state at its new position');
  assert.deepEqual(back.cables.map(c => [c.a, c.b]), [[0, 2]]);
  assert.equal(back.ui.world, 2);
  advance(back, 30, 'wallpaper');
  // and a save whose worlds are stored in another order loads the same
  const swapped = deserialize({ ...o, worlds: [o.worlds[1], o.worlds[0]], cables: o.cables.map(c => ({ ...c, a: c.b, b: c.a })), ui: { ...o.ui, world: 0 } });
  assert.deepEqual(serialize(swapped, 1), serialize(deserialize(o), 1));
});

test("a cable bought before the next world shipped reaches it once it does", () => {
  const g = skip(newGame(5)), lavaW = g.worlds[1];
  launch(g, lavaW); // v1: CINDER's cable, 'the next planet comes later'
  assert.equal(lavaW.S.cable, true);
  const o = trip(serialize(g, 1)), [ocean, lava] = WORLD_DEFS;
  const rime = { ...lava, key: 'rime', seedOffset: 11, next: null }, lava2 = { ...lava, next: 'rime' };
  const back = deserialize(o, [ocean, lava2, rime]);
  assert.equal(back.worlds[2].started, true, 'RIME started');
  assert.deepEqual(back.cables.map(c => [c.a, c.b]), [[0, 1], [1, 2]]);
  advance(back, 30, 'wallpaper');
  // loading that again doesn't add a second cable
  assert.equal(deserialize(trip(serialize(back, 1)), [ocean, lava2, rime]).cables.length, 2);
  // without a cable bought, nothing starts
  const o2 = trip(serialize(skip(newGame(5)), 1));
  assert.equal(deserialize(o2, [ocean, lava2, rime]).worlds[2].started, false);
});

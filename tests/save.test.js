import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance } from '../web/js/sim/game.js';
import { serialize, deserialize, migrate, SAVE_VERSION } from '../web/js/sim/save.js';
import { buy } from '../web/js/sim/shop.js';
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
    { ...ok, worlds: [ok.worlds[1], ok.worlds[0]] },
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
  assert.equal(deserialize({ ...o, worlds: [o.worlds[1], o.worlds[0]] }, [...WORLD_DEFS, extra]), null);
  assert.equal(deserialize(o, WORLD_DEFS.slice(0, 1)), null);
});

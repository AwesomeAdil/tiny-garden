import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, node, isl, tie, untie, makes } from '../web/js/sim/world.js';
import { DEF_OCEAN, DEF_LAVA } from '../web/js/sim/content.js';
import { GOODS } from '../web/js/core/palette.js';
import { cost } from '../web/js/sim/flow.js';
import { grow, spotKind, offers, choose, rename } from '../web/js/sim/grow.js';
import { SPOTS, PIER_PICKS, MID_PICKS } from '../web/js/sim/picks.js';

const bare = seed => {
  const w = makeWorld(DEF_OCEAN, seed);
  isl(w).forEach((n, i) => { n.x = 40 + i * 20; n.y = 20 });
  return w;
};
const at = (w, id, x, y) => { const n = node(w, id); n.x = x; n.y = y; return n };
const pay = (w, n) => { const c = cost(w, n); GOODS.forEach(k => { n.paid[k] = c[k] }) };

test('paying a stage grows it and opens its spots', () => {
  const w = bare(3), h = node(w, 'home');
  pay(w, h); grow(w);
  assert.equal(h.stage, 2);
  assert.ok(h.paid.water === 0 && h.paid.light === 0);
  const n = offers(w, h, 1).length;
  assert.ok(n >= 2 && n <= 3);
  assert.ok(w.events.some(e => /HOME grew to stage 2/.test(e.msg)));
});

test('a long catch-up grows one stage per step and opens every stage\'s spots', () => {
  const w = bare(3), h = node(w, 'home');
  for (let i = 0; i < 3; i++) { GOODS.forEach(k => { h.paid[k] = 1e6 }); grow(w); assert.equal(h.stage, i + 2) }
  GOODS.forEach(k => { h.paid[k] = 1e6 }); grow(w);
  assert.equal(h.stage, 4, 'stage 4 never grows');
  for (const s of SPOTS) assert.ok(h.stage >= s.opensAt, `spot ${s.i}`);
  for (const i of [0, 1, 2, 3]) assert.ok(offers(w, h, i).length >= 2, `offers ${i}`);
  assert.deepEqual(offers(w, h, 4), []);
  assert.equal(choose(w, h, 4, 'cottage'), false);
});

test('a spot that is not open yet refuses a pick', () => {
  const w = bare(3), h = node(w, 'home');
  assert.equal(choose(w, h, 1, offers(w, h, 1)[0].id), false);
});

test('pier spot offers picks for the arriving good', () => {
  const w = bare(3), h = at(w, 'home', 200, 150), f = at(w, 'frost', 300, 150);
  tie(w, h, f);
  h.stage = 3;
  assert.deepEqual(spotKind(w, h, 2), { kind: 'pier', good: 'water' });
  assert.deepEqual(spotKind(w, h, 0), { kind: 'mid' });
  assert.deepEqual(spotKind(w, h, 1), { kind: 'mid' });
  const o = offers(w, h, 2);
  assert.ok(o.length >= 2);
  for (const p of o) assert.ok(PIER_PICKS.water.some(q => q.id === p.id));
});

test('a one-way bridge against the arrow is not a pier spot', () => {
  const w = bare(3), h = at(w, 'home', 200, 150), f = at(w, 'frost', 300, 150);
  const r = tie(w, h, f); r.way = 1; // home -> frost only
  assert.deepEqual(spotKind(w, h, 2), { kind: 'mid' });
});

test('role-changing pick adds a sent good and drops it from costs', () => {
  const w = bare(3), h = at(w, 'home', 200, 150), f = at(w, 'frost', 300, 150);
  tie(w, h, f);
  h.stage = 2; h.paid.light = 2;
  assert.equal(cost(w, h).water, 60);
  h.stage = 3;
  assert.ok(offers(w, h, 2).some(p => p.id === 'waterfall'), 'seed lacks waterfall; pick another seed');
  assert.equal(choose(w, h, 2, 'waterfall'), true);
  assert.ok(makes(w, h).includes('water'));
  assert.equal(cost(w, h).water, 0);
  h.stage = 2;
  assert.equal(cost(w, h).water, 0);
  assert.equal(h.paid.light, 2);
});

test('at most one role-changing pick per island', () => {
  const w = bare(3), h = at(w, 'home', 200, 150);
  tie(w, h, at(w, 'frost', 300, 150));
  tie(w, h, at(w, 'amethyst', 100, 150));
  h.stage = 4;
  assert.equal(choose(w, h, 2, 'waterfall'), true);
  for (const i of [0, 1, 2, 3]) for (const p of offers(w, h, i)) assert.ok(!p.sends, `spot ${i} ${p.id}`);
});

test('picks are frozen when a bridge moves', () => {
  const w = bare(3), h = at(w, 'home', 200, 150), f = at(w, 'frost', 300, 150), a = at(w, 'amethyst', 100, 150);
  const r = tie(w, h, f);
  h.stage = 3;
  const pick = offers(w, h, 2)[0].id;
  assert.equal(choose(w, h, 2, pick), true);
  untie(w, r.id); tie(w, h, a);
  assert.equal(h.spots[2].pick, pick);
  assert.equal(choose(w, h, 2, pick), false);
  assert.deepEqual(spotKind(w, h, 0), { kind: 'pier', good: 'light' });
});

test('offers are deterministic for a seed', () => {
  const w = bare(3), h = node(w, 'home'); h.stage = 4;
  assert.deepEqual(offers(w, h, 1), offers(w, h, 1));
});

test('rename cleans and limits names', () => {
  const n = node(bare(3), 'frost');
  assert.equal(rename(n, '  frosty! '), true);
  assert.equal(n.name, 'FROSTY');
  assert.equal(rename(n, ''), false);
  assert.equal(rename(n, '!!!'), false);
  assert.equal(rename(n, 'ABCDEFGHIJK'), false);
  assert.equal(rename(n, 'ABCDEFGHIJ'), true);
  assert.equal(n.name, 'ABCDEFGHIJ');
});

test('every type has enough mid picks and a sends pick for each good', () => {
  for (const def of [DEF_OCEAN, DEF_LAVA]) for (const id of Object.keys(def.isl)) {
    assert.ok(MID_PICKS[id] && MID_PICKS[id].length >= 4, id);
    for (const p of MID_PICKS[id]) { assert.ok(p.id && p.name && p.prop, id); assert.ok(!p.sends) }
  }
  for (const k of GOODS) assert.ok(PIER_PICKS[k].some(p => p.sends === k), k);
});

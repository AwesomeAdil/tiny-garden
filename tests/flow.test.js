import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, node, isl, tie, piers } from '../web/js/sim/world.js';
import { DEF_OCEAN, STAGE_COST, OUTBOX } from '../web/js/sim/content.js';
import { GOODS } from '../web/js/core/palette.js';
import { step, stalls, cost, need } from '../web/js/sim/flow.js';
import { grow } from '../web/js/sim/grow.js';

// A world with no ropes, and every island parked off to the side so hand-placed ones sit where a test puts them.
const bare = seed => {
  const w = makeWorld(DEF_OCEAN, seed);
  isl(w).forEach((n, i) => { n.x = 40 + i * 20; n.y = 20 });
  return w;
};
const at = (w, id, x, y) => { const n = node(w, id); n.x = x; n.y = y; return n };
const run = (w, s, each) => { for (let t = 0; t < s - 1e-9; t += .1) { step(w, .1); if (each) each(w) } };
// +1 when a rope's walker moves toward `id`, -1 away, 0 resting.
const toward = (r, id) => r.dir === 0 ? 0 : (r.dir === 1) === (r.b === id) ? 1 : -1;

test('an island with no one in need makes nothing', () => {
  const w = bare(3);
  run(w, 600);
  for (const n of isl(w)) for (const k of GOODS) assert.equal(n.out[k], 0, `${n.id} ${k}`);
});

test('goods flow toward need', () => {
  const w = bare(3);
  tie(w, at(w, 'frost', 200, 150), at(w, 'home', 300, 150));
  run(w, 600);
  assert.ok(node(w, 'home').paid.water > 0);
});

test('chains take their share first', () => {
  const w = bare(3);
  const f = at(w, 'frost', 100, 150), e = at(w, 'ember', 200, 150), h = at(w, 'home', 300, 150);
  tie(w, f, e); tie(w, e, h);
  assert.ok(need(w, e, 'water') > 0 && need(w, h, 'water') > 0);
  let t = 0;
  for (; t < 3000 && h.paid.water === 0; t += .1) {
    step(w, .1);
    if (h.paid.water > 0) assert.ok(e.paid.water >= STAGE_COST[1], `HOME got water while EMBER had ${e.paid.water}`);
  }
  assert.ok(h.paid.water > 0, 'water never reached HOME');
  assert.equal(e.paid.water, STAGE_COST[1]);
});

test('one-way bridge never carries against its arrow', () => {
  const w = bare(3);
  const r = tie(w, at(w, 'frost', 200, 150), at(w, 'home', 300, 150));
  r.way = -1; // b->a only: HOME -> FROST
  let moved = false;
  run(w, 600, () => {
    for (const q of w.S.ropes) {
      if (q.dir !== 0) moved = true;
      if (toward(q, 'home') === 1) assert.ok(!q.load.some(x => x.k === 'water'), 'water carried toward HOME');
    }
  });
  assert.equal(node(w, 'home').paid.water, 0);
  assert.equal(node(w, 'frost').out.water, 0, 'FROST made water no one can reach');
  assert.ok(moved, 'the bridge should still carry stone HOME -> FROST');
  assert.ok(node(w, 'frost').paid.stone > 0);
});

test('satisfied islands pass goods through', () => {
  const w = bare(3);
  const f = at(w, 'frost', 100, 150), h = at(w, 'home', 200, 150), a = at(w, 'anvil', 300, 150);
  Object.assign(h.paid, cost(w, h));
  for (const k of GOODS) assert.equal(need(w, h, k), 0);
  tie(w, f, h); tie(w, h, a);
  run(w, 900);
  assert.ok(a.paid.water > 0, 'water never reached ANVIL');
  assert.equal(h.paid.water, STAGE_COST[1]);
});

test('stalls names an island that cannot get a good', () => {
  const w = bare(3);
  tie(w, at(w, 'frost', 200, 150), at(w, 'amethyst', 300, 150));
  const s = stalls(w);
  assert.ok(need(w, node(w, 'frost'), 'stone') > 0);
  assert.ok(s.some(x => x.id === 'frost' && x.k === 'stone'));
  assert.ok(!s.some(x => x.id === 'frost' && x.k === 'light'), 'AMETHYST can send light');
});

test('nothing is stored on islands beyond the outbox', () => {
  const w = bare(3);
  // two arms out of the town, three islands each, so no island uses more than its 2 piers
  const spots = { home: [220, 230], frost: [180, 140], ember: [280, 80], anvil: [420, 230], verdant: [460, 140], amethyst: [380, 80] };
  Object.entries(spots).forEach(([id, [x, y]]) => at(w, id, x, y));
  for (const arm of [['home', 'frost', 'ember'], ['anvil', 'verdant', 'amethyst']]) arm.forEach((id, i) => tie(w, i ? node(w, arm[i - 1]) : w.hub, node(w, id)));
  for (const n of w.S.nodes) assert.ok(w.S.ropes.filter(r => r.a === n.id || r.b === n.id).length <= piers(n));
  // the middle islands are fully grown, so they need nothing and everything passes through their relay
  node(w, 'frost').stage = 4; node(w, 'verdant').stage = 4;
  let moves = 0, relayed = false;
  run(w, 7200, () => {
    grow(w);
    for (const n of w.S.nodes) {
      if (n.out) for (const k of GOODS) assert.ok(n.out[k] <= OUTBOX, `${n.id} out ${k}=${n.out[k]}`);
      assert.ok(n.relay.length <= 3 * piers(n), `${n.id} relay ${n.relay.length}`);
      if (n.relay.length > 0) relayed = true;
    }
    if (w.S.ropes.some(r => r.dir !== 0)) moves++;
  });
  assert.ok(moves > 0);
  assert.ok(relayed, 'some relay queue should have been non-empty');
  assert.ok(isl(w).some(n => GOODS.some(k => n.paid[k] > 0)));
});

test('an island making two goods loads both in one batch', () => {
  const w = bare(3);
  const h = at(w, 'home', 200, 150), e = at(w, 'ember', 300, 150);
  h.sends = 'water'; h.satisfied.push('water');
  h.out.water = 2; h.out.stone = 2;
  const r = tie(w, h, e);
  step(w, .1);
  const ks = r.load.map(x => x.k);
  assert.ok(ks.includes('water') && ks.includes('stone'), `loaded ${ks}`);
});

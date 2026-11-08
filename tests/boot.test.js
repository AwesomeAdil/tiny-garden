import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { serialize, deserialize } from '../web/js/sim/save.js';
import { skip } from '../web/js/sim/dev.js';
import { trialLoad } from '../web/js/boot.js';

const trip = o => JSON.parse(JSON.stringify(o));

test('a good save loads, untouched by the trial run', () => {
  const o = trip(serialize(skip(newGame(7)), 1)), r = trialLoad(o);
  assert.ok(r && r.game);
  assert.deepEqual(serialize(r.game, 1), serialize(deserialize(o), 1));
});

test('a v1 save comes back as old, not bad', () => {
  assert.deepEqual(trialLoad({ v: 1, seed: 3, worlds: [], cables: [], ui: {} }), { old: true });
});

test('a save that deserializes but breaks the sim is refused', () => {
  const o = trip(serialize(newGame(7), 1));
  o.worlds[0].S.nodes[1].paid = null;
  assert.ok(deserialize(o), 'deserialize alone accepts it');
  assert.equal(trialLoad(o), null);
});

test('garbage is refused without throwing', () => {
  for (const x of [null, 'x', {}, { v: 2 }]) assert.equal(trialLoad(x), null);
});

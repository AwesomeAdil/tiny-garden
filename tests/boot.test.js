import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { serialize, deserialize } from '../web/js/sim/save.js';
import { skip } from '../web/js/sim/dev.js';
import { trialLoad } from '../web/js/boot.js';

const fakeCtx = () => ({ fillStyle: '', globalAlpha: 1, fillRect() {}, putImageData() {}, drawImage() {}, translate() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) });
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
globalThis.document ??= { createElement: () => ({ getContext: () => fakeCtx(), toDataURL: () => 'data:' }) };
const trip = o => JSON.parse(JSON.stringify(o));

test('a good save loads, untouched by the trial run', () => {
  const o = trip(serialize(skip(newGame(7)), 1)), g = trialLoad(o, fakeCtx);
  assert.ok(g);
  assert.deepEqual(serialize(g, 1), serialize(deserialize(o), 1));
});

test('a save that deserializes but breaks the sim is refused', () => {
  const o = trip(serialize(newGame(7), 1));
  o.worlds[0].S.nodes[1].stock = null;
  assert.ok(deserialize(o), 'deserialize alone accepts it');
  assert.equal(trialLoad(o, fakeCtx), null);
});

test('a save that breaks drawing is refused', () => {
  const o = trip(serialize(newGame(7), 1)), bad = () => ({ ...fakeCtx(), fillRect() { throw new Error('boom') } });
  assert.equal(trialLoad(o, bad), null);
});

test('garbage is refused without throwing', () => {
  for (const x of [null, 'x', {}, { v: 1 }]) assert.equal(trialLoad(x, fakeCtx), null);
});

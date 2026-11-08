import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const { newGame } = await import('../web/js/sim/game.js');
const { serialize, deserialize } = await import('../web/js/sim/save.js');
const { skip } = await import('../web/js/sim/dev.js');
const { trialLoad } = await import('../web/js/boot.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');

const trip = o => JSON.parse(JSON.stringify(o));
const makeCtx = () => new PixCtx(688, 288);

test('a good save loads, untouched by the trial run', () => {
  const o = trip(serialize(skip(newGame(7)), 1)), r = trialLoad(o, makeCtx);
  assert.ok(r && r.game);
  assert.deepEqual(serialize(r.game, 1), serialize(deserialize(o), 1));
});

test('the trial run draws a city frame of each started world', () => {
  const o = trip(serialize(skip(newGame(7)), 1)), made = [];
  assert.ok(trialLoad(o, () => { const c = makeCtx(); made.push(c); return c }).game);
  assert.equal(made.length, 2, 'both worlds are started after skip');
  for (const c of made) assert.ok(c.px.some(v => v !== c.px[0]), 'something was drawn');
});

test('a save that breaks the city draw is refused', () => {
  const o = trip(serialize(skip(newGame(7)), 1));
  assert.ok(trialLoad(o, () => { throw new Error('no canvas') }) === null);
});

test('a v1 save comes back as old, not bad', () => {
  assert.deepEqual(trialLoad({ v: 1, seed: 3, worlds: [], cables: [], ui: {} }, makeCtx), { old: true });
});

test('a save that deserializes but breaks the sim is refused', () => {
  const o = trip(serialize(newGame(7), 1));
  o.worlds[0].S.nodes[1].paid = null;
  assert.ok(deserialize(o), 'deserialize alone accepts it');
  assert.equal(trialLoad(o, makeCtx), null);
});

test('garbage is refused without throwing', () => {
  for (const x of [null, 'x', {}, { v: 2 }]) assert.equal(trialLoad(x, makeCtx), null);
});

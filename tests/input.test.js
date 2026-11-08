import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const fakeCtx = () => ({ fillStyle: '', globalAlpha: 1, fillRect() {}, putImageData() {}, drawImage() {}, translate() {}, clearRect() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) });
globalThis.document ??= { createElement: () => ({ getContext: () => fakeCtx(), toDataURL: () => 'data:,' }) };

const { newGame } = await import('../web/js/sim/game.js');
const { isl, node, tie } = await import('../web/js/sim/world.js');
const { worldView } = await import('../web/js/core/pixel.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { tryTie, tapRope, spotAt, ropeAt } = await import('../web/js/ui/input.js');
const { spotXY, drawCity, ropeSpans } = await import('../web/js/draw/city.js');

const view = (W, H) => ({ w: W, h: H, ...worldView(W, H) });
// A world whose islands we place by hand (positions are free to set; canTie reads only x, y and the ropes).
const placed = pos => {
  const game = newGame(3), w = game.worlds[0], ns = isl(w);
  pos.forEach(([x, y], i) => { ns[i].x = x; ns[i].y = y });
  ns.slice(pos.length).forEach((n, i) => { n.x = 20 + i * 4; n.y = 40 });
  return { game, w, ns };
};
const said = () => { const out = []; const tell = (m, warn) => out.push({ m, warn }); tell.out = out; return tell };

test('tryTie says why it refused', () => {
  // reach
  { const { w, ns } = placed([[60, 100], [600, 100]]), tell = said(), r = tryTie(w, ns[0], ns[1], tell);
    assert.deepEqual([r.ok, r.why], [false, 'reach']); assert.equal(tell.out[0].m, 'Too far for a bridge.'); assert.equal(w.S.ropes.length, 0) }
  // dup
  { const { w, ns } = placed([[100, 100], [200, 100]]), tell = said();
    assert.equal(tryTie(w, ns[0], ns[1], tell).ok, true); assert.equal(w.S.ropes.length, 1);
    const r = tryTie(w, ns[1], ns[0], tell); assert.deepEqual([r.ok, r.why], [false, 'dup']); assert.equal(tell.out.at(-1).m, 'Already tied.') }
  // piers: a stage-1 island has 2
  { const { w, ns } = placed([[200, 100], [120, 100], [280, 100], [200, 60]]), tell = said();
    assert.ok(tryTie(w, ns[0], ns[1], tell).ok); assert.ok(tryTie(w, ns[0], ns[2], tell).ok);
    const r = tryTie(w, ns[0], ns[3], tell); assert.deepEqual([r.ok, r.why], [false, 'piers']);
    assert.equal(tell.out.at(-1).m, `${w.def.isl[ns[0].id].name} has no free pier. It gets another when it grows.`); assert.equal(tell.out.at(-1).warn, true) }
  // cross
  { const { w, ns } = placed([[100, 60], [200, 140], [100, 140], [200, 60]]), tell = said();
    assert.ok(tryTie(w, ns[0], ns[1], tell).ok);
    const r = tryTie(w, ns[2], ns[3], tell); assert.deepEqual([r.ok, r.why], [false, 'cross']); assert.equal(tell.out.at(-1).m, "Bridges can't cross.") }
  // self says nothing
  { const { w, ns } = placed([[100, 100]]), tell = said(); assert.equal(tryTie(w, ns[0], ns[0], tell).why, 'self'); assert.equal(tell.out.length, 0) }
});

test('tapRope cycles both → a→b → b→a → both', () => {
  const { w, ns } = placed([[100, 100], [200, 100]]), r = tie(w, ns[0], ns[1]), tell = said();
  assert.equal(r.way, 0);
  tapRope(w, r, tell); assert.equal(r.way, 1);
  tapRope(w, r, tell); assert.equal(r.way, -1);
  tapRope(w, r, tell); assert.equal(r.way, 0);
  assert.equal(tell.out.length, 3);
  assert.match(tell.out[0].m, new RegExp(`${w.def.isl[ns[0].id].name} to ${w.def.isl[ns[1].id].name}`));
  assert.match(tell.out[1].m, new RegExp(`${w.def.isl[ns[1].id].name} to ${w.def.isl[ns[0].id].name}`));
});

test('spotAt hits an open spot within 4 px and misses a closed one', () => {
  const game = newGame(3), w = game.worlds[0], n = isl(w)[0], v = view(1146, 480), o = { view: v, t: 0, gifts: 0 };
  n.stage = 2; // spot 1 is open from stage 2; spots 0 and 2 from stage 3
  const [x, y] = spotXY(n, 1, v, 0);
  assert.equal(spotAt(w, n, { x, y }, o), 1);
  assert.equal(spotAt(w, n, { x: x + 4, y }, o), 1, 'within 4 px');
  assert.equal(spotAt(w, n, { x: x + 3, y: y - 2 }, o), 1);
  assert.equal(spotAt(w, n, { x: x + 9, y }, o), null, 'too far');
  const [x0, y0] = spotXY(n, 0, v, 0);
  assert.equal(spotAt(w, n, { x: x0, y: y0 }, o), null, 'spot 0 is closed at stage 2');
  n.spots[1] = { pick: 'cottage' };
  assert.equal(spotAt(w, n, { x, y }, o), null, 'a grown spot is closed');
  // spot 4 is gift-only: open at stage 4 only while a gift waits
  n.stage = 4; const [x4, y4] = spotXY(n, 4, v, 0);
  assert.equal(spotAt(w, n, { x: x4, y: y4 }, o), null);
  assert.equal(spotAt(w, n, { x: x4, y: y4 }, { ...o, gifts: 1 }), 4);
});

test('spotAt matches the glows drawCity puts on screen', () => {
  const game = newGame(3), w = game.worlds[0], v = view(1146, 480), t = 0;
  for (const n of isl(w)) n.stage = 3;
  const c = new PixCtx(v.w, v.h);
  drawCity(c, game, w, t, v, { drag: null, pointer: null, tool: 'move', armedGift: null, card: null });
  const at = (x, y) => { const i = (y * v.w + x) * 4; return '#' + [0, 1, 2].map(j => c.d[i + j].toString(16).padStart(2, '0')).join('') };
  let seen = 0;
  for (const n of isl(w)) for (const i of [0, 1, 2]) {
    const [x, y] = spotXY(n, i, v, t);
    assert.equal(at(x, y + 1), '#e0caf9', `${n.id} spot ${i} glows at its spot`);
    assert.equal(spotAt(w, n, { x, y: y + 1 }, { view: v, t, gifts: 0 }), i);
    seen++;
  }
  assert.ok(seen >= 15);
});

test('ropeAt finds a bridge along the span the city draws', () => {
  const game = newGame(3), w = game.worlds[0], v = view(1146, 480), ns = isl(w), hub = node(w, 'planet');
  const near = ns.slice().sort((a, b) => Math.hypot(a.x - hub.x, a.y - hub.y) - Math.hypot(b.x - hub.x, b.y - hub.y))[0];
  const r = tie(w, hub, near), pts = ropeSpans(w, v, 0).get(r.id);
  assert.ok(pts && pts.length > 4);
  const [mx, my] = pts[pts.length >> 1];
  assert.equal(ropeAt(w, { x: mx, y: my + 2 }, v, 0), r);
  assert.equal(ropeAt(w, { x: mx, y: my - 40 }, v, 0), null);
});

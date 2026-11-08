import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const fakeCtx = () => ({ fillStyle: '', globalAlpha: 1, fillRect() {}, putImageData() {}, drawImage() {}, translate() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) });
globalThis.document ??= { createElement: () => ({ getContext: () => fakeCtx(), toDataURL: () => 'data:' }) };

const { newGame } = await import('../web/js/sim/game.js');
const { skip } = await import('../web/js/sim/dev.js');
const { serialize, deserialize } = await import('../web/js/sim/save.js');
const { isl, node } = await import('../web/js/sim/world.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { worldView } = await import('../web/js/core/pixel.js');
const { drawCity, nodeAt, citySky } = await import('../web/js/draw/city.js');
const { drawEvent } = await import('../web/js/draw/events.js');
const { EVENTS } = await import('../web/js/sim/events.js');
const { drawGalaxy, galAt, GSYS } = await import('../web/js/draw/galaxy.js');

const view = (W, H) => ({ w: W, h: H, ...worldView(W, H) });
const trip = o => JSON.parse(JSON.stringify(o));

test('drawCity never writes to the game', () => {
  const game = skip(newGame(3)), before = JSON.stringify(serialize(game, 0));
  for (const w of game.worlds.filter(w => w.started)) {
    const c = new PixCtx(1146, 480), n = isl(w)[0];
    drawCity(c, game, w, 12, view(1146, 480), null);
    drawCity(c, game, w, 12.1, view(1146, 480), { drag: null, pointer: { x: n.x, y: n.y }, tool: 'move' });
    drawCity(c, game, w, 12.2, view(1146, 480), { drag: { kind: 'rope', id: n.id }, pointer: { x: 200, y: 60 }, tool: 'rope' });
    drawCity(c, game, w, 12.3, view(1146, 480), { drag: { kind: 'move', id: n.id, moved: true, ox: n.x - 20, oy: n.y }, pointer: null, tool: 'move' });
    drawCity(new PixCtx(640, 300), game, w, 12, view(640, 300), null);
  }
  assert.equal(JSON.stringify(serialize(game, 0)), before);
});

test('no goods are drawn on islands', () => {
  const save = trip(serialize(skip(newGame(3)), 0)), full = deserialize(trip(save)), empty = deserialize(trip(save));
  for (const g of [full, empty]) g.ev.active = null;
  for (const n of isl(full.worlds[0])) { n.out = { water: 6, light: 6, stone: 6 }; n.relay = [{ k: 'water', d: 'planet' }, { k: 'light', d: 'planet' }, { k: 'stone', d: 'planet' }] }
  for (const n of isl(empty.worlds[0])) { n.out = { water: 0, light: 0, stone: 0 }; n.relay = [] }
  const a = new PixCtx(1146, 480), b = new PixCtx(1146, 480);
  drawCity(a, full, full.worlds[0], 7, view(1146, 480), null);
  drawCity(b, empty, empty.worlds[0], 7, view(1146, 480), null);
  assert.ok(Buffer.from(a.d).equals(Buffer.from(b.d)), 'stock or relay changed the picture');
});

test('horizon spans the canvas', () => {
  const game = skip(newGame(3));
  for (const [W, H] of [[1146, 480], [756, 472], [640, 300]]) {
    const c = new PixCtx(W, H), w = game.worlds[0];
    drawCity(c, game, w, 3, view(W, H), null);
    const sky = citySky(game, w, W, H), y = H - 1;
    for (const x of [0, W - 1]) assert.notEqual(c.px[y * W + x], sky.px.px[y * W + x], `${W}x${H}: sky at (${x}, ${y})`);
    // and the sky shows above the horizon at both edges
    for (const x of [0, W - 1]) assert.equal(c.px[2 * W + x], sky.px.px[2 * W + x], `${W}x${H}: no sky at (${x}, 2)`);
  }
});

test('drawEvent draws for each kind, and nothing after it ends or during catch-up', () => {
  const game = skip(newGame(3)), W = 1146, H = 480, v = view(W, H), T = game.worlds[0].S.time;
  const base = new PixCtx(W, H), diff = c => { let n = 0; for (let i = 0; i < c.px.length; i++) if (c.px[i] !== base.px[i]) n++; return n };
  const run = (a, caught = false) => { game.ev.active = a; game.ev.caught = caught; const c = new PixCtx(W, H); drawEvent(c, game, v, 5); return diff(c) };
  for (const kind of Object.keys(EVENTS)) {
    const dur = EVENTS[kind].dur;
    for (const f of [.2, .5, .8]) assert.ok(run({ kind, t0: T - dur * f, dur, world: 0, variant: 2 }) >= 40, `${kind} at ${f}`);
    assert.equal(run({ kind, t0: T - dur - 1, dur, world: 0, variant: 2 }), 0, `${kind} after it ends`);
    assert.equal(run({ kind, t0: T + 5, dur, world: 0, variant: 2 }), 0, `${kind} before it starts`);
    assert.equal(run({ kind, t0: T - dur / 2, dur, world: 0, variant: 2 }, true), 0, `${kind} during catch-up`);
  }
  assert.equal(run(null), 0);
});

test('the active event shows in the city', () => {
  const game = skip(newGame(3)), W = 1146, H = 480, w = game.worlds[0], T = w.S.time;
  game.ev.active = null;
  const a = new PixCtx(W, H); drawCity(a, game, w, 5, view(W, H), null);
  game.ev.active = { kind: 'whale', t0: T - 75, dur: 150, world: 0, variant: 0 };
  const b = new PixCtx(W, H); drawCity(b, game, w, 5, view(W, H), null);
  assert.ok(!Buffer.from(a.d).equals(Buffer.from(b.d)));
});

test('nodeAt finds islands and the town in world units', () => {
  const game = skip(newGame(3)), w = game.worlds[0];
  for (const n of isl(w)) assert.equal(nodeAt(w, { x: n.x, y: n.y + 2 }), n, n.id);
  assert.equal(nodeAt(w, { x: w.hub.x, y: w.hub.y - 2 }), node(w, 'planet'));
  assert.equal(nodeAt(w, { x: -500, y: -500 }), null);
  // a canvas point with its view is mapped back by k first
  const v = view(1146, 480);
  for (const n of isl(w)) assert.equal(nodeAt(w, { x: v.ox + n.x * v.k, y: v.oy + (n.y + 2) * v.k }, v), n, n.id + ' (canvas)');
});

test('islands are drawn natively at the view scale', async () => {
  const { getSprite, STAGE_F } = await import('../web/js/draw/kit.js');
  const { ISLAND_HW } = await import('../web/js/sim/content.js');
  const game = skip(newGame(3)), w = game.worlds[0], v = view(1146, 480);
  for (const n of isl(w)) {
    const s1 = getSprite(w, n, n.band, 1), sk = getSprite(w, n, n.band, v.k);
    assert.equal(sk.hw, Math.round(ISLAND_HW[n.band] * STAGE_F[n.stage] * v.k));
    assert.ok(sk.w > s1.w && sk !== s1, 'a bigger sprite, built anew');
  }
});

test('the home system is clickable in the galaxy', () => {
  drawGalaxy(fakeCtx(), 0, null, 0, 688, 288);
  const g = GSYS[0], hit = [...Array(688 * 288).keys()].map(i => ({ x: i % 688, y: Math.floor(i / 688) })).find(p => galAt(p, 0) === g);
  assert.ok(hit, 'our system is clickable somewhere');
});

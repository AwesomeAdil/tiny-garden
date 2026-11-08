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

test('nodeAt hits the hub where it is drawn, at every canvas size', async () => {
  const { townLayout, hubSprite, HUB_HW } = await import('../web/js/draw/city.js');
  const game = skip(newGame(3)), w = game.worlds[0], hub = node(w, 'planet'), I = hubSprite();
  for (const [W, H] of [[1146, 480], [756, 472], [344, 144]]) {
    const v = view(W, H), T = townLayout(v, w.hub.stage), cx = T.H.cx, top = T.hubTop, mid = top + (I.depth >> 1);
    assert.equal(nodeAt(w, { x: cx, y: mid }, v), hub, `${W}x${H} centre`);
    assert.equal(nodeAt(w, { x: cx - HUB_HW + 2, y: top + 2 }, v), hub, `${W}x${H} left edge`);
    assert.equal(nodeAt(w, { x: cx + HUB_HW - 2, y: top + 2 }, v), hub, `${W}x${H} right edge`);
    assert.equal(nodeAt(w, { x: cx, y: top + Math.round(I.depth * .6) }, v), hub, `${W}x${H} low on the rock`);
    assert.notEqual(nodeAt(w, { x: cx - HUB_HW + 1, y: top + I.depth }, v), hub, `${W}x${H} below the rock's tapered corner`);
    assert.equal(nodeAt(w, { x: cx, y: top - 6 }, v), hub, `${W}x${H} the houses on top`);
    assert.notEqual(nodeAt(w, { x: cx + HUB_HW + 12, y: top + 2 }, v), hub, `${W}x${H} beside the rock`);
  }
});

test('islands are drawn natively at the view scale', async () => {
  const { getSprite, STAGE_F, bandOf } = await import('../web/js/draw/kit.js');
  const { ISLAND_HW } = await import('../web/js/sim/content.js');
  const game = skip(newGame(3)), w = game.worlds[0], v = view(1146, 480);
  for (const n of isl(w)) {
    const b = bandOf(n.y), s1 = getSprite(w, n, b, 1), sk = getSprite(w, n, b, v.k);
    assert.equal(sk.hw, Math.round(ISLAND_HW[b] * STAGE_F[n.stage] * v.k));
    assert.ok(sk.w > s1.w && sk !== s1, 'a bigger sprite, built anew');
  }
});

test('the home system is clickable in the galaxy', () => {
  drawGalaxy(fakeCtx(), 0, null, 0, 688, 288);
  const g = GSYS[0], hit = [...Array(688 * 288).keys()].map(i => ({ x: i % 688, y: Math.floor(i / 688) })).find(p => galAt(p, 0) === g);
  assert.ok(hit, 'our system is clickable somewhere');
});

test('a dragged island takes the band of its new y', async () => {
  const { bandFor } = await import('../web/js/draw/kit.js');
  const game = skip(newGame(3)), w = game.worlds[0], n = isl(w)[0];
  n.y = 60; assert.equal(bandFor(n), 'far');
  n.y = 120; assert.equal(bandFor(n), 'mid');
  n.y = 170; assert.equal(bandFor(n), 'near');
  n.band = 'far'; assert.equal(bandFor(n), 'near', 'a stray band field is ignored');
  drawCity(new PixCtx(1146, 480), game, w, 1, view(1146, 480), null);
});

test('close-ups draw on the kit and never write to the game or show goods', async () => {
  const { islandView, planetView } = await import('../web/js/draw/closeup.js');
  const game = skip(newGame(3)), w = game.worlds[0], before = JSON.stringify(serialize(game, 0)), n = isl(w)[0];
  const draw = (g, ww, nn) => { const a = new PixCtx(1146, 480), b = new PixCtx(344, 144); islandView(a, ww, nn, 3, 1146, 480); planetView(b, g, ww, 3, 344, 144); return a };
  const base = draw(game, w, n);
  assert.equal(JSON.stringify(serialize(game, 0)), before);
  const full = deserialize(trip(serialize(skip(newGame(3)), 0))); for (const m of isl(full.worlds[0])) { m.out = { water: 6, light: 6, stone: 6 }; m.stock = { water: 9, light: 9, stone: 9 } }
  assert.ok(Buffer.from(draw(full, full.worlds[0], isl(full.worlds[0])[0]).d).equals(Buffer.from(base.d)), 'stock changed the picture');
});

test('blitZoom makes exact z x z blocks and keeps alpha', () => {
  const src = new PixCtx(3, 2, { transparent: true }); src.fillStyle = '#ff0000'; src.fillRect(0, 0, 1, 1); src.fillStyle = '#00ff00'; src.fillRect(2, 1, 1, 1);
  const dst = new PixCtx(20, 20); dst.fillStyle = '#000000'; dst.fillRect(0, 0, 20, 20);
  for (const z of [2, 3, 4]) {
    dst.fillStyle = '#000000'; dst.fillRect(0, 0, 20, 20); dst.blitZoom(src, 5, 4, z);
    const RED = new PixCtx(1, 1); RED.fillStyle = '#ff0000'; RED.fillRect(0, 0, 1, 1); const GREEN = new PixCtx(1, 1); GREEN.fillStyle = '#00ff00'; GREEN.fillRect(0, 0, 1, 1);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const lx = x - 5, ly = y - 4, i = Math.floor(lx / z), j = Math.floor(ly / z);
      const want = lx >= 0 && ly >= 0 && i === 0 && j === 0 ? RED.px[0] : lx >= 0 && ly >= 0 && i === 2 && j === 1 ? GREEN.px[0] : 0xff000000;
      assert.equal(dst.px[y * 20 + x], want, `z${z} (${x},${y})`);
    }
  }
});

test('the island close-up is the city sprite zoomed whole', async () => {
  const { islandView, zoomFor } = await import('../web/js/draw/closeup.js');
  const { getSprite } = await import('../web/js/draw/kit.js');
  const game = skip(newGame(3)), w = game.worlds[0], n = isl(w)[0], W = 1146, H = 480, v = worldView(W, H), I = getSprite(w, n, 'near', v.k), z = zoomFor(I.w, I.h, W, H);
  assert.equal(z, [4, 3, 2].find(q => I.w * q <= W * .45 && I.h * q <= H * .8), 'the largest zoom that fits both ways');
  assert.ok(I.w * z <= W * .45 && I.h * z <= H * .8);
  // a small canvas: the zoomed sprite is whole on screen, not clipped
  for (const [cw, ch] of [[344, 144], [200, 120], [756, 472]]) { const k = worldView(cw, ch).k, S = getSprite(w, n, 'near', k), q = zoomFor(S.w, S.h, cw, ch); assert.ok(S.w * q <= cw && S.h * q <= ch, `${cw}x${ch} z${q}`) }
  const c = new PixCtx(W, H); islandView(c, w, n, 3, W, H);
  // the sprite's own opaque pixels show as z x z blocks of the same colour somewhere on the canvas
  let found = 0;
  for (let y = 0; y < I.h && found < 5; y += 3) for (let x = 0; x < I.w && found < 5; x += 3) {
    if (I.px.d[(y * I.w + x) * 4 + 3] !== 255) continue;
    const col = I.px.px[y * I.w + x];
    // scan for a z x z block of this colour (only blocks that are all one colour count)
    outer: for (let cy = 0; cy + z <= H; cy++) for (let cx = 0; cx + z <= W; cx++) {
      if (c.px[cy * W + cx] !== col) continue;
      for (let q = 0; q < z * z; q++) if (c.px[(cy + (q / z | 0)) * W + cx + q % z] !== col) continue outer;
      found++; break outer;
    }
  }
  assert.ok(found >= 3, `zoomed blocks found: ${found}`);
});

test('blitZoom clips at negative offsets and blends partial alpha', () => {
  const src = new PixCtx(2, 2, { transparent: true }); src.fillStyle = '#ff0000'; src.fillRect(0, 0, 2, 1); src.fillRect(0, 1, 1, 1);
  src.globalAlpha = .5; src.fillStyle = '#0000ff'; src.fillRect(1, 1, 1, 1); src.globalAlpha = 1;
  // src pixel (1,1) is now blue over transparent at alpha .5
  const dst = new PixCtx(8, 8); dst.fillStyle = '#000000'; dst.fillRect(0, 0, 8, 8);
  dst.blitZoom(src, -3, -3, 3); // red covers canvas (0..2,0..2) minus the clipped part; the zoomed pixel (1,1) spans (0..5)-3 ... see below
  const px = (x, y) => dst.px[y * 8 + x], RED = 0xff0000ff, BLACK = 0xff000000;
  // source pixel (0,0) spans -3..-1: fully off canvas. (1,0) spans 0..2 x -3..-1: off. (0,1) spans -3..-1 x 0..2: off. (1,1) spans 0..2 x 0..2.
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) assert.notEqual(px(x, y), BLACK, `blended block ${x},${y}`);
  assert.equal(px(0, 0), px(2, 2), 'one blended colour across the whole z x z block');
  assert.equal(px(3, 0), BLACK); assert.equal(px(0, 3), BLACK);
  // half-alpha blue over black: blue about 128, no red
  const c = px(1, 1); assert.ok(((c >> 16) & 255) >= 126 && ((c >> 16) & 255) <= 129 && (c & 255) === 0);
  // drawn at +2 the opaque red pixels are exact 3 x 3 blocks and the canvas edge clips the last block
  const d2 = new PixCtx(8, 8); d2.fillStyle = '#000000'; d2.fillRect(0, 0, 8, 8); d2.blitZoom(src, 2, 2, 3);
  assert.equal(d2.px[2 * 8 + 2], RED); assert.equal(d2.px[4 * 8 + 4], RED); assert.equal(d2.px[2 * 8 + 5], RED); assert.equal(d2.px[5 * 8 + 2], RED);
  assert.notEqual(d2.px[5 * 8 + 5], RED, 'the blended pixel is not opaque');
  assert.equal(d2.px[1 * 8 + 1], BLACK);
});

test('the hub is a rock on the crest: houses stand on it, nodeAt uses its shape, deeper islands are shallower per width', async () => {
  const { townLayout, hubSprite, HUB_HW, HUB_RISE } = await import('../web/js/draw/city.js');
  const { depthFor } = await import('../web/js/draw/kit.js');
  const v = view(1146, 480), T = townLayout(v, 4), I = hubSprite();
  assert.equal(T.hubTop, T.H.top - HUB_RISE);
  for (const h of T.houses) { assert.equal(h.y, T.hubTop + 1); assert.ok(Math.abs(h.x - T.H.cx) <= HUB_HW - 6, 'on the rock'); }
  assert.ok(I.hw === HUB_HW && T.half + 3 < HUB_HW);
  const game = skip(newGame(3)), w = game.worlds[0], hub = node(w, 'planet');
  assert.equal(nodeAt(w, { x: hub.x + HUB_HW / 1.6 - 3, y: hub.y }), hub, 'the rock\'s side');
  assert.equal(nodeAt(w, { x: hub.x + HUB_HW / 1.6 + 20, y: hub.y }), null, 'beside the rock');
  // depth per width never exceeds the stage sheet's .85 and falls for big islands
  for (const hw of [8, 14, 22, 26]) assert.equal(depthFor(hw), Math.round(hw * .85));
  assert.ok(depthFor(80) <= 80 * .4 + 1 && depthFor(54) / 54 < depthFor(26) / 26 && depthFor(80) / 80 < depthFor(54) / 54);
});

import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { skyLayer, twinkle } = await import('../web/js/draw/kit.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { drawGalaxy, galClampPan, galPanFor, discScale, NEIGHBOURS, gpos, galAt, galInvalidate } = await import('../web/js/draw/galaxy.js');

const W = 1146, H = 480, same = (a, b) => Buffer.from(a.d).equals(Buffer.from(b.d));
const shot = (pan, t = 3) => { const c = new PixCtx(W, H); galInvalidate(c); drawGalaxy(c, t, null, t, W, H, pan); return c };

test('galaxy pan is clamped so the home disc stays partly on screen', () => {
  const sc = discScale(W, H), mx = W / 2 + .5 * sc, my = H / 2 + .1 * sc;
  assert.deepEqual(galClampPan({ x: 1e6, y: 1e6 }, W, H), { x: mx, y: my });
  assert.deepEqual(galClampPan({ x: -1e6, y: -1e6 }, W, H), { x: -mx, y: -my });
  assert.deepEqual(galClampPan({ x: 40, y: -30 }, W, H), { x: 40, y: -30 });
  assert.deepEqual(galClampPan({ x: 0, y: 0 }, W, H), { x: 0, y: 0 });
  assert.ok(mx < W / 2 + 1.1 * sc, 'the disc (radius 1.1 sc) still reaches the screen at the limit');
  // drawing a wild pan paints exactly what the clamped pan paints
  assert.ok(same(shot({ x: 1e6, y: -1e6 }), shot({ x: mx, y: -my })));
  const far = shot({ x: 1e6, y: -1e6 }); let lit = 0; for (const v of far.px) if (((v >> 8) & 255) > 120) lit++;
  assert.ok(lit > 50, 'some of the disc is still on screen');
});

const skyAt = t => { const c = new PixCtx(W, H), L = skyLayer(W, H, 57, { band: false }); c.putImageData(L.img, 0, 0); twinkle(c, L.tw, t); return c };
const diffIn = (a, b, x0, y0, x1, y1) => { let m = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (a.px[y * W + x] !== b.px[y * W + x]) m++; return m };

test('wallpaper galaxy is home alone: no pan, no neighbours', () => {
  const pan = { x: 300, y: 0 }, game = { ui: { galPan: pan } };
  assert.equal(galPanFor('wallpaper', game), null);
  assert.deepEqual(galPanFor('play', game), { x: 300, y: 0 });
  assert.deepEqual(galPanFor('play', { ui: {} }), { x: 0, y: 0 });
  const wall = shot(galPanFor('wallpaper', game)), play0 = shot({ x: 0, y: 0 }), sky = skyAt(3);
  // the left and right edge strips are bare sky (twinkles included) in the wallpaper, and hold neighbours in play
  for (const [x0, x1] of [[0, 90], [W - 90, W]]) assert.equal(diffIn(wall, sky, x0, 0, x1, H), 0, `wallpaper edge ${x0}`);
  assert.ok(diffIn(play0, sky, 0, 0, 90, H) + diffIn(play0, sky, W - 90, 0, W, H) > 200, 'play shows neighbours at the edges');
  // and every neighbour's own box is sky in the wallpaper (outside the disc's reach, which is the middle band)
  const sc = discScale(W, H);
  for (const nb of NEIGHBOURS) { const cx = Math.round(W / 2 + nb.dx * sc), cy = Math.round(H / 2 + nb.dy * sc), r = Math.round(nb.r * sc * .5); const x0 = Math.max(0, cx - r), x1 = Math.min(W, cx + r); if (x0 < x1 && Math.abs(nb.dy) * sc > 100) assert.equal(diffIn(wall, sky, x0, Math.max(0, cy - r), x1, Math.min(H, cy + r)), 0, nb.kind) }
  assert.ok(same(wall, shot(null)));
  assert.ok(!same(shot({ x: 300, y: 0 }), play0), 'play does pan');
});

test('panning reveals a neighbour galaxy', () => {
  assert.equal(NEIGHBOURS.length, 3);
  assert.deepEqual(NEIGHBOURS.map(n => n.kind).sort(), ['elliptical', 'irregular', 'ring']);
  const sc = discScale(W, H), n = NEIGHBOURS.find(x => x.kind === 'ring'), b = shot({ x: -n.dx * sc, y: -n.dy * sc }), sky = skyAt(3);
  // panned to the middle of the screen, the box there is full of ring over the sky (and not the home disc)
  assert.ok(diffIn(b, sky, W / 2 - 60, H / 2 - 60, W / 2 + 60, H / 2 + 60) > 300);
});

test('star systems follow the pan', () => {
  drawGalaxy(new PixCtx(W, H), 0, null, 0, W, H, { x: 0, y: 0 });
  const p0 = gpos(0.6, 0.7, 0);
  drawGalaxy(new PixCtx(W, H), 0.5, null, 0, W, H, { x: 50, y: -20 });
  const p1 = gpos(0.6, 0.7, 0);
  assert.equal(Math.round(p1.x - p0.x), 50); assert.equal(Math.round(p1.y - p0.y), -20);
  assert.ok(typeof galAt === 'function');
});

test('the black hole jets move with the pan (anchored on the hole, no stray line)', () => {
  const pan = { x: -300, y: 40 }, c = shot(pan), s = skyLayer(W, H, 57, { band: false }).px.px, cx = W / 2 + pan.x, cy = H / 2 + pan.y;
  const lit = x => { let m = 0; for (let y = Math.round(cy) - 150; y < Math.round(cy) - 15; y++) for (let d = -8; d <= 8; d++) if (c.px[y * W + Math.round(x) + d] !== s[y * W + Math.round(x) + d]) m++; return m };
  assert.ok(lit(cx) > 60, 'jet above the hole');
  // the unpanned centre column (where a stray, un-panned jet would sit) is only sky and a few stars there
  assert.ok(lit(W / 2) < 25, `stray line at the old centre: ${lit(W / 2)}`);
});

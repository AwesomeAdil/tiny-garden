import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { skyLayer } = await import('../web/js/draw/kit.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { drawGalaxy, galClampPan, galPanFor, discScale, NEIGHBOURS, gpos, galAt, galInvalidate } = await import('../web/js/draw/galaxy.js');

const W = 1146, H = 480, same = (a, b) => Buffer.from(a.d).equals(Buffer.from(b.d));
const shot = (pan, t = 3) => { const c = new PixCtx(W, H); galInvalidate(c); drawGalaxy(c, t, null, t, W, H, pan); return c };

test('galaxy pan is clamped so the home disc stays partly on screen', () => {
  const sc = discScale(W, H);
  for (const p of [{ x: 1e6, y: 1e6 }, { x: -1e6, y: -1e6 }, { x: 0, y: 0 }, { x: 40, y: -30 }]) {
    const q = galClampPan(p, W, H);
    assert.ok(Math.abs(q.x) < W / 2 + 1.1 * sc && Math.abs(q.y) < H / 2 + .2 * sc, JSON.stringify(q));
  }
  assert.deepEqual(galClampPan({ x: 40, y: -30 }, W, H), { x: 40, y: -30 });
  // drawing a wild pan still paints the disc somewhere
  const far = shot({ x: 1e6, y: -1e6 }), mid = shot({ x: 0, y: 0 });
  assert.ok(!same(far, mid));
  let lit = 0; for (const v of far.px) if (((v >> 8) & 255) > 120) lit++;
  assert.ok(lit > 50, 'some of the disc is still on screen');
});

test('wallpaper galaxy ignores pan', () => {
  const pan = { x: 300, y: 0 };
  assert.deepEqual(galPanFor('wallpaper', { ui: { galPan: pan } }), { x: 0, y: 0 });
  assert.deepEqual(galPanFor('play', { ui: { galPan: pan } }), galClampPan(pan, W, H) && pan);
  assert.ok(same(shot(galPanFor('wallpaper', { ui: { galPan: pan } })), shot({ x: 0, y: 0 })));
  assert.ok(!same(shot(galPanFor('play', { ui: { galPan: pan } })), shot({ x: 0, y: 0 })), 'play mode does pan');
});

test('panning reveals a neighbour galaxy that home alone does not show', () => {
  assert.equal(NEIGHBOURS.length, 3);
  assert.deepEqual(NEIGHBOURS.map(n => n.kind).sort(), ['elliptical', 'irregular', 'ring']);
  const sc = discScale(W, H), n = NEIGHBOURS.find(x => x.kind === 'ring');
  const a = shot({ x: 0, y: 0 }), b = shot({ x: -n.dx * sc, y: -n.dy * sc }), sky = skyLayer(W, H, 57).px.px;
  // pan the ring to the middle of the screen: the box there is full of ring, with the sky behind (and not the home disc)
  const cx = Math.round(W / 2), cy = Math.round(H / 2), cnt = c => { let m = 0; for (let y = cy - 60; y < cy + 60; y++) for (let x = cx - 60; x < cx + 60; x++) if (c.px[y * W + x] !== sky[y * W + x]) m++; return m };
  assert.ok(cnt(b) > 300, `ring pixels at the middle: ${cnt(b)}`);
  assert.ok(!same(a, b));
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
  const pan = { x: -300, y: 40 }, c = shot(pan), s = skyLayer(W, H, 57).px.px, cx = W / 2 + pan.x, cy = H / 2 + pan.y;
  const lit = x => { let m = 0; for (let y = Math.round(cy) - 150; y < Math.round(cy) - 15; y++) for (let d = -8; d <= 8; d++) if (c.px[y * W + Math.round(x) + d] !== s[y * W + Math.round(x) + d]) m++; return m };
  assert.ok(lit(cx) > 60, 'jet above the hole');
  // the unpanned centre column (where a stray, un-panned jet would sit) is only sky and a few stars there
  assert.ok(lit(W / 2) < 25, `stray line at the old centre: ${lit(W / 2)}`);
});

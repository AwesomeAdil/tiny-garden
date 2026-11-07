import test from 'node:test';
import assert from 'node:assert/strict';
import { artMask, placeNames, namesOn } from '../web/js/ui/names.js';

// A w x h pixel buffer (ABGR words, as in ImageData) with the given rects painted bright.
const paint = (w, h, rects) => { const px = new Uint32Array(w * h).fill(0xff1f1514); rects.forEach(([x, y, rw, rh]) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) px[j * w + i] = 0xffe0e0e0 }); return px };
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('the art mask ignores lone stars and pads dense art', () => {
  const W = 60, H = 40, px = paint(W, H, [[20, 15, 10, 8], [5, 5, 1, 1], [50, 30, 1, 1]]);
  const m = artMask(px, W, H, 60, 2);
  assert.equal(m.art[18 * W + 25], 1);
  assert.equal(m.art[5 * W + 5], 0, 'a lone star is not art');
  assert.equal(m.busy[18 * W + 18], 1, 'padded by 2');
  assert.equal(m.busy[18 * W + 16], 0);
});

test('names land in clear space; leaders and boxes never touch art or each other', () => {
  const W = 300, H = 160;
  // A wide disc in the middle and two planets.
  const rects = [[40, 60, 220, 40], [70, 30, 10, 10], [200, 120, 12, 12]];
  const m = artMask(paint(W, H, rects), W, H, 60, 3);
  const items = [
    { id: 'a', ax: 75, ay: 35, w: 40, h: 8, up: true },
    { id: 'b', ax: 120, ay: 80, w: 50, h: 8, up: true },
    { id: 'c', ax: 140, ay: 80, w: 50, h: 8, up: false },
    { id: 'd', ax: 206, ay: 126, w: 30, h: 8, up: false },
    { id: 'e', ax: 150, ay: 70, w: 44, h: 8, up: true },
  ];
  const out = placeNames(items, m, { margin: 4, gap: 3 });
  assert.equal(out.length, items.length);
  const pad = rects.map(([x, y, w, h]) => ({ x: x - 3, y: y - 3, w: w + 6, h: h + 6 }));
  out.forEach((o, i) => {
    assert.ok(o, items[i].id + ' was placed');
    assert.equal(o.w, items[i].w); assert.equal(o.h, items[i].h);
    assert.ok(o.x >= 4 && o.y >= 4 && o.x + o.w <= W - 4 && o.y + o.h <= H - 4, 'inside the margin');
    pad.forEach(r => assert.ok(!hit(o, r), `${items[i].id} box overlaps art`));
    out.forEach((p, j) => { if (j !== i) assert.ok(!hit(o, p), `${items[i].id} overlaps ${items[j].id}`) });
    const lead = o.line; assert.ok(lead.length > 0, 'has a leader');
    lead.forEach(([x, y]) => {
      assert.equal(m.art[y * W + x], 0, `${items[i].id} leader crosses art at ${x},${y}`);
      out.forEach(p => assert.ok(!hit({ x, y, w: 1, h: 1 }, p), 'leader runs under a name'));
    });
  });
  // Up names sit above their anchor, down names below.
  assert.ok(out[0].y + out[0].h <= 30 && out[1].y + out[1].h <= 60);
  assert.ok(out[2].y >= 100 && out[3].y >= 132);
});

test('names that share a side snap to one row when that stays clear', () => {
  // b's planet sits on top of the disc, so b starts higher; a then moves up to b's row.
  const W = 300, H = 160, m = artMask(paint(W, H, [[40, 70, 220, 30], [190, 55, 20, 15]]), W, H, 60, 2);
  const out = placeNames([{ id: 'a', ax: 60, ay: 80, w: 30, h: 8, up: true }, { id: 'b', ax: 200, ay: 60, w: 30, h: 8, up: true }], m, { margin: 4, gap: 3 });
  assert.ok(out[1].y < 50, 'b sits above its planet');
  assert.equal(out[0].y, out[1].y);
});

test('a name with no clear space is left out rather than drawn over art', () => {
  const W = 60, H = 30, m = artMask(paint(W, H, [[0, 0, 60, 30]]), W, H, 60, 2);
  assert.deepEqual(placeNames([{ id: 'a', ax: 30, ay: 15, w: 20, h: 8, up: true }], m, { margin: 2, gap: 3 }), [null]);
});

test('names show only in play, and only while N has them on; never in the wallpaper', () => {
  assert.equal(namesOn('play', { names: true }), true);
  assert.equal(namesOn('play', {}), true, 'old saves default to on');
  assert.equal(namesOn('play', { names: false }), false);
  assert.equal(namesOn('wallpaper', { names: true }), false);
  assert.equal(namesOn('wallpaper', { names: false }), false);
});

test('a placed name keeps its slot while its anchor drifts, and its leader follows the anchor', () => {
  const W = 300, H = 160, m = artMask(paint(W, H, [[40, 70, 220, 30]]), W, H, 60, 2);
  const it = { id: 'a', ax: 120, ay: 80, w: 40, h: 8, up: true };
  const [a] = placeNames([it], m, { margin: 4, gap: 3 });
  // Drift a little: the box stays put, the leader starts from the new anchor column.
  const [b] = placeNames([{ ...it, ax: 127 }], m, { margin: 4, gap: 3, prev: [a] });
  assert.deepEqual([b.x, b.y], [a.x, a.y]);
  assert.equal(b.line[0][0], 127);
  // Drift outside the box: still kept, with an elbow leader.
  const [c] = placeNames([{ ...it, ax: 150 }], m, { margin: 4, gap: 3, prev: [a] });
  assert.deepEqual([c.x, c.y], [a.x, a.y]); assert.equal(c.line[0][0], 150);
  c.line.forEach(([x, y]) => assert.equal(m.art[y * W + x], 0));
});

test('a kept slot is given up only when the art now covers it', () => {
  const W = 300, H = 160, m0 = artMask(paint(W, H, [[40, 70, 220, 30]]), W, H, 60, 2);
  const it = { id: 'a', ax: 120, ay: 80, w: 40, h: 8, up: true };
  const [a] = placeNames([it], m0, { margin: 4, gap: 3 });
  const m1 = artMask(paint(W, H, [[40, 70, 220, 30], [a.x, a.y, 10, 6]]), W, H, 60, 2);
  const [b] = placeNames([it], m1, { margin: 4, gap: 3, prev: [a] });
  assert.ok(b && (b.x !== a.x || b.y !== a.y), 'moved to a clear slot');
  const pad = { x: a.x - 2, y: a.y - 2, w: 14, h: 10 };
  assert.ok(!hit(b, pad));
});

// The close-ups: each stage reads at a steady zoom, big enough in the side panel, clear of the planet; by default in
// the Long Dawn (TIDE's limb at sunrise across the lower right, the island in the left third).
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { newGame } = await import('../web/js/sim/game.js');
const { autoPick } = await import('../web/js/sim/dev.js');
const { isl } = await import('../web/js/sim/world.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { islandView, islandFrame, planetView, townFrame, dawnGeom, dawnSun, opaqueBox, CLOSE } = await import('../web/js/draw/closeup.js');
const { townSprite } = await import('../web/js/draw/city.js');
const { noteSeed } = await import('../web/js/draw/kit.js');

const SIZES = [[1146, 480], [200, 120]], IDS = ['home', 'frost', 'ember', 'verdant'], STYLES = ['dawn', 'low'];
// One game, every island at stage st (picks made from stage 2 on), as the player would grow it.
const atStage = st => { const g = newGame(3), w = g.worlds[0]; noteSeed(g, w); for (let s = 1; s <= st; s++) { isl(w).forEach(n => { n.stage = s }); if (s >= 2) autoPick(w) } return w };
const W4 = [1, 2, 3, 4].map(atStage), nodeOf = (w, id) => isl(w).find(n => n.id === id);
// Every opaque pixel of sprite I placed with its top-centre at (x, y), zoomed z: calls f(canvas x, canvas y) per block corner.
const eachPx = (I, z, x, y, f) => { for (let j = 0; j < I.h; j++) for (let i = 0; i < I.w; i++) if (I.px.d[(j * I.w + i) * 4 + 3]) f(x + (i - I.ox) * z, y + (j - I.oy) * z) };

test('the close-up is the Long Dawn by default', () => assert.equal(CLOSE.style, 'dawn'));

test('an island keeps the same close-up zoom from stage 1 to 4', () => {
  for (const style of STYLES) for (const [W, H] of SIZES) for (const id of IDS) {
    const zs = W4.map(w => islandFrame(w, nodeOf(w, id), W, H, style).z);
    assert.ok(zs.every(z => z === zs[0]), `${style} ${id} ${W}x${H} zooms ${zs}`);
  }
});

test('stage 4 grows props that stand tall above the rock top, where stage 1 is bare', () => {
  for (const [W, H] of SIZES) for (const id of IDS) {
    const draw = w => { const c = new PixCtx(W, H); islandView(c, w, nodeOf(w, id), 0, W, H, 0); return c };
    const a = draw(W4[0]), b = draw(W4[3]), F1 = islandFrame(W4[0], nodeOf(W4[0], id), W, H), F4 = islandFrame(W4[3], nodeOf(W4[3], id), W, H);
    const top = Math.min(F1.y, F4.y) - 2 * F4.z; // above both grass lines (and their bob)
    let first = top; for (let y = 0; y < top && first === top; y++) for (let x = 0; x < W; x++) if (a.px[y * W + x] !== b.px[y * W + x]) { first = y; break }
    // what grew stands at least 12% of the canvas height above the rock: big enough to read the stage at a glance
    assert.ok(top - first >= H * .12, `${id} ${W}x${H}: props stand ${top - first} px above the rock top`);
  }
});

test('the island is a quarter to a third of the width, and at 2x or more in the side panel', () => {
  for (const [W, H] of SIZES) for (const w of W4) for (const id of IDS) {
    const n = nodeOf(w, id), F = islandFrame(w, n, W, H), wide = opaqueBox(F.I).w * F.z / W;
    if (W === 200) assert.ok(F.z >= 2, `${id} st${n.stage} z${F.z}`);
    if (n.stage === 4) assert.ok(wide >= .22 && wide <= .34, `${id} ${W}x${H} grown: ${(wide * 100).toFixed(0)}% of the width`);
    else assert.ok(wide >= .18, `${id} st${n.stage} ${W}x${H}: ${(wide * 100).toFixed(0)}% of the width`);
  }
});

test('the island floats in the left third, clear of the planet (bob included) and whole on the canvas', () => {
  for (const style of STYLES) for (const [W, H] of SIZES) for (const w of W4) for (const id of IDS) {
    const n = nodeOf(w, id), F = islandFrame(w, n, W, H, style), b = opaqueBox(F.I);
    let hit = 0, top = H; eachPx(F.I, F.z, F.x, F.y, (x, y) => { for (const yy of [y + F.z - 1 + F.z]) if (yy >= F.limb(x) || yy >= F.limb(x + F.z - 1)) hit++; top = Math.min(top, y - F.z) });
    assert.equal(hit, 0, `${style} ${id} st${n.stage} ${W}x${H}: ${hit} island pixels on the planet`);
    assert.ok(top >= 0, `${style} ${id} ${W}x${H}: island top clipped`);
    if (style === 'dawn') { const cx = F.x + ((b.x0 + b.x1 + 1) / 2 - F.I.ox) * F.z; assert.ok(cx >= W * .2 && cx <= W * .4, `${id} ${W}x${H}: centre at ${(cx / W).toFixed(2)} W`) }
    // low: the grown island floats just over the curve, not mid-sky
    if (style === 'low' && n.stage === 4) assert.ok(F.horizon - (F.y + (b.y1 + 2 - F.I.oy) * F.z) <= H * .08, `${id} ${W}x${H}: too much sky under the island`);
  }
});

test('the sun rises on the limb with a warm glow around it', () => {
  for (const [W, H] of SIZES) {
    const c = new PixCtx(W, H); islandView(c, W4[0], nodeOf(W4[0], 'home'), 0, W, H, 0);
    const G = dawnGeom(W, H), [sx, sy] = dawnSun(G, 0), R = 6 * G.f;
    let warm = 0, n = 0;
    for (let y = Math.round(sy - R); y <= sy + R; y++) for (let x = Math.round(sx - R); x <= sx + R; x++) { if (Math.hypot(x - sx, y - sy) > R) continue; n++; const i = (y * W + x) * 4, [r, g, b] = c.d.subarray(i, i + 3); if (r > 190 && r > b + 50) warm++ }
    assert.ok(warm / n > .2, `${W}x${H}: ${warm} of ${n} pixels near the sun are warm`);
    // and it sits on the limb, low on the right
    assert.ok(Math.abs(sy - G.limb(sx)) <= 3 * G.f && sx > W * .7, `${W}x${H}: sun at ${sx.toFixed(0)},${sy.toFixed(0)}`);
  }
});

test('the town square floats in the left third over the dawn planet, the same zoom at every stage', () => {
  for (const [W, H] of SIZES) {
    const F = townFrame(W, H);
    for (let st = 1; st <= 4; st++) {
      const T = townSprite(st); let hit = 0; eachPx(T, F.z, F.x, F.y, (x, y) => { if (y + 2 * F.z - 1 >= F.limb(x)) hit++ });
      assert.equal(hit, 0, `${W}x${H} stage ${st}: ${hit} town pixels on the planet`);
    }
    const g = newGame(3), w = g.worlds[0], c = new PixCtx(W, H); planetView(c, g, w, 0, W, H, 0);
    assert.notEqual(c.px[F.y * W + F.x], c.px[0], 'the town is drawn at its frame');
  }
});

test("the dawn planet wears this game's continents", () => {
  const draw = seed => { const g = newGame(seed), c = new PixCtx(200, 120); planetView(c, g, g.worlds[0], 0, 200, 120, 0); return c };
  const a = draw(1), b = draw(7), G = dawnGeom(200, 120); let diff = 0, n = 0;
  for (let y = 100; y < 120; y++) for (let x = 120; x < 200; x++) if (y > G.limb(x) + 2) { n++; if (a.px[y * 200 + x] !== b.px[y * 200 + x]) diff++ }
  assert.ok(diff / n > .2, `${diff} of ${n} planet pixels differ between seeds`);
});

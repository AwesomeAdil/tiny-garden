// The island close-up: each stage reads at a steady zoom, big enough in the side panel, above TIDE's horizon.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { newGame } = await import('../web/js/sim/game.js');
const { autoPick } = await import('../web/js/sim/dev.js');
const { isl } = await import('../web/js/sim/world.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { islandView, islandFrame } = await import('../web/js/draw/closeup.js');

const SIZES = [[1146, 480], [200, 120]], IDS = ['home', 'frost', 'ember', 'verdant'];
// The opaque box of a sprite, in its own pixels.
const box = I => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) if (I.px.d[(y * I.w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } return { x0, y0, x1, y1, w: x1 - x0 + 1 } };
// One game, every island at stage st (picks made from stage 2 on), as the player would grow it.
const atStage = st => { const g = newGame(3), w = g.worlds[0]; for (let s = 1; s <= st; s++) { isl(w).forEach(n => { n.stage = s }); if (s >= 2) autoPick(w) } return w };
const W4 = [1, 2, 3, 4].map(atStage), nodeOf = (w, id) => isl(w).find(n => n.id === id);

test('an island keeps the same close-up zoom from stage 1 to 4', () => {
  for (const [W, H] of SIZES) for (const id of IDS) {
    const zs = W4.map(w => islandFrame(w, nodeOf(w, id), W, H).z);
    assert.ok(zs.every(z => z === zs[0]), `${id} ${W}x${H} zooms ${zs}`);
  }
});

test('stage 4 grows props that stand tall above the rock top, where stage 1 is bare', () => {
  for (const [W, H] of SIZES) for (const id of IDS) {
    const draw = w => { const c = new PixCtx(W, H); islandView(c, w, nodeOf(w, id), 0, W, H); return c };
    const a = draw(W4[0]), b = draw(W4[3]), F1 = islandFrame(W4[0], nodeOf(W4[0], id), W, H), F4 = islandFrame(W4[3], nodeOf(W4[3], id), W, H);
    const top = Math.min(F1.y, F4.y) - 2 * F4.z; // above both grass lines (and their bob)
    let first = top; for (let y = 0; y < top && first === top; y++) for (let x = 0; x < W; x++) if (a.px[y * W + x] !== b.px[y * W + x]) { first = y; break }
    // what grew stands at least 12% of the canvas height above the rock: big enough to read the stage at a glance
    assert.ok(top - first >= H * .12, `${id} ${W}x${H}: props stand ${top - first} px above the rock top`);
  }
});

test('the side-panel close-up shows the island at 2x or more, at least 30% of the width', () => {
  for (const w of W4) for (const id of IDS) {
    const F = islandFrame(w, nodeOf(w, id), 200, 120), b = box(F.I);
    assert.ok(F.z >= 2, `${id} st${nodeOf(w, id).stage} z${F.z}`);
    assert.ok(b.w * F.z >= 200 * .3, `${id} st${nodeOf(w, id).stage} width ${b.w * F.z}`);
  }
});

test("the horizon's top row shows just below the island's lowest pixel, bob included", () => {
  for (const [W, H] of SIZES) for (const w of W4) for (const id of IDS) {
    const F = islandFrame(w, nodeOf(w, id), W, H), b = box(F.I), low = F.y + (b.y1 + 1 - F.I.oy) * F.z + F.z, st = nodeOf(w, id).stage; // +1 px of bob
    assert.ok(low < F.horizon, `${id} st${st} ${W}x${H}: island bottom ${low}, horizon ${F.horizon}`);
    // style A: the grown island floats just over the curve, not mid-sky
    if (st === 4) assert.ok(F.horizon - low <= H * .08, `${id} ${W}x${H}: ${F.horizon - low} px of sky between island and horizon`);
    // and the island is whole on the canvas
    assert.ok(F.y - (F.I.oy - b.y0) * F.z - F.z >= 0, `${id} ${W}x${H}: island top clipped`);
  }
});

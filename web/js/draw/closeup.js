// Close-ups, on the kit: the town square (planetView), one island big over a soft horizon (islandView), and the
// Long Dawn behind an unreached planet (dawn). Each starts from the kit's starfield (skyLayer), cached per canvas
// size like the city's background, so a frame copies it in and draws only what moves. A close-up never draws
// goods on islands. Reads the world; never writes to it.
import { TAU, P, B8, NN, pickR, rngf, worldView } from '../core/pixel.js';
import { PixCtx } from '../core/pixctx.js';
import { KD, R_ARM, R_IN, R_CORE, R_TEAL } from '../core/palette.js';
import { STY, hazed, skyLayer, twinkle, sun, planetLayer, glowAt, getSprite, drawIsland, isleBob, islandSpec, islandSprite } from './kit.js';
import { cityBackground, townLayout, citySky } from './city.js';

const VW = 200, VH = 120;

// ---------- the cached backgrounds ----------
const CBG = new Map();
const remember = (key, make) => { let B = CBG.get(key); if (B) return B; B = make(); CBG.set(key, B); if (CBG.size > 4) CBG.delete(CBG.keys().next().value); return B };
const sky2 = (w, off) => ((w.def.seedOffset | 0) * 131 + off) | 0;

// A soft planet horizon across the bottom of a W x H canvas: top at 80% of the height, wide enough that the bottom
// row is planet edge to edge.
function horizonBack(W, H, seed, style = 'low') {
  const px = new PixCtx(W, H), L = skyLayer(W, H, seed), top = Math.round(H * .8), d = Math.max(8, H - 1 - top), half = W / 2 + 6, r = (half * half + d * d) / (2 * d);
  px.putImageData(L.img, 0, 0);
  sun(px, W - Math.max(24, Math.round(W * .12)), Math.max(12, Math.round(H * .12)));
  // 'behind': a big planet disc, mostly below the frame, hazed toward the sky so the island reads in front of it
  if (style === 'behind') { const R = H * .95; planetLayer(hazed(px, .4), W, H, W * .56, H * .98 + R * .5, R, 1, 1, { rim: 8 }) }
  else planetLayer(px, W, H, W / 2, top + r, r, 1, 1, { rim: 6 });
  return { px, tw: L.tw.filter(s => px.px[s.y * W + s.x] === L.px.px[s.y * W + s.x]) };
}

// A close-up is a zoom, not a rebuild: the largest whole zoom of 2, 3 or 4 that keeps a w x h pixel thing within about
// 45% of the canvas width and 80% of its height; 1 only when even 2 would not fit (a tiny canvas).
export const zoomFor = (w, h, W, H) => [4, 3, 2].find(z => w * z <= W * .45 && h * z <= H * .8) || 1;
// Where the island close-up puts the planet: 'low' a curve along the bottom, 'behind' a big hazy disc behind and below.
export const CLOSE = { style: 'low' };

// The town square of world w on a W x H canvas: the city's own background (its sky, TIDE's horizon, houses and
// lamps) around the town, zoomed by z and placed with the town's surface at two thirds of the height.
export function planetView(c, game, w, t, W = VW, H = VH) {
  const stage = w.hub.stage, v = { w: W, h: H, ...worldView(W, H) };
  const B = remember(['town', W, H, w.def.key, stage, game.seed].join(), () => {
    const src = cityBackground(game, w, v), T = src.town, z = zoomFor(T.half * 2, 30, W, H), px = new PixCtx(W, H);
    const sx0 = Math.round(T.H.cx - W / z / 2), sy0 = Math.max(0, Math.min(H - Math.ceil(H / z), Math.round(T.H.top - H * .66 / z)));
    for (let y = 0; y < H; y++) { const sy = sy0 + Math.floor(y / z); if (sy >= H) break; for (let x = 0; x < W; x++) { const sx = sx0 + Math.floor(x / z); px.px[y * W + x] = sx >= 0 && sx < W ? src.px.px[sy * W + sx] : src.px.px[sy * W + (sx < 0 ? 0 : W - 1)] } }
    return { px, z, sx0, sy0, tw: src.tw, lamps: T.lamps };
  });
  const { z, sx0, sy0 } = B;
  c.putImageData(B.px.img, 0, 0);
  for (const s of B.tw) { const b = Math.sin(t * s.f + s.p), x = (s.x - sx0) * z, y = (s.y - sy0) * z; if (b > -.2 && x >= 0 && y >= 0 && x < W && y < H) P(c, b > .6 ? '#e3eafc' : '#8087a2', x, y, z, z) }
  B.lamps.forEach((l, i) => glowAt(c, (l.x - sx0) * z, (l.y - sy0) * z - 4 * z, STY.book.win, .8 + .2 * Math.sin(t * .6 + i * 1.7)));
}

// One island's sprite, zoomed: the static sprite blitted at z, and its animated bits (falls, fireflies, lamp flicker)
// drawn by drawIsland into a transparent layer at native size each frame and zoomed the same.
const LAYERS = new WeakMap(), SCRATCH = new Map(), M = 24;
export function drawIslandZoom(c, I, x, y, t, z) {
  x = Math.round(x); y = Math.round(y);
  let L = LAYERS.get(I); if (!L) { L = { tmp: new PixCtx(I.w + 2 * M, I.h + 2 * M, { transparent: true }), stub: { ...I, px: new PixCtx(1, 1, { transparent: true }) } }; LAYERS.set(I, L) }
  c.blitZoom(I.px, x - I.ox * z, y - I.oy * z, z);
  if (!I.anim.length) return;
  L.tmp.px.fill(0); drawIsland(L.tmp, L.stub, M + I.ox, M + I.oy, t);
  c.blitZoom(L.tmp, x - (M + I.ox) * z, y - (M + I.oy) * z, z);
}

// The Long Dawn from page 9: the planet's horizon below, the star rising on its rim. At 200x120 it is page 38's
// exactly; wider, the planet grows with the width (f = W/200) and the noise, light and stars are scaled to match.
// The planet body is per-pixel, so it is only re-rendered when rt (default t) changes; stars twinkle with t.
const DIMG = new WeakMap();
function dawnSetup(W, H) {
  const f = W / VW, PR = 226 * f, n = W === VW && H === VH ? 90 : Math.round(W * H * 55 / 24000);
  return { W, H, f, PR, PCX: 135 + (W - VW) * .54, PCY: H + PR - 27, lr: 125 * Math.sqrt(f), ar: 115 * Math.sqrt(f), DST: Array.from({ length: n }, (_, i) => { const r = rngf(i + 3); return { x: r() * W, y: r() * H * .8, v: r(), ph: r() * TAU } }) };
}
export function dawn(c, t, W = VW, H = VH, rt = t) {
  let D = DIMG.get(c); if (!D || D.W !== W || D.H !== H) { const img = c.createImageData(W, H); D = { ...dawnSetup(W, H), img, px: new Uint32Array(img.data.buffer), rt: null }; DIMG.set(c, D) }
  const { img, px: DPX, PCX, PCY, PR, f, lr, ar } = D;
  if (D.rt !== rt) {
    D.rt = rt;
    const sunA = -Math.PI / 2 + (.17 + Math.sin(rt * .04) * .05) / f, SUX = PCX + Math.cos(sunA) * (PR + 1), SUY = PCY + Math.sin(sunA) * (PR + 1) - 4 * Math.cos(rt * .04);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const b = B8[(y & 7) * 8 + (x & 7)], dx = x - PCX, dy = y - PCY, d = Math.hypot(dx, dy), sd = Math.hypot(x - SUX, y - SUY); let col;
      if (d < PR) {
        const lat = PR - d, lon = Math.atan2(dy, dx), lit = Math.max(0, 1 - Math.hypot(x - SUX, (y - SUY) * .5) / lr), cl = NN(lon * 840 * f + rt * .9, lat * 6.4), cl2 = NN(lon * 1800 * f - rt * .5, lat * 12 + 70), rim = Math.exp(-lat / 2.5), bands = .5 + .5 * Math.sin(lat * .6 + cl * 5);
        const val = (.05 + lit * lit * .42) * (.45 + bands * .55) + Math.max(0, cl2 - .58) * lit * .55 + rim * lit * lit * .42, warm = rim * lit * lit + Math.max(0, lit - .72) * .45; col = pickR(warm + (b - .5) * .12 > .2 ? R_CORE : lit + (b - .5) * .18 > .55 ? R_IN : R_ARM, val, b);
      }
      else { const up = d - PR, sg = Math.exp(-sd / 3.5) * 1.1 + Math.exp(-sd / 13) * .34, air = Math.exp(-up / 3) * (.14 + Math.pow(Math.max(0, 1 - sd / ar), 2)) * .72, glow = sg + air; col = pickR(sg + (b - .5) * .08 > air * .9 && sg > .05 ? R_CORE : R_TEAL, glow, b) }
      DPX[i] = col;
    }
  }
  c.putImageData(img, 0, 0); D.DST.forEach(s => { if (Math.hypot(s.x - PCX, s.y - PCY) < PR + 5 || Math.sin(t * .8 + s.ph) < -.55) return; c.fillStyle = s.v > .82 ? KD.flamingo : s.v > .55 ? KD.text : KD.blue; c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1) });
}

// Island n of world w: its kit sprite at the close-up scale (islandFrame), zoomed whole just above a soft horizon
// under the stars. Goods are never drawn.
export function islandView(c, w, n, t, W = VW, H = VH) {
  const B = remember(['isl', W, H, sky2(w, 89), CLOSE.style].join(), () => horizonBack(W, H, sky2(w, 89), CLOSE.style));
  // The zoom needs PixCtx's blitZoom, which a canvas context lacks: compose in a scratch PixCtx, then put it on c.
  const key = W + 'x' + H, S = SCRATCH.get(key) || SCRATCH.set(key, new PixCtx(W, H)).get(key);
  S.px.set(B.px.px); twinkle(S, B.tw, t);
  const { I, z, x, y } = islandFrame(w, n, W, H);
  drawIslandZoom(S, I, x, y + isleBob(n, t) * z, t, z);
  c.putImageData(S.img, 0, 0);
}
// Where island n sits in a W x H close-up: {I (its sprite), z, x, y (the sprite's top-centre on the canvas), horizon
// (the planet's top row)}. The sprite is built at a fixed close-up scale, not the canvas's world scale: at the stage
// sheet's size (stage-4 half-width 26, or 18 in a small panel) props read large on the rock and no wide-top filler
// hides the difference between stages. The zoom and the grass line come from the island fully grown (stage 4, bare of
// picks, plus PROP_UP rows of headroom: the tallest prop stands 18), so they hold still while it grows, and the grown
// island's lowest pixel stays LOW_GAP of the height above the horizon.
const PROP_UP = 20, LOW_GAP = .05, FRAMES = new Map();
export const closeK = W => W < 400 ? .36 : .52;
export function opaqueBox(I) {
  if (I.box) return I.box;
  let x0 = I.w, y0 = I.h, x1 = -1, y1 = -1;
  for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) if (I.px.d[(y * I.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return (I.box = { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
}
export function islandFrame(w, n, W = VW, H = VH) {
  const k = closeK(W), I = getSprite(w, n, 'near', k), horizon = Math.round(H * .8);
  const fk = [w.def.key, n.id, n.seed, k, W, H].join();
  let F = FRAMES.get(fk);
  if (!F) {
    const spec = islandSpec(w, { ...n, stage: 4 }, 'near', k), b = opaqueBox(islandSprite({ ...spec, picks: [], gifts: [], falls: [] })), oy = I.oy;
    const below = b.y1 + 1 - oy, z = [8, 7, 6, 5, 4, 3, 2].find(q => b.w * q <= W * .6 && (below + PROP_UP) * q <= horizon - H * LOW_GAP - q) || 1;
    F = { z, y: Math.round(horizon - H * LOW_GAP - z - below * z) };
    FRAMES.set(fk, F); if (FRAMES.size > 64) FRAMES.delete(FRAMES.keys().next().value);
  }
  return { I, z: F.z, x: Math.round(W / 2), y: F.y, horizon };
}

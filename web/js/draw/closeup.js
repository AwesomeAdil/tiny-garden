// Close-ups, on the kit: the town square (planetView), one island big over a soft horizon (islandView), and the
// Long Dawn behind an unreached planet (dawn). Each starts from the kit's starfield (skyLayer), cached per canvas
// size like the city's background, so a frame copies it in and draws only what moves. A close-up never draws
// goods on islands. Reads the world; never writes to it.
import { TAU, P, B8, NN, pickR, rngf, worldView, u32 } from '../core/pixel.js';
import { PixCtx } from '../core/pixctx.js';
import { KD, R_ARM, R_IN, R_CORE, R_TEAL } from '../core/palette.js';
import { STY, hazed, skyLayer, twinkle, sun, planetLayer, glowAt, getSprite, drawIsland, isleBob, islandSpec, islandSprite, tideWorld, tideColour, noteSeed, seedOf } from './kit.js';
import { cityBackground, townLayout, citySky, townSprite } from './city.js';

const VW = 200, VH = 120;

// ---------- the cached backgrounds ----------
const CBG = new Map();
const remember = (key, make) => { let B = CBG.get(key); if (B) return B; B = make(); CBG.set(key, B); if (CBG.size > 4) CBG.delete(CBG.keys().next().value); return B };
const sky2 = (w, off) => ((w.def.seedOffset | 0) * 131 + off) | 0;

// A soft planet horizon across the bottom of a W x H canvas: top at 80% of the height, wide enough that the bottom
// row is planet edge to edge.
function horizonBack(W, H, seed, style = 'low', tide = 0) {
  const px = new PixCtx(W, H), L = skyLayer(W, H, seed), top = Math.round(H * .8), d = Math.max(8, H - 1 - top), half = W / 2 + 6, r = (half * half + d * d) / (2 * d);
  px.putImageData(L.img, 0, 0);
  sun(px, W - Math.max(24, Math.round(W * .12)), Math.max(12, Math.round(H * .12)));
  // 'behind': a big planet disc, mostly below the frame, hazed toward the sky so the island reads in front of it
  if (style === 'behind') { const R = H * .95; planetLayer(hazed(px, .4), W, H, W * .56, H * .98 + R * .5, R, 1, 1, { rim: 8, seed: tide }) }
  else planetLayer(px, W, H, W / 2, top + r, r, 1, 1, { rim: 6, seed: tide });
  return { px, tw: L.tw.filter(s => px.px[s.y * W + s.x] === L.px.px[s.y * W + s.x]) };
}

// A close-up is a zoom, not a rebuild: the largest whole zoom of 2, 3 or 4 that keeps a w x h pixel thing within about
// 45% of the canvas width and 80% of its height; 1 only when even 2 would not fit (a tiny canvas).
export const zoomFor = (w, h, W, H) => [4, 3, 2].find(z => w * z <= W * .45 && h * z <= H * .8) || 1;
// Where the close-ups put the planet: 'dawn' TIDE's limb at sunrise across the lower right (the default), 'low' a curve
// along the bottom, 'behind' a big hazy disc behind and below.
export const CLOSE = { style: 'dawn' };

// The town square of world w on a W x H canvas. 'dawn' (the default): the town on its rock in the Long Dawn
// (townDawn). Otherwise the city's own background (its sky, TIDE's horizon, houses and
// lamps) around the town, zoomed by z and placed with the town's surface at two thirds of the height.
export function planetView(c, game, w, t, W = VW, H = VH, rt = t) {
  noteSeed(game, w);
  if (CLOSE.style === 'dawn') return townDawn(c, game, w, t, W, H, rt);
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

// The town on its rock (city.js townSprite), zoomed and floating in the left third over the dawn planet, its lamps
// glowing. townFrame: its zoom and top-centre {z, x, y}, from the grown town (stage 4), so they hold still as it grows.
const TFR = new Map();
export function townFrame(W, H) {
  const key = W + 'x' + H; let F = TFR.get(key); if (F) return F;
  const T4 = townSprite(4), b = opaqueBox(T4), D = dawnFrame(dawnGeom(W, H), b, T4.oy, T4.oy - b.y0, .3);
  F = { z: D.z, x: Math.round(D.cx - ((b.x0 + b.x1 + 1) / 2 - T4.ox) * D.z), y: D.y, limb: dawnGeom(W, H).limb }; TFR.set(key, F); return F;
}
function townDawn(c, game, w, t, W, H, rt) {
  const key = W + 'x' + H, S = SCRATCH.get(key) || SCRATCH.set(key, new PixCtx(W, H)).get(key);
  const B = dawnBack(W, H, game.seed | 0, sky2(w, 89), sunStep(rt)), T = townSprite(w.hub.stage), { z, x, y } = townFrame(W, H), bob = isleBob({ seed: 5 }, t) * z;
  S.px.set(B.px.px); twinkle(S, B.tw, t);
  S.blitZoom(T.px, x - T.ox * z, y - T.oy * z + bob, z);
  T.lamps.forEach((l, i) => glowAt(S, x + (l.x - T.ox) * z, y + bob + (l.y - T.oy) * z - 4 * z, STY.book.win, .8 + .2 * Math.sin(t * .6 + i * 1.7)));
  c.putImageData(S.img, 0, 0);
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

// ---------- the Long Dawn close-up (CLOSE.style 'dawn', page 9 C) ----------
// A giant TIDE (this game's continents, kit.js tideWorld) curving up across the lower right as a tilted limb, its
// night side dim, the sun rising on the limb with a warm glow and a thin teal atmosphere, under the Milky band; the
// island (or the town) floats in the left third. Sizes are fractions of the canvas, glows scale with f = H/120.
const DGEO = new Map();
export function dawnGeom(W, H) {
  const key = W + 'x' + H; let G = DGEO.get(key); if (G) return G;
  const d = H * .31, PCX = W * .95, top = H * .69, PR = (PCX * PCX + d * d) / (2 * d), PCY = top + PR, f = H / 120;
  const limb = x => PCY - Math.sqrt(Math.max(0, PR * PR - (x - PCX) * (x - PCX)));
  G = { W, H, PCX, PCY, PR, f, limb, SX0: W * .83, lr: H * .45, ar: W * .3 }; DGEO.set(key, G); return G;
}
// The sun's spot for rise-time rt: it climbs and sinks on the limb over ~2.6 min, in 17 steps (only a new step
// re-lights the planet, the per-pixel part).
const sunStep = rt => Math.round(Math.sin(rt * .04) * 8);
export function dawnSun(G, step) { const x = G.SX0 + step * G.f * .6; return [x, G.limb(x) + G.f * (1.5 - step * .25)] }
const rgbOf = u => [u & 255, (u >>> 8) & 255, (u >>> 16) & 255];
const toU = (r, g, b) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
const NIGHT = rgbOf(u32('#161a2e')), WARM = rgbOf(u32(KD.peach)), RIMT = rgbOf(u32(KD.teal)), HALO = u32('#3a2530');
// The cached planet surface for a size and seed: per canvas pixel its TIDE colour (0 off the disc).
function dawnSurface(G, seed) {
  const { W, H, PCX, PCY, PR, f } = G, Wd = tideWorld(seed);
  const yTop = Math.max(0, Math.floor(Math.min(G.limb(0), G.limb(Math.min(W - 1, PCX)))) - 1);
  const E = new Float32Array(W * H).fill(9), XX = new Float32Array(W * H), YY = new Float32Array(W * H), s = 1.6 * Math.sqrt(4 / f);
  for (let y = yTop; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - PCX, dy = y - PCY, d = Math.hypot(dx, dy); if (d > PR) continue;
    const dep = PR - d, along = Math.atan2(dx, -dy) * PR, kx = 1 / (1 + dep / (55 * f)), i = y * W + x;
    XX[i] = Wd.cityX + (Wd.flip ? -1 : 1) * along * s * kx; YY[i] = 30 + 190 * Math.log(1 + dep * s / 45 / 1.6); E[i] = Wd.field(XX[i], YY[i]);
  }
  const eAt = (x, y) => x < 0 || x >= W || y < 0 || y >= H ? 9 : E[y * W + x], col = new Uint32Array(W * H), cache = new Map();
  for (let y = yTop; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, e = E[i]; if (e === 9) continue;
    const coast = e > 0 && (eAt(x - 1, y) <= 0 || eAt(x + 1, y) <= 0 || eAt(x, y - 1) <= 0 || eAt(x, y + 1) <= 0), c = tideColour(Wd, XX[i], YY[i], e, x, y, coast);
    let u = cache.get(c); if (u === undefined) { u = u32(c); cache.set(c, u) } col[i] = u;
  }
  return { col, yTop };
}
// The dawn background (sky, glow, lit planet) for a size, seed, sky seed and sun step: {px, tw}. Cached.
const DSCENE = new Map(), DSURF = new Map();
function dawnBack(W, H, seed, skyS, step) {
  const key = [W, H, seed, skyS, step].join(); let B = DSCENE.get(key); if (B) return B;
  const G = dawnGeom(W, H), sk = [W, H, seed].join(), S = DSURF.get(sk) || (DSURF.set(sk, dawnSurface(G, seed)), DSURF.get(sk));
  if (DSURF.size > 3) DSURF.delete(DSURF.keys().next().value);
  const L = skyLayer(W, H, skyS), px = new PixCtx(W, H), P32 = px.px, [SX, SY] = dawnSun(G, step), { PCX, PCY, PR, f, lr, ar } = G;
  P32.set(L.px.px);
  const glowAtPx = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = B8[(y & 7) * 8 + (x & 7)], dx = x - PCX, dy = y - PCY, d = Math.hypot(dx, dy), sd = Math.hypot(x - SX, y - SY);
    if (d > PR) {
      // sky: the sun's core and corona, the atmosphere hugging the limb, and a wide dim warm halo
      const up = d - PR, sg = Math.exp(-sd / (3.5 * f)) * 1.1 + Math.exp(-sd / (13 * f)) * .34, air = Math.exp(-up / (2.2 * f)) * (.03 + Math.pow(Math.max(0, 1 - sd / ar), 2)) * .75, glow = sg + air;
      if (glow > .07) { P32[i] = pickR(sg + (b - .5) * .08 > air * .9 && sg > .05 ? R_CORE : R_TEAL, glow, b); glowAtPx[i] = 1 }
      else if ((1 - sd / (W * .12)) * .7 > b + .1) { P32[i] = HALO; glowAtPx[i] = 1 }
      continue;
    }
    // the planet: its surface, dimmed to night except near the sun, a warm terminator glow, and a thin bright rim
    const base = S.col[i]; if (!base) continue;
    const lat = PR - d, lit = Math.max(0, 1 - Math.hypot(x - SX, (y - SY) * 1.6) / lr), day = .08 + Math.pow(lit, 2) * .92;
    const q = Math.min(1, Math.floor((1 - day) * 4 + b) / 4) * .9, [r0, g0, b0] = rgbOf(base);
    let r = r0 + (NIGHT[0] - r0) * q, g = g0 + (NIGHT[1] - g0) * q, bl = b0 + (NIGHT[2] - b0) * q;
    const warm = Math.pow(lit, 2.5) * Math.exp(-lat / (9 * f)) * .7; r += (WARM[0] - r) * warm; g += (WARM[1] - g) * warm; bl += (WARM[2] - bl) * warm;
    const rimA = Math.exp(-lat / (1.1 * f)) * (.12 + .88 * Math.max(0, 1 - sd / (W * .5))), rc = lit > .5 ? WARM : RIMT;
    if (rimA > b * .5 + .08) { r += (rc[0] - r) * rimA; g += (rc[1] - g) * rimA; bl += (rc[2] - bl) * rimA }
    P32[i] = toU(r, g, bl);
  }
  B = { px, tw: L.tw.filter(s => Math.hypot(s.x - PCX, s.y - PCY) > PR + 2 && !glowAtPx[s.y * W + s.x]), G, sun: [SX, SY] };
  DSCENE.set(key, B); if (DSCENE.size > 4) DSCENE.delete(DSCENE.keys().next().value);
  return B;
}

// Where a sprite sits in a dawn close-up: the largest whole zoom that keeps its grown box within `wide` of the canvas
// width and whole between a 6% top margin and the limb (with a gap and a pixel of bob), centred at 0.3 W.
function dawnFrame(G, b, oy, up, wide) {
  const { W, H } = G, gap = H * .05;
  for (const z of [8, 7, 6, 5, 4, 3, 2, 1]) {
    if (z > 1 && b.w * z > W * wide) continue;
    const cx = Math.round(Math.max(W * .3, (b.w * z) / 2 + W * .04)), right = cx + (b.x1 + 1 - (b.x0 + b.x1 + 1) / 2) * z, left = cx - ((b.x0 + b.x1 + 1) / 2 - b.x0) * z;
    const floor = Math.min(G.limb(left), G.limb(right)) - gap - z, y = Math.round(floor - (b.y1 + 1 - oy) * z);
    if (z === 1 || y - up * z - z >= H * .06) return { z, y, cx };
  }
}

// Island n of world w: its kit sprite at the close-up scale (islandFrame), zoomed whole over the planet: in 'dawn'
// (the default) TIDE's limb at sunrise, in 'low' a soft horizon along the bottom, in 'behind' a hazy disc. Goods are
// never drawn. rt (default t) is the sunrise clock; the planet re-lights only when the sun moves a step.
export function islandView(c, w, n, t, W = VW, H = VH, rt = t, seed = seedOf(w)) {
  // The zoom needs PixCtx's blitZoom, which a canvas context lacks: compose in a scratch PixCtx, then put it on c.
  const key = W + 'x' + H, S = SCRATCH.get(key) || SCRATCH.set(key, new PixCtx(W, H)).get(key);
  const B = CLOSE.style === 'dawn' ? dawnBack(W, H, seed, sky2(w, 89), sunStep(rt)) : remember(['isl', W, H, sky2(w, 89), CLOSE.style, seed].join(), () => horizonBack(W, H, sky2(w, 89), CLOSE.style, seed));
  S.px.set(B.px.px); twinkle(S, B.tw, t);
  const { I, z, x, y } = islandFrame(w, n, W, H);
  drawIslandZoom(S, I, x, y + isleBob(n, t) * z, t, z);
  c.putImageData(S.img, 0, 0);
}

// Where island n sits in a W x H close-up: {I (its sprite), z, x, y (the sprite's top-centre on the canvas), limb(x)
// (the planet's top row at column x)}. The sprite is built at a fixed close-up scale, not the canvas's world scale,
// so props read large on the rock and no wide-top filler hides the difference between stages. The zoom and the
// grass line come from the island fully grown (stage 4, bare of picks, plus PROP_UP rows of headroom: the tallest
// prop stands 18), so they hold still while it grows. 'dawn': about 28% of the width in the left third, just above
// the limb; 'low' / 'behind': centred, the grown island's lowest pixel LOW_GAP of the height above the horizon.
const PROP_UP = 20, LOW_GAP = .05, FRAMES = new Map();
export const closeK = (W, style = CLOSE.style) => style === 'dawn' ? (W < 400 ? .24 : .52) : W < 400 ? .36 : .52;
export function opaqueBox(I) {
  if (I.box) return I.box;
  let x0 = I.w, y0 = I.h, x1 = -1, y1 = -1;
  for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) if (I.px.d[(y * I.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return (I.box = { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
}
const lowLimb = (W, H) => { const top = Math.round(H * .8), d = Math.max(8, H - 1 - top), half = W / 2 + 6, r = (half * half + d * d) / (2 * d); return x => top + r - Math.sqrt(Math.max(0, r * r - (x - W / 2) * (x - W / 2))) };
export function islandFrame(w, n, W = VW, H = VH, style = CLOSE.style) {
  const k = closeK(W, style), I = getSprite(w, n, 'near', k), dawnS = style === 'dawn';
  const fk = [w.def.key, n.id, n.seed, k, W, H, dawnS].join();
  let F = FRAMES.get(fk);
  if (!F) {
    const spec = islandSpec(w, { ...n, stage: 4 }, 'near', k), b = opaqueBox(islandSprite({ ...spec, picks: [], gifts: [], falls: [] })), oy = I.oy;
    if (dawnS) {
      const G = dawnGeom(W, H), D = dawnFrame(G, b, oy, PROP_UP, W < 400 ? .3 : .28);
      F = { z: D.z, x: Math.round(D.cx - ((b.x0 + b.x1 + 1) / 2 - I.ox) * D.z), y: D.y, limb: G.limb };
    } else {
      const horizon = Math.round(H * .8), below = b.y1 + 1 - oy, z = [8, 7, 6, 5, 4, 3, 2].find(q => b.w * q <= W * .6 && (below + PROP_UP) * q <= horizon - H * LOW_GAP - q) || 1;
      F = { z, x: Math.round(W / 2), y: Math.round(horizon - H * LOW_GAP - z - below * z), limb: lowLimb(W, H), horizon };
    }
    FRAMES.set(fk, F); if (FRAMES.size > 64) FRAMES.delete(FRAMES.keys().next().value);
  }
  return { I, ...F };
}

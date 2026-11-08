// Close-ups, on the kit: the town square (planetView), one island big over a soft horizon (islandView), and the
// Long Dawn behind an unreached planet (dawn). Each starts from the kit's starfield (skyLayer), cached per canvas
// size like the city's background, so a frame copies it in and draws only what moves. A close-up never draws
// goods on islands. Reads the world; never writes to it.
import { TAU, P, B8, NN, pickR, rngf, worldView } from '../core/pixel.js';
import { PixCtx } from '../core/pixctx.js';
import { KD, R_ARM, R_IN, R_CORE, R_TEAL } from '../core/palette.js';
import { STY, skyLayer, twinkle, sun, planetLayer, glowAt, getSprite, drawIsland, isleBob } from './kit.js';
import { cityBackground, townLayout, citySky } from './city.js';

const VW = 200, VH = 120;

// ---------- the cached backgrounds ----------
const CBG = new Map();
const remember = (key, make) => { let B = CBG.get(key); if (B) return B; B = make(); CBG.set(key, B); if (CBG.size > 4) CBG.delete(CBG.keys().next().value); return B };
const sky2 = (w, off) => ((w.def.seedOffset | 0) * 131 + off) | 0;

// A soft planet horizon across the bottom of a W x H canvas: top at 80% of the height, wide enough that the bottom
// row is planet edge to edge.
function horizonBack(W, H, seed) {
  const px = new PixCtx(W, H), L = skyLayer(W, H, seed), top = Math.round(H * .8), d = Math.max(8, H - 1 - top), half = W / 2 + 6, r = (half * half + d * d) / (2 * d);
  px.putImageData(L.img, 0, 0);
  sun(px, W - Math.max(24, Math.round(W * .12)), Math.max(12, Math.round(H * .12)));
  planetLayer(px, W, H, W / 2, top + r, r, 1, 1, { rim: 6 });
  return { px, tw: L.tw.filter(s => px.px[s.y * W + s.x] === L.px.px[s.y * W + s.x]) };
}

// The town square of world w on a W x H canvas: TIDE's horizon and houses from the city, drawn at 3x over the kit's
// sky, with the lamps glowing.
const UP = 3;
export function planetView(c, game, w, t, W = VW, H = VH) {
  const hw = Math.ceil(W / UP), hh = Math.ceil(H / UP), stage = w.hub.stage, seed = sky2(w, 53);
  const B = remember(['town', W, H, w.def.key, stage, seed, game.seed].join(), () => {
    const v = { w: hw, h: hh, ...worldView(hw, hh) }, small = cityBackground(game, w, v), sm = citySky(game, w, hw, hh).px.px, L = skyLayer(W, H, seed), px = new PixCtx(W, H);
    px.putImageData(L.img, 0, 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = Math.floor(y / UP) * hw + Math.floor(x / UP); if (small.px.px[i] !== sm[i]) px.px[y * W + x] = small.px.px[i] }
    return { px, tw: L.tw.filter(s => px.px[s.y * W + s.x] === L.px.px[s.y * W + s.x]), lamps: townLayout(v, stage).lamps };
  });
  c.putImageData(B.px.img, 0, 0); twinkle(c, B.tw, t);
  B.lamps.forEach((l, i) => glowAt(c, l.x * UP, l.y * UP - 8, STY.book.win, .8 + .2 * Math.sin(t * .6 + i * 1.7)));
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

// Island n of world w at 2x the city's size, floating over a soft horizon under the stars. Whatever stage it is
// at shows (its picks, gifts and animation); goods are never drawn.
export function islandView(c, w, n, t, W = VW, H = VH) {
  const B = remember(['isl', W, H, sky2(w, 89)].join(), () => horizonBack(W, H, sky2(w, 89)));
  c.putImageData(B.px.img, 0, 0); twinkle(c, B.tw, t);
  const k = Math.max(1, 2 * worldView(W, H).k), I = getSprite(w, n, 'near', k), x = Math.round(W / 2), y = Math.round(H * .46 - I.h / 2 + I.oy) + isleBob(n, t);
  drawIsland(c, I, x, y, t);
}

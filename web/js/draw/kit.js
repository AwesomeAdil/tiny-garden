// The storybook pixel kit, ported from the page 45 mockup ("Storybook + warm light", STY.mixA there).
// Everything draws with whole-pixel fillRect, globalAlpha and putImageData, so it runs on a canvas 2D context
// or on PixCtx. Island sprites are pre-rendered into a transparent PixCtx and blitted each frame; only the
// animated bits (falls, smoke, lamp flicker, fireflies, willows, banners) are drawn live.
// The mockup's globals are gone: haze is a per-call wrapper (hazed) and every random stream is seeded per call.
import { P, mix, rngf, rgb, u32, B8, NN } from '../core/pixel.js';
import { PixCtx } from '../core/pixctx.js';
import { ISL_OCEAN, ISL_LAVA } from '../sim/content.js';
import { SPOTS, PIER_PICKS, MID_PICKS } from '../sim/picks.js';
import { pierSide, spotKind } from '../sim/grow.js';

// ---------- primitives ----------
export const CR = '#14151f', SKY = '#161722';
const MC = new Map();
const mixc = (a, b, t) => { const k = a + b + t; let v = MC.get(k); if (v === undefined) { v = mix(a, b, t); MC.set(k, v) } return v };
// A context whose every fill is mixed toward the sky by h (the mockup's HZ), for far islands and bridges.
export function hazed(c, h) {
  if (!h) return c;
  return {
    set fillStyle(s) { c.fillStyle = mixc(s, SKY, h) }, get fillStyle() { return c.fillStyle },
    set globalAlpha(a) { c.globalAlpha = a }, get globalAlpha() { return c.globalAlpha },
    fillRect: (x, y, w, hh) => c.fillRect(x, y, w, hh),
  };
}
export const A = (c, col, a, x, y, w = 1, h = 1) => { c.globalAlpha = a; P(c, col, x, y, w, h); c.globalAlpha = 1 };
export const sn = (x, s) => Math.sin(x * .9 + s) * .5 + Math.sin(x * .37 + s * 2.1) * .35 + Math.sin(x * 1.7 + s * .7) * .15;
export const BAY = [[0, .5], [.75, .25]];
export const bob = (t, ph = 0) => Math.round(Math.sin(t * .8 + ph) * .9);

// ---------- sky ----------
const DUST = ['#8aadf4', '#c6a0f6', '#f5a97f'], DUST_A = .06;
// 2-3 soft Bayer-dithered bands of colour, each pixel moved at most 6% toward its band's colour.
function stardust(px, W, H, seed) {
  const R = rngf(seed * 977 + 13), n = 2 + (R() < .5 ? 1 : 0), c0 = R() * 3 | 0, d = px.d, done = new Uint8Array(W * H);
  for (let b = 0; b < n; b++) {
    const [cr, cg, cb] = rgb(DUST[(c0 + b) % 3]), y0 = H * (.18 + R() * .64), slope = (R() - .5) * .7 * H / W, ww = H * (.07 + R() * .08), ph = R() * 50;
    for (let x = 0; x < W; x++) {
      const cy = y0 + slope * (x - W / 2) + sn(x * .03, ph) * ww * .8;
      for (let y = Math.max(0, Math.ceil(cy - ww)); y < Math.min(H, cy + ww); y++) {
        const q = Math.abs(y - cy) / ww, f = (1 - q) * (1 - q) * (.35 + .65 * NN(x * .7 + ph * 5, y * .7)), k = y * W + x;
        if (done[k] || f <= B8[((y & 7) << 3) | (x & 7)]) continue;
        done[k] = 1; const i = k * 4;
        d[i] += (cr - d[i]) * DUST_A; d[i + 1] += (cg - d[i + 1]) * DUST_A; d[i + 2] += (cb - d[i + 2]) * DUST_A;
      }
    }
  }
}
const SKIES = new Map();
// The starfield: a 3-step dithered gradient, stardust, faint fixed stars, and a list of twinkling ones.
// Cached by size and seed; returns {img (ImageData), px (PixCtx), tw}.
export function skyLayer(W, H, seed, o = {}) {
  const key = [W, H, seed, o.top, o.bot, o.glow].join();
  let L = SKIES.get(key); if (L) return L;
  const px = new PixCtx(W, H), R = rngf(seed);
  const top = o.top || '#101119', bot = o.bot || '#1c1f33', st = [top, mixc(top, bot, .34), mixc(top, bot, .67), bot], su = st.map(u32);
  for (let y = 0; y < H; y++) { const f = y / H * 3, i = Math.min(2, Math.floor(f)), fr = f - i; for (let x = 0; x < W; x++) px.px[y * W + x] = fr > BAY[y & 1][x & 1] + .12 ? su[i + 1] : su[i] }
  if (o.glow) { const [gx, gy, gr, gc] = o.glow; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - gx, (y - gy) * 1.3) / gr; if (d < 1 && (1 - d) * .9 > BAY[y & 1][x & 1] + .25) P(px, mixc(st[Math.min(3, Math.floor(y / H * 3))], gc, .1), x, y) } }
  stardust(px, W, H, seed);
  const n = Math.round(W * H / 140), tw = [];
  for (let i = 0; i < n; i++) { const x = R() * W | 0, y = R() * H | 0, b = R(); if (b < .7) P(px, b < .35 ? '#2a2d42' : '#3b3f55', x, y); else tw.push({ x, y, f: .6 + R() * 1.4, p: R() * 7, big: R() < .2 }) }
  L = { img: px.img, px, tw };
  SKIES.set(key, L); if (SKIES.size > 6) SKIES.delete(SKIES.keys().next().value);
  return L;
}
export function sun(c, x, y) { A(c, '#f5a97f', .18, x - 3, y - 2, 7, 5); A(c, '#f5a97f', .18, x - 2, y - 3, 5, 7); P(c, '#f5a97f', x - 1, y - 2, 3, 5); P(c, '#f5a97f', x - 2, y - 1, 5, 3); P(c, '#eed49f', x - 1, y - 1, 3, 3); P(c, '#fff4d6', x, y - 1) }
export function drawSky(c, L, t) { c.putImageData(L.img, 0, 0); twinkle(c, L.tw, t) }
// The twinkling stars of a sky layer (a list of {x, y, f, p, big}), drawn over whatever is there.
export function twinkle(c, tw, t) { for (const s of tw) { const b = Math.sin(t * s.f + s.p); if (b > -.2) P(c, b > .6 ? '#e3eafc' : '#8087a2', s.x, s.y); if (s.big && b > .75) { A(c, '#8087a2', .7, s.x - 1, s.y); A(c, '#8087a2', .7, s.x + 1, s.y); A(c, '#8087a2', .7, s.x, s.y - 1); A(c, '#8087a2', .7, s.x, s.y + 1) } } }

// A big planet disc with land, clouds, a lit rim and a dithered night side (TIDE on the horizon).
// o.rim: the lit rim's width in pixels (default the mockup's 4.5% of r); o.map(x, y) -> [X, Y]: where the
// land and clouds are looked up (default [x*fx, y*fy]), so a huge horizon curve can lay them along its surface.
export function planetLayer(c, W, H, cx, cy, r, fx = 1, fy = 1, o = {}) {
  const rimV = o.rim ? 1 - o.rim / r : .955;
  for (let y = Math.max(0, Math.floor(cy - r - 3)); y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > r + 3) continue;
    if (d > r) { const a = d > r + 2 ? .12 : d > r + 1 ? .3 : .55; if (BAY[y & 1][x & 1] < a * 1.4) P(c, '#7da2ec', x, y); continue }
    const v = d / r, [X, Y] = o.map ? o.map(x, y) : [x * fx, y * fy];
    const land = sn(X * .09 + 3, 2) + sn(X * .23 + Y * .35, 5) * .55 + sn(Y * .2 + X * .05, 1) * .4 > .62;
    const cloud = sn(X * .06 + Y * .9, 9) + sn(X * .2, 3) * .3 > .78;
    let col = land ? (sn(X * .4 + Y * .4, 7) > .3 ? '#86c487' : '#6aa57a') : '#5a7fd0';
    if (cloud && ((x + y) & 1 || sn(X * .3, 4) > .2)) col = '#e3eafc';
    if (v > rimV) col = mixc(col, '#c9dafb', .45);
    const shade = (dx / r) * 1.1 + (dy / r) * .4; if (shade > .25 + BAY[y & 1][x & 1] * .5) col = mixc(col, CR, .4); if (shade > .75 + BAY[y & 1][x & 1] * .3) col = mixc(col, CR, .35);
    P(c, col, x, y);
  }
}

// ---------- style ----------
// Page 45's mixA: Storybook's dark outline and bright flat colours, with a warm rim on the side facing the sun.
export const STY = {
  book: { outline: 1, dither: 0, strata: 0, rim: '#f5a97f', rock: ['#3b3f55', '#5b6079', '#7f849c', '#a5adcb'], top: '#a6da95', topL: '#d3f0c4', topD: '#5f9a68', soil: '#6e5a55', root: '#5f9a68', leaf: ['#4f8a5c', '#a6da95', '#d3f0c4'], pine: ['#2f6b62', '#58a89e', '#8bd5ca'], bark: '#8a6a5c', wall: '#f4dbd6', wallD: '#c9a58e', roof: '#ed8796', roofD: '#a8473f', win: '#eed49f', water: '#8aadf4', waterL: '#c9dafb', waterD: '#3f5fa8', wood: '#a98a7c', woodD: '#6e5a55', rope: '#8087a2', bare: ['#5b6079', '#7f849c', '#a5adcb'], glow: 0 },
};
const TYPES = { ...ISL_OCEAN, ...ISL_LAVA }, TSTY = new Map();
// STY.book tinted by an island type's rock and leaf colours (content.js lists them light to dark).
export function typeStyle(type) {
  const T = TYPES[type]; if (!T) return STY.book;
  let S = TSTY.get(type); if (S) return S;
  const r = T.rock, L = T.leaf;
  S = { ...STY.book, rock: [mixc(r[2], CR, .35), r[2], r[1], r[0]], bare: [r[2], r[1], r[0]], top: L[0], topL: mixc(L[0], '#ffffff', .45), topD: L[1], root: L[1], leaf: [L[2], L[1], L[0]] };
  TSTY.set(type, S);
  return S;
}

// ---------- props: s = static (into the sprite), a = animated (each frame) ----------
function blob(c, x, y, r, S) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r + r * .7) continue; const e = dx * .8 + dy; P(c, e > r * .45 ? S.leaf[0] : e < -r * .55 ? S.leaf[2] : S.leaf[1], x + dx, y + dy) } }
function ring(c, x, y, r) { for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) { const d = dx * dx + dy * dy; if (d <= (r + 1) * (r + 1) + r * .7) P(c, CR, x + dx, y + dy) } }
function tree(c, x, y, S, r = 5, h = 4, fruit = 0) {
  const cy = y - h - r + 1, parts = [[x, cy, r], [x - r + 1, cy + 2, r - 2], [x + r - 1, cy + 2, r - 2]];
  if (S.outline) { P(c, CR, x - 1, y - h, 3, h + 1); parts.forEach(p => ring(c, ...p)) }
  P(c, S.bark, x, y - h, 1, h + 1); P(c, S.bark, x - 1, y, 3, 1);
  parts.forEach(p => blob(c, ...p, S));
  if (fruit) [[-2, 0], [2, -1], [0, 2], [-3, 3], [3, 3], [1, -3]].forEach(([a, b]) => P(c, '#f5a97f', x + a, cy + b));
}
function pine(c, x, y, S, h = 9) { if (S.outline) for (let i = 0; i < h; i++) { const w = Math.floor((i + 1) / 2) + 1; P(c, CR, x - w, y - h + i, w * 2 + 1, 1) } for (let i = 0; i < h - 1; i++) { const w = Math.floor((i + 1) / 2); for (let d = -w; d <= w; d++) P(c, d < 0 ? S.pine[2] : d === w ? S.pine[0] : S.pine[1], x + d, y - h + 1 + i) } P(c, S.bark, x, y, 1, 1) }
const ROOFS = [null, ['#8aadf4', '#3f5fa8'], ['#eed49f', '#a98a7c']];
// rf picks a roof colouring (0 is the mockup's), flip puts the door on the right and the window on the left.
function house(c, x, y, S, w = 7, rf = 0, flip = 0) {
  const l = x - (w >> 1);
  if (rf) S = { ...S, roof: ROOFS[rf][0], roofD: ROOFS[rf][1] };
  if (S.outline) { P(c, CR, l - 1, y - 5, w + 2, 6); for (let i = 0; i < 5; i++) P(c, CR, l - 2 + i, y - 6 - i, w + 4 - i * 2, 1) }
  P(c, S.wall, l, y - 4, w, 5); P(c, S.wallD, l + w - 2, y - 4, 2, 5);
  for (let i = 0; i < 4; i++) { P(c, S.roof, l - 1 + i, y - 5 - i, w + 2 - i * 2, 1); P(c, S.roofD, l - 1 + i, y - 5 - i, 1, 1) }
  P(c, S.wood, flip ? l + w - 3 : l + 1, y - 2, 2, 3); P(c, S.win, flip ? l + 1 : l + w - 3, y - 3, 2, 2); P(c, S.woodD, l + w - 2, y - 9, 1, 3);
}
export function lamp(c, x, y, S) { if (S.outline) P(c, CR, x - 1, y - 6, 3, 7); P(c, S.woodD, x, y - 5, 1, 6); P(c, S.woodD, x - 1, y - 6, 3, 1); P(c, S.win, x, y - 5) }
export function glowAt(c, x, y, col, s) { A(c, col, .12 * s, x - 3, y - 2, 7, 5); A(c, col, .12 * s, x - 2, y - 3, 5, 7); A(c, col, .22 * s, x - 1, y - 1, 3, 3) }
function crystal(c, x, y, S, dh = [0, 0, 0, 0]) { [[0, 7, '#c6a0f6'], [-2, 4, '#9a72c9'], [2, 5, '#8aadf4'], [-1, 3, '#e0caf9']].forEach(([d, h0, col], i) => { const h = h0 + dh[i]; if (S.outline) P(c, CR, x + d - 1, y - h - 1, 3, h + 1); P(c, col, x + d, y - h, 1, h); P(c, '#f6eefe', x + d, y - h) }) }
// Gift variants 0-5 cycle three colourings; variant 0 is the mockup's.
const CORAL = [['#f5bde6', '#fbe0f3', '#a24f83'], ['#f5a97f', '#fbd5bd', '#a8473f'], ['#8bd5ca', '#d4f4ee', '#357a78']];
function coral(c, x, y, v = 0) { const [m, l, d] = CORAL[v % 3], pts = [[0, 0], [0, -1], [0, -2], [-1, -3], [-2, -4], [1, -3], [2, -4], [2, -5], [-2, -5], [0, -4], [0, -5], [-3, -6], [3, -6], [1, -6]]; pts.forEach(([a, b]) => P(c, m, x + a, y + b)); [[-3, -6], [3, -6], [0, -5]].forEach(([a, b]) => P(c, l, x + a, y + b)); P(c, d, x, y) }
function willow(c, x, y, t) { P(c, '#6e5a55', x, y - 7, 1, 8); for (let d = -5; d <= 5; d++) { const top = y - 9 + Math.round(Math.abs(d) * .4), len = 4 + ((d * 7 + 13) % 4); P(c, '#58a89e', x + d, top, 1, 1); for (let k = 1; k < len; k++) P(c, k % 2 ? '#8bd5ca' : '#357a78', x + d + (k > 2 && Math.sin(t * 1.2 + d) > .4 ? 1 : 0), top + k) } [[-4, -4], [2, -5], [4, -2], [-1, -3]].forEach(([a, b], i) => { if (Math.sin(t * 2 + i * 1.7) > 0) P(c, '#eefbf8', x + a, y + b) }) }
function spire(c, x, y) { [[0, 10, '#e3eafc'], [-2, 6, '#c9dafb'], [2, 7, '#b4c8f7'], [-3, 3, '#8aadf4'], [3, 4, '#c9dafb']].forEach(([d, h, col]) => { for (let i = 0; i < h; i++) P(c, col, x + d, y - i); P(c, '#ffffff', x + d, y - h + 1) }) }
function hut(c, x, y) { for (let i = 0; i < 4; i++) P(c, i ? '#9a72c9' : '#c6a0f6', x - 4 + i, y - 4 - i + (i > 2 ? 1 : 0), 9 - i * 2, 1); P(c, '#7350a0', x - 4, y - 3, 9, 4); P(c, '#f7d58f', x - 1, y - 2, 2, 2); P(c, '#4f3876', x + 2, y - 2, 1, 3) }
const FLAG = [['#8bd5ca', '#a6da95'], ['#c6a0f6', '#f5bde6'], ['#eed49f', '#f5a97f']];
function banner(c, x, y, t, v = 0) { const f = FLAG[v % 3]; P(c, '#6e5a55', x, y - 9, 1, 10); for (let i = 0; i < 4; i++) { const yy = y - 9 + i + Math.round(Math.sin(t * 3 + i) * .6); P(c, f[i % 2], x + 1 + i, yy, 1, 3) } }
function flowers(c, x, y, S, R) { for (let i = 0; i < 6; i++) P(c, ['#f5bde6', '#eed49f', '#f0c6c6'][i % 3], x + (R() * 12 - 6 | 0), y) }
function tuft(c, x, y, S) { P(c, S.topL, x, y - 1); P(c, S.topL, x + 2, y - 2); P(c, S.top, x + 1, y - 1); P(c, S.top, x + 3, y - 1) }
function fence(c, x, y, S, n = 4) { for (let i = 0; i < n; i++) P(c, S.wood, x + i * 2, y - 2, 1, 3); P(c, S.wood, x, y - 1, n * 2 - 1, 1) }
// A pool on the top: at the rim on a rim spot (so a fall can leave from it), else centred on the spot.
function pond(c, y, S, p) { const e = p.side < 0 ? -p.hw : p.side > 0 ? p.hw - 6 : p.x - 3; for (let i = 0; i < 7; i++) { P(c, i === 0 || i === 6 ? S.waterD : S.water, p.cx + e + i, y + 1); if (i > 0 && i < 6) P(c, i < 3 ? S.waterL : S.water, p.cx + e + i, y) } }
// Home centrepieces for types the mockup has none for, in its manner (outline first, then flat colour).
// A forge (anvil, kiln): a stone hearth with a glowing mouth and a chimney.
function forge(c, x, y, S, w = 7, flip = 0) {
  const l = x - (w >> 1), ch = flip ? l : l + w - 2;
  if (S.outline) { P(c, CR, l - 1, y - 5, w + 2, 6); P(c, CR, ch - 1, y - 9, 4, 5) }
  P(c, S.rock[2], l, y - 4, w, 5); P(c, S.rock[3], l, y - 4, w, 1); P(c, S.rock[1], l + w - 1, y - 3, 1, 4);
  P(c, S.rock[1], ch, y - 8, 2, 4); P(c, S.rock[3], ch, y - 8, 1, 4);
  const m = flip ? l + w - 4 : l + 1; P(c, CR, m, y - 2, 3, 3); P(c, '#f5a97f', m, y - 1, 3, 2); P(c, '#eed49f', m + 1, y - 1);
}
// An ember tree (ember, emberfall): a bare forked trunk with small glowing crowns at its tips.
function emberTree(c, x, y, S, h = 6, sp = 3) {
  const tips = [[x - sp, y - h - 1], [x + sp, y - h], [x, y - h - 3]];
  if (S.outline) { P(c, CR, x - 1, y - h - 1, 3, h + 2); tips.forEach(([a, b]) => ring(c, a, b, 1)); for (let i = 1; i <= sp; i++) { P(c, CR, x - i, y - h + 1 - i, 1, 3); P(c, CR, x + i, y - h + 2 - i, 1, 3) } }
  P(c, S.bark, x, y - h, 1, h + 1); P(c, S.bark, x - 1, y, 3, 1);
  for (let i = 1; i <= sp; i++) { P(c, S.bark, x - i, y - h + 2 - i); P(c, S.bark, x + i, y - h + 3 - i) }
  tips.forEach(([a, b]) => { P(c, S.leaf[1], a - 1, b, 3, 1); P(c, S.leaf[1], a, b - 1, 1, 3); P(c, S.leaf[2], a, b); P(c, S.leaf[0], a + 1, b) });
}
// A grove (verdant): three small trees, the middle one tallest, kept narrow so a tree on the spot beside it
// still reads as its own tree at city scale.
function grove(c, x, y, S, h = 5, a = 3, b = 2) { tree(c, x - 3, y, S, 2, a); tree(c, x + 3, y, S, 2, b); tree(c, x, y, S, 3, h) }

// Added for v2 picks the mockup has no art for, in the same manner: a few pixels with an outline.
function reeds(c, x, y, S) {
  const st = [[-2, 4], [0, 6], [2, 5], [3, 3]];
  if (S.outline) st.forEach(([d, h]) => P(c, CR, x + d - 1, y - h - 1, 3, h + 1));
  P(c, S.water, x - 3, y, 8, 1); P(c, S.waterL, x - 2, y, 2, 1);
  st.forEach(([d, h]) => { P(c, S.topD, x + d, y - h + 2, 1, h - 2); P(c, S.wood, x + d, y - h, 1, 2); P(c, S.woodD, x + d, y - h + 1) });
}
function stair(c, x, y, S) {
  if (S.outline) for (let i = 0; i < 4; i++) P(c, CR, x - 4 + i * 2 - 1, y - i - 1, 4, i + 2);
  for (let i = 0; i < 4; i++) { const bx = x - 4 + i * 2; P(c, S.rock[2], bx, y - i, 2, i + 1); P(c, S.rock[3], bx, y - i, 2, 1); P(c, S.rock[1], bx + 1, y - i + 1, 1, i) }
}
function cairn(c, x, y, S) {
  const st = [[-2, 0, 5, 2], [-1, -2, 3, 2], [-1, -4, 2, 2]];
  if (S.outline) st.forEach(([a, b, w, h]) => P(c, CR, x + a - 1, y + b - h, w + 2, h + 1));
  st.forEach(([a, b, w, h]) => { P(c, S.rock[2], x + a, y + b - h + 1, w, h); P(c, S.rock[3], x + a, y + b - h + 1); P(c, S.rock[1], x + a + w - 1, y + b) });
}
function quarry(c, x, y, S) {
  if (S.outline) { P(c, CR, x - 4, y - 4, 8, 5); P(c, CR, x + 3, y - 2, 4, 3); P(c, CR, x - 1, y - 7, 3, 3) }
  P(c, S.rock[2], x - 3, y - 3, 6, 4); P(c, S.rock[3], x - 3, y - 3, 6, 1); P(c, S.rock[1], x + 1, y - 2, 2, 3); P(c, S.rock[0], x - 1, y - 1, 1, 2);
  P(c, S.rock[2], x + 4, y - 1, 2, 2); P(c, S.rock[3], x + 4, y - 1);
  P(c, S.wood, x, y - 6, 1, 3); P(c, S.rock[3], x - 1, y - 6, 3, 1);
}

export const PROPS = {
  tree: { s: (c, x, y, S, p) => tree(c, x, y, S, p.r || 5, p.h || 4, p.fruit) },
  forge: { s: (c, x, y, S, p) => forge(c, x, y, S, p.w || 7, p.flip), a: (c, x, y, S, p, t) => { const w = p.w || 7, l = x - (w >> 1), m = p.flip ? l + w - 4 : l + 1, ch = p.flip ? l : l + w - 2; glowAt(c, m + 1, y - 1, '#f5a97f', Math.sin(t * 5) > -.5 ? .7 : .4); for (let i = 0; i < 3; i++) { const f = (t * .3 + i / 3) % 1; A(c, '#a5adcb', .5 * (1 - f), ch + Math.round(Math.sin(f * 5 + i)), y - 10 - Math.round(f * 8)) } } },
  emberTree: { s: (c, x, y, S, p) => emberTree(c, x, y, S, p.h || 6, p.sp || 3), a: (c, x, y, S, p, t) => { for (let i = 0; i < 3; i++) { const f = (t * .6 + i / 3) % 1; A(c, i % 2 ? '#f5a97f' : '#eed49f', 1 - f, x - 2 + i * 2, y - (p.h || 6) - 5 - f * 8) } } },
  grove: { s: (c, x, y, S, p) => grove(c, x, y, S, p.h || 5, p.a || 3, p.b || 2) },
  pine: { s: (c, x, y, S, p) => pine(c, x, y, S, p.h || 9) },
  house: { s: (c, x, y, S, p) => house(c, x, y, S, p.w || 7, p.rf, p.flip), a: (c, x, y, S, p, t) => { for (let i = 0; i < 3; i++) { const f = (t * .35 + i / 3) % 1; A(c, '#a5adcb', .5 * (1 - f), x + 1 + Math.round(Math.sin(f * 5 + i)), y - 10 - Math.round(f * 9)) } if (S.glow) glowAt(c, x + 1, y - 2, S.win, S.glow * (Math.sin(t * 1.3) > -.8 ? 1 : .6)) } },
  // The lamp flickers: its light dips now and then, and a soft glow follows it.
  lamp: { s: (c, x, y, S) => lamp(c, x, y, S), a: (c, x, y, S, p, t) => { const on = Math.sin(t * 1.7 + x) + Math.sin(t * 4.3 + 1) > -1.3; P(c, on ? S.win : '#f5a97f', x, y - 5); glowAt(c, x, y - 5, S.win, (S.glow || .45) * (on ? 1 : .5)) } },
  crystal: { s: (c, x, y, S, p) => crystal(c, x, y, S, p.dh), a: (c, x, y, S, p, t) => { if (S.glow || p.glow) glowAt(c, x, y - 4, '#c6a0f6', .8 + Math.sin(t * 2) * .2) } },
  coral: { s: (c, x, y, S, p) => coral(c, x, y, p.v) },
  willow: { a: (c, x, y, S, p, t) => { glowAt(c, x, y - 5, '#8bd5ca', .6); willow(c, x, y, t) } },
  spire: { s: (c, x, y) => spire(c, x, y) },
  hut: { s: (c, x, y) => hut(c, x, y), a: (c, x, y) => glowAt(c, x, y - 2, '#f7d58f', .6) },
  banner: { a: (c, x, y, S, p, t) => banner(c, x, y, t, p.v) },
  flowers: { s: (c, x, y, S, p) => flowers(c, x, y, S, rngf(p.seed || 4)) },
  tuft: { s: (c, x, y, S) => tuft(c, x, y, S) },
  fence: { s: (c, x, y, S, p) => fence(c, x - 3, y, S, p.n || 4) },
  stone: { s: (c, x, y, S) => { P(c, S.rock[2], x - 1, y - 1, 3, 1); P(c, S.rock[3], x - 1, y - 2, 2, 1); P(c, S.rock[1], x + 1, y - 1) } },
  pond: { s: (c, x, y, S, p) => pond(c, y, S, p) },
  waterfall: { s: (c, x, y, S, p) => pond(c, y, S, p) },
  reeds: { s: (c, x, y, S) => reeds(c, x, y, S) },
  stair: { s: (c, x, y, S) => stair(c, x, y, S) },
  cairn: { s: (c, x, y, S) => cairn(c, x, y, S) },
  quarry: { s: (c, x, y, S) => quarry(c, x, y, S) },
};
const FLAT = new Set(['pond', 'waterfall']);

// ---------- island sprite ----------
// Page 45's makeIsland. o = {S, hw, depth, seed, haze, bare, props:[{k, x, ...}], falls:[side], bloom}.
// Returns {px (transparent PixCtx), w, h, ox, oy (the top-centre anchor inside px), anim, ...}.
export function makeIsland(o) {
  const S = o.S || STY.book, hw = o.hw, depth = o.depth, seed = o.seed || 1, R = rngf(seed);
  const lobes = [{ x: 0, y: 0, h: hw, d: depth }], nl = o.lobes ?? (hw > 14 ? 2 : hw > 9 ? 1 : 0);
  for (let i = 0; i < nl; i++) lobes.push({ x: Math.round((i % 2 ? 1 : -1) * hw * (.3 + R() * .25)), y: Math.round(depth * (.3 + R() * .2)), h: Math.max(3, Math.round(hw * (.22 + R() * .12))), d: Math.round(depth * (.6 + R() * .3)) });
  const maxD = Math.max(...lobes.map(L => L.y + L.d)) + 1, top = o.top || 36, W = hw * 2 + 16, H = top + maxD + 12;
  const px = new PixCtx(W, H, { transparent: true }), c = hazed(px, o.haze || 0), cx = W >> 1, ty = top;
  const inL = (x, y) => { if (y < 0) return false; if (y <= 2) return Math.abs(x) <= hw - (y === 2 ? 1 : 0); for (const L of lobes) { const v = (y - L.y) / L.d; if (v < 0 || v > 1) continue; const half = L.h * Math.pow(1 - Math.pow(v, 1.5), .7) + sn(y * .8 + L.x, seed) * 1.1; if (Math.abs(x - L.x) <= half) return true } return false };
  const m = new Set(), key = (x, y) => x * 1000 + y, M = (x, y) => m.has(key(x, y));
  for (let y = 0; y <= maxD; y++) for (let x = -hw - 2; x <= hw + 2; x++) if (inL(x, y)) m.add(key(x, y));
  if (S.outline) for (let y = -1; y <= maxD + 1; y++) for (let x = -hw - 3; x <= hw + 3; x++) if (!M(x, y) && (M(x - 1, y) || M(x + 1, y) || M(x, y - 1) || M(x, y + 1))) P(c, CR, cx + x, ty + y);
  const boulders = []; for (let i = 0; i < Math.max(1, hw / 7); i++) boulders.push([Math.round((R() * 2 - 1) * hw * .6), Math.round(4 + R() * depth * .45), 1 + (R() * 2 | 0)]);
  for (let y = 0; y <= maxD; y++) for (let x = -hw - 2; x <= hw + 2; x++) {
    if (!M(x, y)) continue;
    const L = !M(x - 1, y), Rt = !M(x + 1, y), B = !M(x, y + 1);
    let lv = (1 - (x + hw) / (2 * hw)) * .5 + (1 - y / maxD) * .55;
    if (S.strata && (y + Math.round(sn(x * .3, seed) * 1.5)) % 5 === 0 && sn(x * .5 + y, seed + 2) < .45) lv -= .3;
    let q = lv * 3, i = Math.floor(q); if (S.dither && q - i > .62 && ((x + y) & 1)) i++;
    if (Rt || B) i = Math.min(i, 0); else if (L && y < maxD * .7) i = 3;
    i = Math.max(0, Math.min(3, i));
    let col = S.rock[i];
    if ((L || !M(x - 2, y)) && S.rim && y > 2 && y < maxD * .7) col = L ? S.rim : mixc(S.rim, S.rock[3], .5);
    for (const [bx, by, br] of boulders) { const dx = x - bx, dy = y - by; if (dx * dx + dy * dy <= br * br + br) col = dy > br - 1 ? S.rock[0] : (dx < 0 && dy < 0) ? S.rock[3] : S.rock[2] }
    if (y <= 2 && !o.bare) col = y === 2 && (x + seed) % 3 === 0 ? S.rock[1] : S.soil;
    P(c, col, cx + x, ty + y);
  }
  const bare = o.bare;
  for (let x = -hw - 1; x <= hw + 1; x++) {
    if (bare) { if (Math.abs(x) <= hw) { P(c, S.bare[2], cx + x, ty); P(c, S.bare[1], cx + x, ty + 1) } continue }
    P(c, S.topL, cx + x, ty - 1); P(c, S.top, cx + x, ty);
    if (R() < .35 || Math.abs(x) > hw - 1) P(c, S.topD, cx + x, ty + 1, 1, 1 + (R() * (Math.abs(x) > hw - 3 ? 4 : 2) | 0));
  }
  if (S.outline) { for (let x = -hw - 1; x <= hw + 1; x++) P(c, CR, cx + x, ty - 2); P(c, CR, cx - hw - 2, ty - 1, 1, 2); P(c, CR, cx + hw + 2, ty - 1, 1, 2) }
  // Hanging roots (grass-green on a grown island, bare rock strands on a stage-1 one).
  const lows = []; for (let x = -hw; x <= hw; x++) { let y = maxD; while (y > 0 && !M(x, y)) y--; if (y > 3 && !M(x, y + 1)) lows.push([x, y]) }
  const root = bare ? S.bare[0] : S.root, tip = bare ? S.bare[1] : S.topL;
  for (let k = 0; k < hw / 2.5 && lows.length; k++) { const [x, y] = lows[R() * lows.length | 0], len = 2 + (R() * (bare ? 2 : 6) | 0); for (let j = 1; j <= len; j++) P(c, j === len ? tip : root, cx + x + (j > 3 && x % 2 ? 1 : 0), ty + y + j) }
  const props = (o.props || []).map(p => ({ ...p, hw, cx }));
  props.forEach(p => { const pr = PROPS[p.k]; if (pr && pr.s) pr.s(c, cx + p.x, ty - 1, S, p) });
  const anim = props.filter(p => PROPS[p.k] && PROPS[p.k].a).map(p => ({ k: p.k, p }));
  for (const side of o.falls || (o.fall ? [o.fall] : [])) anim.push({ k: 'fall', side });
  if (o.bloom || S.glow === 1) anim.push({ k: 'flies' });
  return { px, w: W, h: H, ox: cx, oy: ty, anim, S, hw, depth: maxD, haze: o.haze || 0 };
}

function waterfall(c, x, y, L, S, t) {
  const T = Math.floor(t * 18);
  for (let i = 0; i < L; i++) { const yy = y - 1 + i, fade = i > L - 8 ? (L - i) / 8 : 1; for (let w = 0; w < 2; w++) { const ph = ((i - T + w * 2) % 5 + 5) % 5; A(c, ph < 2 ? S.waterL : ph < 4 ? S.water : S.waterD, fade * (w ? .75 : 1), x, yy) } P(c, S.water, x, yy) }
  for (let i = 0; i < L; i++) { const yy = y - 1 + i, fade = i > L - 8 ? (L - i) / 8 : 1, ph = ((i - T) % 5 + 5) % 5; A(c, ph < 2 ? S.waterL : S.water, fade * .8, x + 1, yy) }
  for (let k = 0; k < 6; k++) { const f = (t * .8 + k / 6) % 1; A(c, '#c9dafb', .5 * (1 - f), x - 2 + (k * 5) % 6, y + L - 6 - f * 4) }
}
const canvasOf = I => { if (!I.cv) { I.cv = document.createElement('canvas'); I.cv.width = I.w; I.cv.height = I.h; I.cv.getContext('2d').putImageData(I.px.img, 0, 0) } return I.cv };
// Draw a sprite with its top-centre at (x, y), then its animated bits.
export function drawIsland(c, I, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  if (c.blit) c.blit(I.px, x - I.ox, y - I.oy); else c.drawImage(canvasOf(I), x - I.ox, y - I.oy);
  const h = hazed(c, I.haze);
  for (const a of I.anim) {
    if (a.k === 'fall') waterfall(h, x + a.side * (I.hw + 2), y, Math.round(I.depth * .75) + 4, I.S, t);
    else if (a.k === 'flies') { for (let i = 0; i < 4; i++) { const fx = x + Math.sin(t * .5 + i * 2) * I.hw * .8, fy = y - 6 - (Math.sin(t * .7 + i) + 1) * 5; if (Math.sin(t * 1.4 + i * 3) > -.2) { A(h, '#eed49f', .35, fx - 1, fy, 3, 1); P(h, '#eed49f', fx, fy) } } }
    else PROPS[a.k].a(h, x + a.p.x, y - 1, I.S, a.p, t);
  }
}

// ---------- from game state ----------
// Stage 1 is bare rock, 2 grass and tufts, 3 adds the type's home prop, 4 blooms (flowers and fireflies).
export const BASE_HW = [0, 14, 18, 22, 26];
// Six evenly spaced slots on the top, rims outermost: spot 0, spot 1, the home prop, spot 4, spot 3, spot 2.
export const SPOT_X = [-.78, -.47, .78, .52, .16]; // x of each SPOTS entry, as a fraction of hw
const HOME_X = -.16;
const HOME = { house: 'house', forge: 'forge', sparks: 'emberTree', snow: 'pine', crystal: 'crystal', flowers: 'grove' };
// Shape parameters for a prop, drawn from its own seed, so the same prop differs from island to island.
const VARY = {
  tree: R => ({ r: 4 + (R() * 3 | 0), h: 3 + (R() * 3 | 0), fruit: R() < .3 ? 1 : 0 }),
  pine: R => ({ h: 7 + (R() * 4 | 0) }),
  house: R => ({ w: 6 + (R() * 3 | 0), rf: R() * 3 | 0, flip: R() < .5 ? 1 : 0 }),
  forge: R => ({ w: 6 + (R() * 3 | 0), flip: R() < .5 ? 1 : 0 }),
  emberTree: R => ({ h: 5 + (R() * 3 | 0), sp: 2 + (R() * 3 | 0) }),
  grove: (R, T) => ({ h: (T.treeH ? 6 : 4) + (R() * 3 | 0), a: 2 + (R() * 3 | 0), b: 2 + (R() * 3 | 0) }),
  crystal: R => ({ dh: [0, 0, 0, 0].map(() => (R() * 4 | 0) - 1) }),
};
const vary = (k, pseed, T = {}) => { const R = rngf(pseed); return { dx: (R() * 3 | 0) - 1, ...(VARY[k] ? VARY[k](R, T) : {}) } };
// The type's home centrepiece for an island (stage 3 and up): {k, x, ...shape}, x relative to the top centre.
export function homeProp(type, seed, hw) {
  const T = TYPES[type] || {}, k = HOME[T.deco] || 'house', v = vary(k, seed * 53 + 5, T);
  return { k, ...v, x: Math.round(hw * HOME_X) + v.dx };
}
export const BANDS = { far: { k: .7, haze: .55 }, mid: { k: .85, haze: .25 }, near: { k: 1, haze: 0 } };
// The depth band of a world y (islands higher up are farther away).
export const bandOf = y => y < 110 ? 'far' : y < 190 ? 'mid' : 'near';
// An island's bob, in whole pixels, from its seed (the same phase in every view and in the events).
export const isleBob = (n, t) => bob(t, (n.seed || 0) * 1.7);

// spec = {type, seed, stage, picks:[{spot, prop}], gifts:[{spot, kind, variant}], falls:[side], hw, depth, haze}
export function islandSprite(spec) {
  const st = Math.max(1, Math.min(4, spec.stage || 1)), hw = spec.hw ?? BASE_HW[st], seed = spec.seed || 1, T = TYPES[spec.type] || {};
  const R = rngf(seed * 131 + 7), at = (k, spot) => { const v = vary(k, seed * 7 + spot, T); return { k, ...v, x: Math.round(SPOT_X[spot] * hw) + v.dx, side: SPOTS[spot].side, seed: seed * 7 + spot } };
  const props = [];
  if (st >= 2) for (let i = 0; i < 2; i++) props.push({ k: 'tuft', x: Math.round((R() * 2 - 1) * hw * .7) });
  // Bloom goes down before the picks and the centrepiece, so it never paints over them.
  if (st >= 4) props.push({ k: 'flowers', x: Math.round(-hw * .62), seed: seed + 11 }, { k: 'flowers', x: Math.round(hw * .32), seed: seed + 12 });
  for (const p of spec.picks || []) if (PROPS[p.prop] && SPOTS[p.spot]) props.push(at(p.prop, p.spot));
  for (const g of spec.gifts || []) if (PROPS[g.kind] && SPOTS[g.spot]) props.push({ ...at(g.kind, g.spot), v: g.variant | 0 });
  // The centrepiece goes last: it stands in front of whatever grew on the spots beside it.
  if (st >= 3) props.push(homeProp(spec.type, seed, hw));
  props.sort((a, b) => FLAT.has(b.k) - FLAT.has(a.k));
  return makeIsland({ S: typeStyle(spec.type), hw, depth: spec.depth ?? Math.round(hw * .85), seed, haze: spec.haze || 0, bare: st === 1, props, falls: spec.falls || [], bloom: st >= 4 });
}

const PICK_PROP = Object.fromEntries([...Object.values(PIER_PICKS), ...Object.values(MID_PICKS)].flat().map(p => [p.id, p.prop]));
const RIMS = SPOTS.filter(s => s.side !== 0).map(s => s.i);
// The sprite spec for island n in depth band 'far' | 'mid' | 'near'. A fall forms on a rim with a waterfall
// pick, and on any rim where a bridge brings water in.
export function islandSpec(w, n, band) {
  const B = BANDS[band] || BANDS.near, st = Math.max(1, Math.min(4, n.stage || 1)), picks = [], gifts = [], falls = new Set();
  for (const [i, s] of Object.entries(n.spots || {})) {
    if (s.pick && PICK_PROP[s.pick]) picks.push({ spot: +i, prop: PICK_PROP[s.pick] });
    else if (s.gift) gifts.push({ spot: +i, kind: s.gift.kind, variant: s.gift.variant | 0 });
  }
  for (const i of RIMS) {
    if (PICK_PROP[n.spots?.[i]?.pick] === 'waterfall') falls.add(SPOTS[i].side);
    const k = spotKind(w, n, i); if (k.kind === 'pier' && k.good === 'water') falls.add(SPOTS[i].side);
  }
  const piers = w.S.ropes.filter(r => r.a === n.id || r.b === n.id).map(r => pierSide(w, n, r.id)).sort();
  const hw = Math.round(BASE_HW[st] * B.k);
  return { type: n.id, seed: n.seed, stage: st, picks, gifts, falls: [...falls].sort(), piers, hw, depth: Math.round(hw * .85), haze: B.haze };
}
const keyOf = (w, s, band) => `${w.def.key}|${s.type}|seed:${s.seed}|st:${s.stage}|p:${s.picks.map(p => p.spot + p.prop)}|g:${s.gifts.map(g => g.spot + g.kind + g.variant)}|piers:${s.piers}|falls:${s.falls}|${band}`;
// Changes only with the seed, stage, picks, gifts, pier sides, falls or band (never with time or walkers).
export const islandKey = (w, n, band) => keyOf(w, islandSpec(w, n, band), band);
export const SPRITES = new Map(); // LRU, at most 64
// A per-node memo of the key, so a frame where nothing changed skips islandSpec (a filter, a sort and a
// spotKind per rim). The stamp holds everything the spec reads: the node's seed, stage, spot and gift counts
// (a spot's pick or gift never changes once set), its position, and per bridge its id, way and the far
// end's x (the pier side) and sends (what arrives there).
export const SPEC_STATS = { builds: 0 };
const MEMO = new WeakMap();
function stampOf(w, n, band) {
  let s = `${w.def.key}|${n.seed}|${n.stage}|${n.spots ? Object.keys(n.spots).length : 0}|${n.gifts ? n.gifts.length : 0}|${n.x},${n.y}|${band}`;
  for (const r of w.S.ropes) {
    if (r.a !== n.id && r.b !== n.id) continue;
    const o = w.S.nodes.find(q => q.id === (r.a === n.id ? r.b : r.a));
    s += `|${r.id}:${r.way}:${o ? o.x : ''}:${o ? o.sends : ''}`;
  }
  return s;
}
export function getSprite(w, n, band) {
  let M = MEMO.get(n); if (!M) MEMO.set(n, M = {});
  const stamp = stampOf(w, n, band);
  let e = M[band];
  if (!e || e.stamp !== stamp) { const spec = islandSpec(w, n, band); SPEC_STATS.builds++; e = M[band] = { stamp, spec, key: keyOf(w, spec, band) } }
  const k = e.key, spec = e.spec;
  let s = SPRITES.get(k);
  if (s) { SPRITES.delete(k); SPRITES.set(k, s); return s }
  s = islandSprite(spec); SPRITES.set(k, s);
  if (SPRITES.size > 64) SPRITES.delete(SPRITES.keys().next().value);
  return s;
}

// ---------- bridges, piers, walkers ----------
export function span(x1, y1, x2, y2, sag) { const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1))), pts = []; for (let i = 0; i <= n; i++) { const f = i / n; pts.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f + sag * 4 * f * (1 - f)]) } return pts }
export function plank(c, pts, S = STY.book) { pts.forEach(([x, y], i) => { P(c, i % 3 === 2 ? S.woodD : S.wood, x, y); P(c, S.rope, x, y - 3); if (i % 8 === 0) P(c, S.woodD, x, y - 2, 1, 2) }) }
export function thread(c, pts, t) { pts.forEach(([x, y], i) => { P(c, '#5b6079', x, y); if ((i + Math.floor(t * 10)) % 14 === 0) P(c, '#c9dafb', x, y) }) }
export function along(pts, f) { const i = Math.max(0, Math.min(pts.length - 1, Math.round(f * (pts.length - 1)))); return pts[i] }
export function pier(c, x, y, S = STY.book, dir = -1) { const l = dir < 0 ? x - 4 : x; P(c, S.wood, l, y - 1, 5, 1); P(c, S.woodD, l, y, 5, 1); P(c, S.woodD, dir < 0 ? l : l + 4, y + 1, 1, 3); lamp(c, dir < 0 ? l : l + 4, y - 1, S) }
export function pierGlow(c, x, y, S = STY.book, dir = -1) { glowAt(c, dir < 0 ? x - 4 : x + 4, y - 6, S.win, .5) }
// The little astronaut, (x, y) = feet. st = stride frame, d = facing (+1/-1), cg = backpack colour.
export function astro(c, x, y, st, d, cg) { P(c, '#e3eafc', x - 1, y - 7, 3, 3); P(c, '#3f5fa8', x + (d > 0 ? 0 : -1), y - 6, 2, 1); P(c, '#cad3f5', x - 1, y - 4, 3, 2); P(c, cg, x - 2 * d, y - 5, 1, 3); if (st) { P(c, '#a5adcb', x - 1, y - 2, 1, 2); P(c, '#a5adcb', x + 1, y - 2, 1, 2) } else P(c, '#a5adcb', x, y - 2, 1, 2) }
const pp = (t, sp, off) => { const f = (t * sp + off) % 2; return f < 1 ? [f, 1] : [2 - f, -1] };
// An astronaut pacing a bridge back and forth (the mockup's demo walker).
export function walkOn(c, pts, t, sp, off, cg) { const [f0, d] = pp(t, sp, off), [x, y] = along(pts, .1 + f0 * .8); astro(c, x, y - 1, Math.floor(t * 6 + off * 9) % 2, d, cg) }

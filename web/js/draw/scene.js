// Scene pieces shared by every view, ported from page 38. Nothing here reads or writes sim state:
// callers pass the island defs, node and time they want drawn.
import { TAU, SP, D, P, mix, rngf } from '../core/pixel.js';
import { C } from '../core/palette.js';

export const VW = 200, VH = 120;

// A star: three nested discs and a soft dithered halo. S = {r, core, mid, edge}.
export function star(c, x, y, S) {
  x = Math.round(x); y = Math.round(y); const r = S.r, circle = (R, col) => { c.fillStyle = col; for (let j = -R; j <= R; j++) { const w = Math.floor(Math.sqrt((R + .3) * (R + .3) - j * j)); c.fillRect(x - w, y + j, 2 * w + 1, 1) } };
  const Rr = Math.round(r + 3 + r * .38); c.fillStyle = S.edge; for (let R = Rr; R > r; R--) { const q = (R - r) / (Rr - r); c.globalAlpha = .16 * Math.pow(1 - q, 1.4) + .012; for (let j = -R; j <= R; j++) { const w = Math.floor(Math.sqrt((R + .3) * (R + .3) - j * j)); c.fillRect(x - w, y + j, 2 * w + 1, 1) } } c.globalAlpha = 1;
  circle(r, S.edge); circle(Math.max(1, Math.round(r * .86)), S.mid); circle(Math.max(1, Math.round(r * .58)), S.core);
}

// A lit sphere; f(u,v,t) is a surface routine from palette.js SURF.
export function planet(c, f, x, y, r, t, lx = -.6, ly = -.5, lz = .62) {
  x = Math.round(x); y = Math.round(y);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j > (r + .3) * (r + .3)) continue; const nx = i / r, ny = j / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), u = (((Math.atan2(nx, nz) / TAU + .5 + t * .012) % 1) + 1) % 1, v = Math.asin(ny) / Math.PI + .5, L = nx * lx + ny * ly + nz * lz; let col = f(u, v, t);
    const lit = L + (D(x + i, y + j) - .5) * .2; if (lit < .05) col = mix(col, SP, .74); else if (L > .965) col = mix(col, '#ffffff', .4); c.fillStyle = col; c.fillRect(x + i, y + j, 1, 1);
  }
}

export function rock(c, x, y, r, seed = 1, pal = ['#a5adcb', '#7f849c', '#494d64']) {
  x = Math.round(x); y = Math.round(y); const R = Math.ceil(r * 1.3);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const a = Math.atan2(j, i), rr = r * (1 + .13 * Math.sin(a * 3 + seed) + .08 * Math.sin(a * 5 + seed * 2.3)); if (Math.hypot(i, j) > rr) continue; const lit = (-i - j) / (r * 1.5) + (D(x + i, y + j) - .5) * .3; P(c, lit > .35 ? pal[0] : lit > -.3 ? pal[1] : pal[2], x + i, y + j) }
}

// Background stars for the close-up sky. One seeded stream, as on page 38: the first 360 draws were the
// map's stars (bg, now the kit's skyLayer), skipped so VST keeps its positions.
const rnd = (() => { let a = 9; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } })();
for (let i = 0; i < 360; i++) rnd();
const VST = Array.from({ length: 40 }, () => [rnd() * VW, rnd() * 70, rnd() * 6.28]);

// A point along bridge b = [x0,y0,x1,y1,sag] at s in 0..1.
export const pt = (b, s) => ({ x: b[0] + (b[2] - b[0]) * s, y: b[1] + (b[3] - b[1]) * s + (b[4] || 0) * Math.sin(Math.PI * s) });

export function stream(c, b, t, col) { const n = Math.ceil(Math.hypot(b[2] - b[0], b[3] - b[1])); for (let i = 0; i <= n; i++) { const q = pt({ 0: b[0], 1: b[1], 2: b[2], 3: b[3], 4: 0 }, i / n); P(c, mix(col, SP, .72), q.x, q.y); if (((i + Math.floor(t * 14)) % 4) === 0) { P(c, col, q.x, q.y); P(c, '#ffffff', q.x, q.y - 1) } } }

// The town-square tree: a seeded branch-and-leaf-pad layout, built once.
function makeTree(seed) {
  const r = rngf(seed), segs = [], leaves = [], rad = d => d * Math.PI / 180;
  const pad = (cx, cy, rx, ry, b, d) => { const n = Math.round(300 * rx / .2); for (let i = 0; i < n; i++) { const a = r() * 6.283, m = Math.sqrt(r()), dx = Math.cos(a) * m, dy = Math.sin(a) * m; leaves.push({ x: cx + dx * rx, y: cy + dy * ry, v: dy, b: b + r() * .32, d, f: r() < .055 && dy > 0, ph: r() * 6.283, k: r() }) } };
  let x = 0, y = 0, side = 1; const n = 6; pad(.0, .09, .06, .035, 0, .32);
  for (let i = 0; i < n; i++) {
    const ang = 90 + side * (16 + r() * 12), len = .135, b = i / n * .55, nx = x + Math.cos(rad(ang)) * len, ny = y + Math.sin(rad(ang)) * len; segs.push({ x0: x, y0: y, x1: nx, y1: ny, w: 1 - i / n * .72, b }); x = nx; y = ny;
    if (i >= 1 && i < n - 1) { const s = (i % 2 ? 1 : -1), L = .2 - .018 * i, bb = b + .05, a1 = s > 0 ? 22 : 158, a2 = s > 0 ? 4 : 176, mx = x + Math.cos(rad(a1)) * L * .6, my = y + Math.sin(rad(a1)) * L * .6, ex = mx + Math.cos(rad(a2)) * L * .75, ey = my + Math.sin(rad(a2)) * L * .75; segs.push({ x0: x, y0: y, x1: mx, y1: my, w: .32, b: bb }, { x0: mx, y0: my, x1: ex, y1: ey, w: .2, b: bb + .07 }); pad(ex, ey + .05, .21 - .018 * i, .092, bb + .1) }
    side = -side;
  }
  pad(x, y + .05, .17, .1, .56); leaves.sort((a, b) => a.v - b.v); return { segs, leaves };
}
const TREE = makeTree(11);

export function pxTree(c, ox, oy, sc, t) {
  const g = 1; TREE.segs.forEach(s => {
    const w = Math.max(1, Math.round(s.w * (1.5 + 5 * g) * sc / 50)), st = Math.max(1, Math.ceil(Math.hypot(s.x1 - s.x0, s.y1 - s.y0) * sc));
    for (let i = 0; i <= st; i++) { const q = i / st, x = ox + (s.x0 + (s.x1 - s.x0) * q) * sc, y = oy - (s.y0 + (s.y1 - s.y0) * q) * sc; P(c, C.barkD, x - w / 2, y, w, 1); if (w > 1) P(c, C.bark, x - w / 2, y, Math.ceil(w / 2), 1) }
  });
  TREE.leaves.forEach(l => { if (l.d && g > l.d) return; const nudge = Math.sin(t * .7 + l.ph) > .82 ? 1 : 0, x = ox + l.x * sc + nudge, y = oy - l.y * sc; if (l.f) P(c, C.flower, x, y); else P(c, l.v > .35 ? C.leaf : l.v > -.25 ? C.leafM : C.leafD, x, y, l.k > .55 ? 2 : 1, 1) });
}

export function snail(c, x, y, flip) { const X = dx => flip ? x + 7 - dx : x + dx; [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]].forEach(p => P(c, C.warm, X(p[0]), y + p[1])); P(c, C.crust, X(2), y + 1); for (let i = 0; i < 7; i++)P(c, C.glow, X(i), y + 3); P(c, C.glow, X(6), y + 2); P(c, C.glow, X(7), y + 1) }
export function lantern(c, x, y, t) { P(c, C.rock, x + 1, y, 5, 1); P(c, C.rock, x, y + 1, 7, 1); P(c, C.rock, x + 2, y + 2, 3, 3); P(c, Math.sin(t * .6) > -.7 ? C.glow : C.warm, x + 3, y + 3); P(c, C.rock, x + 3, y + 5, 1, 3); P(c, C.rock, x + 1, y + 8, 5, 1) }
export function tuft(c, x, y, t, ph, col) { const n = Math.sin(t * .8 + ph) > .5 ? 1 : 0; P(c, col, x, y - 1); P(c, col, x + n, y - 2); P(c, col, x + 2, y - 1); P(c, col, x + 2 + n, y - 3) }
export function firefly(c, x, y, t, ph) { if (Math.sin(t * 1.1 + ph) < -.35) return; P(c, C.glow, x, y); c.globalAlpha = .3; P(c, C.glow, x - 1, y); P(c, C.glow, x + 1, y); P(c, C.glow, x, y - 1); P(c, C.glow, x, y + 1); c.globalAlpha = 1 }

// The close-up night sky (VW x VH by default). A wider or taller one keeps the gradient on the bottom VH rows
// (dy is the extra height above them) and repeats the 200x70 star patch across the rest.
export function sky(c, t, w = VW, h = VH, dy = 0) {
  for (let y = 0; y < h; y++)P(c, mix(C.crust, C.base, Math.max(0, Math.min(1, (y - dy) / 90))), 0, y, w, 1);
  const ox0 = Math.round((w - VW) / 2), sx = ox0 - Math.ceil(ox0 / VW) * VW, col = mix(C.sub, C.crust, .35);
  for (let oy = dy; oy > -70; oy -= 70) for (let ox = sx; ox < w; ox += VW) VST.forEach(s => { if (Math.sin(t * .5 + s[2] + ox * .01 + oy * .02) > -.3 && s[1] + oy < h) P(c, col, s[0] + ox, s[1] + oy) });
}

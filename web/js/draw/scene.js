// Scene pieces shared by every view, ported from page 38. Nothing here reads or writes sim state:
// callers pass the island defs, node and time they want drawn.
import { TAU, SP, D, P, mix, rngf } from '../core/pixel.js';
import { C, HEAT, RES } from '../core/palette.js';
import { goodsCanvas } from '../core/icons.js';

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

// Background stars. One seeded stream, drawn in this order (ST then VST), as on page 38.
const rnd = (() => { let a = 9; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } })();
const ST = Array.from({ length: 90 }, () => [rnd(), rnd(), rnd(), rnd() * 6]);
const VST = Array.from({ length: 40 }, () => [rnd() * VW, rnd() * 70, rnd() * 6.28]);

export function bg(c, w, h, t, n = 26) { P(c, SP, 0, 0, w, h); ST.slice(0, n).forEach(s => { if (Math.sin(t * .7 + s[3]) < -.5) return; P(c, s[2] > .72 ? '#cad3f5' : '#494d64', s[0] * w, s[1] * h) }) }

// A point along bridge b = [x0,y0,x1,y1,sag] at s in 0..1.
export const pt = (b, s) => ({ x: b[0] + (b[2] - b[0]) * s, y: b[1] + (b[3] - b[1]) * s + (b[4] || 0) * Math.sin(Math.PI * s) });

export function stream(c, b, t, col) { const n = Math.ceil(Math.hypot(b[2] - b[0], b[3] - b[1])); for (let i = 0; i <= n; i++) { const q = pt({ 0: b[0], 1: b[1], 2: b[2], 3: b[3], 4: 0 }, i / n); P(c, mix(col, SP, .72), q.x, q.y); if (((i + Math.floor(t * 14)) % 4) === 0) { P(c, col, q.x, q.y); P(c, '#ffffff', q.x, q.y - 1) } } }

export function walker(c, x, y, step, cargo) {
  x = Math.round(x); y = Math.round(y); const f = Math.floor(step * 5) % 2;
  P(c, '#3a3d55', x - 1 + f, y - 1); P(c, '#3a3d55', x + 1 - f, y - 1); P(c, '#f5a97f', x - 1, y - 4, 3, 3); P(c, '#e6eaf8', x - 1, y - 6, 3, 2); P(c, '#8aadf4', x, y - 6); if (cargo) { P(c, cargo, x - 1, y - 9, 3, 3); P(c, '#ffffff', x - 1, y - 9) }
}

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

// A bridge leaving a close-up: deck, handrail and posts, getting smaller as it heads off into the distance.
export function bridgeOut(c, b, lvl, tang) {
  const n = Math.ceil(Math.hypot(b[2] - b[0], b[3] - b[1])) * 2;
  for (let k = 0; k <= n; k++) {
    const s = k / n, q = pt(b, s), w = .35 + .65 * s, x = q.x, y = q.y, red = tang && k % 6 === 0;
    if (lvl === 2) { P(c, red ? '#ed8796' : '#a5adcb', x, y); P(c, '#6e738d', x, y + Math.max(1, Math.round(3 * w))); if (k % Math.max(2, Math.round(8 * w)) === 0) P(c, '#494d64', x, y + 1, 1, Math.max(1, Math.round(2 * w))) }
    else {
      const th = Math.max(1, Math.round((lvl === 1 ? 3 : 2) * w)), gap = Math.max(2, Math.round(6 * w)), hr = Math.round((lvl === 1 ? 5 : 7) * w);
      P(c, red ? '#ed8796' : (k % gap === 0 ? '#5b4a44' : (lvl === 1 ? '#c9a58e' : '#a5826e')), x, y, 1, th);
      if (hr >= 2) { P(c, red ? '#ed8796' : '#8a7064', x, y - hr); if (k % (gap * 2) === 0) P(c, '#6e5a55', x, y - hr, 1, hr) }
    }
  }
}

// A floating island of half-width w. ISL is the world's island defs (w.def.isl), k the island id.
export function island(c, ISL, x, y, w, k, t, big) {
  const s = ISL[k], sc = big ? 2 : 1; x = Math.round(x); y = Math.round(y);
  for (let dx = -w; dx <= w; dx++) {
    const depth = Math.round((1 - Math.pow(Math.abs(dx) / w, 1.5)) * w * .85 + Math.sin(dx * .7 + w) * 1.2); for (let j = 1; j <= depth; j++) { const lit = (-dx / w) * .4 - (j / depth) * .9 + (D(x + dx, y + j) - .5) * .3; P(c, lit > 0 ? '#6e738d' : lit > -.5 ? '#494d64' : '#2b2e42', x + dx, y + j) }
    P(c, s.top, x + dx, y); P(c, mix(s.top, '#ffffff', .25), x + dx, y - 1); if (s.pine) P(c, '#ffffff', x + dx, y - 1);
  }
  const L = s.leaf, blob = (bx, by, r) => { for (let j = -r; j <= r; j++) for (let i = -r - 1; i <= r + 1; i++) { if (i * i * .7 + j * j > r * r + .5) continue; P(c, j < -r / 3 ? L[0] : j < r / 3 ? L[1] : L[2], bx + i, by + j) } };
  if (s.deco === 'crystal') { [[-3, 6], [0, 9], [3, 5], [-6, 4]].forEach(([dx, h]) => { for (let j = 0; j < h * sc; j++) { const ww = Math.max(1, Math.round((1 - j / (h * sc)) * 2 * sc)); P(c, j > h * sc * .6 ? L[0] : L[1], x + dx * sc - ww + 1, y - 1 - j, ww, 1) } }); if (Math.floor(t * 2) % 3 === 0) P(c, '#ffffff', x, y - 8 * sc); return }
  if (s.deco === 'forge') { P(c, '#5b6079', x - 4 * sc, y - 6 * sc, 9 * sc, 6 * sc); P(c, '#363a4f', x - 5 * sc, y - 7 * sc, 11 * sc, sc); P(c, '#494d64', x + 2 * sc, y - 10 * sc, 2 * sc, 3 * sc); P(c, Math.sin(t * 4) > 0 ? '#eed49f' : HEAT, x - sc, y - 4 * sc, 2 * sc, 4 * sc); if (Math.sin(t * 3) > 0) P(c, '#6e738d', x + 3 * sc, y - 12 * sc - Math.floor(t * 3) % 3); return }
  const tx = x + (s.treeDx || 0) * sc, th = (s.treeH || 6) * sc; P(c, '#a98a7c', tx, y - th, sc, th); P(c, '#7a6258', tx + sc, y - th + 2, sc, th - 2);
  if (s.pine) { for (let j = 0; j < 4; j++) { const ww = (4 - j) * sc; P(c, L[j % 2], tx - ww + 1, y - th - j * 2 * sc, ww * 2 - 1, 2 * sc) } P(c, '#ffffff', tx, y - th - 8 * sc, sc, sc) }
  else { blob(tx, y - th - 2 * sc, 3 * sc); if (s.grove) { blob(tx - 4 * sc, y - th, 2 * sc); blob(tx + 4 * sc, y - th + sc, 2 * sc) } }
  if (s.deco === 'house') { const hx = x + 3 * sc, hy = y - 1; P(c, '#c9a58e', hx, hy - 4 * sc, 5 * sc, 4 * sc); P(c, '#a8473f', hx - sc, hy - 5 * sc, 7 * sc, sc); P(c, '#eed49f', hx + 2 * sc, hy - 3 * sc, sc, sc) }
  if (s.deco === 'sparks') { for (let i = 0; i < 3; i++) { const s2 = (t * .6 + i / 3) % 1; P(c, i % 2 ? HEAT : '#eed49f', tx - 2 + i * 2, y - th - 5 * sc - s2 * 8 * sc) } }
  if (s.deco === 'snow') { for (let i = 0; i < 4; i++) { const s2 = (t * .3 + i / 4) % 1; P(c, '#ffffff', x - w + ((i * 7) % (2 * w)), y - 14 * sc + s2 * 12 * sc) } }
  if (s.deco === 'flowers') { [-6, -3, 4, 7].forEach((dx, i) => P(c, i % 2 ? '#f5bde6' : '#eed49f', x + dx * sc, y - 1 - sc)) }
}

// What an island has grown into: docks, then a tree, grass and a lamp at level 2, then a house and flowers at 3.
export function levelDeco(c, x, y, w, n, t, sc) {
  const lvl = n.level;
  for (let d = 0; d < (n.dock || 0); d++) { const px0 = x + (d % 2 ? -w - 6 * sc : w - sc), py = y + 1 + Math.floor(d / 2) * 2 * sc; P(c, '#a98a7c', px0, py, 7 * sc, sc); for (let q = 0; q < 7 * sc; q += 2 * sc)P(c, '#7a6258', px0 + q, py, 1, sc); P(c, '#6e5a55', d % 2 ? px0 : px0 + 6 * sc, py, sc, 3 * sc); P(c, '#c9a58e', d % 2 ? px0 : px0 + 6 * sc, py - sc, sc, sc) }
  if (lvl >= 2) {
    const tx = x - w + 4 * sc; P(c, '#7a6258', tx, y - 4 * sc, sc, 4 * sc); for (let j = -2; j <= 1; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 4) P(c, j < 0 ? '#a6da95' : '#5f9a68', tx + i * sc, y - 6 * sc + j * sc, sc, sc);
    for (let i = 0; i < 4; i++)P(c, '#a6da95', x - w * .6 + i * w * .4, y - 1, sc, sc);
    const lx = x + w - 3 * sc; P(c, '#494d64', lx, y - 6 * sc, sc, 6 * sc); P(c, Math.sin(t * .7) > -.8 ? '#eed49f' : '#f5a97f', lx - (sc > 1 ? 1 : 0), y - 7 * sc, sc + (sc > 1 ? 2 : 0), sc);
  }
  if (lvl >= 3) {
    const hx = x + w * .5, hy = y - 1; P(c, '#c9a58e', hx, hy - 3 * sc, 4 * sc, 3 * sc); P(c, '#ed8796', hx - sc, hy - 4 * sc, 6 * sc, sc); P(c, '#ed8796', hx, hy - 5 * sc, 4 * sc, sc); P(c, '#eed49f', hx + sc, hy - 2 * sc, sc, sc);
    [-.75, -.45, .1, .6].forEach((f, i) => P(c, i % 2 ? '#f5bde6' : '#eed49f', x + f * w, y - 1 - sc, sc, sc));
    if (sc > 1) for (let i = 0; i < 3; i++) { const ph = i * 2.1, fx = x - w * .5 + i * w * .5 + Math.sin(t * .5 + ph) * 4, fy = y - 16 + Math.cos(t * .7 + ph) * 3; if (Math.sin(t * 1.1 + ph) > -.35) P(c, '#eed49f', fx, fy) }
  }
}

// Goods sit on the ground and stack as stock grows: 1 to 3 high.
export function piles(c, x, y, stock, div, maxK = 3) { const ks = RES.filter(k => stock[k] > 0).sort((a, b) => stock[b] - stock[a]).slice(0, maxK); ks.forEach((k, i) => { const n = Math.min(3, Math.ceil(stock[k] / (div * 4))); for (let j = 0; j < n; j++)c.drawImage(goodsCanvas(k), x + i * 12 + (j === 2 ? 4 : j * 8) - (n > 1 && j < 2 ? 2 : 0), y - 8 - (j === 2 ? 7 : 0)) }) }

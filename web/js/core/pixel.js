// DOM-free pixel helpers shared by the sim and the drawing code.
export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('') };
export const u32 = h => { const [r, g, b] = rgb(h); return (255 << 24 | b << 16 | g << 8 | r) >>> 0 };
export const ramp = a => a.map(u32);
export function rngf(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// ---- canvas helpers (page 38) ----
export const SP = '#14151f';
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16);
export const D = (x, y) => bayer[((y & 3) << 2) | (x & 3)];
export const P = (c, col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h) };
export const tri = x => { x = ((x % 1) + 1) % 1; return x < .5 ? x * 2 : 2 - x * 2 };

// Value noise (256x256, 4 octaves) and an 8x8 Bayer matrix, used by the dawn and the galaxy.
export const NZ = new Float32Array(65536);
(function () { const r = rngf(9); [[8, 1], [16, .5], [32, .25], [64, .13]].forEach(([g, w]) => { const grid = new Float32Array(g * g).map(() => r()); for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const fx = x / 256 * g, fy = y / 256 * g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (x0 + 1) % g, y1 = (y0 + 1) % g; NZ[y * 256 + x] += ((grid[y0 * g + x0] * (1 - sx) + grid[y0 * g + x1] * sx) * (1 - sy) + (grid[y1 * g + x0] * (1 - sx) + grid[y1 * g + x1] * sx) * sy) * w } }); let mn = 9, mx = -9; NZ.forEach(v => { mn = Math.min(mn, v); mx = Math.max(mx, v) }); NZ.forEach((v, i) => NZ[i] = (v - mn) / (mx - mn)) })();
export const NN = (u, v) => NZ[(((v | 0) & 255) << 8) | ((u | 0) & 255)];
export const B8 = new Float32Array(64);
[[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]].forEach((r, y) => r.forEach((v, x) => B8[y * 8 + x] = v / 64));
export const pickR = (R, val, b) => { let i = Math.floor(Math.min(1, val) * (R.length - 1) + b); if (i >= R.length) i = R.length - 1; return R[i < 0 ? 0 : i] };

// ---- view scale (in device pixels of the stage) ----
// The world is 640x300 (sim/content.js W, H); core/ must not import sim/, so the numbers are repeated here.
const WORLD_W = 640, WORLD_H = 300;
// Pixel size follows the screen: s = max(2, round(stageHeight / 480)), lowered until the canvas fits the whole world.
export const viewScale = (dW, dH) => {
  let s = Math.max(2, Math.round(dH / 480));
  while (s > 1 && (Math.floor(dW / s) < WORLD_W || Math.floor(dH / s) < WORLD_H)) s--;
  return { s, w: Math.max(1, Math.floor(dW / s)), h: Math.max(1, Math.floor(dH / s)) };
};
// Where the world's top-left sits on a w x h canvas (the world is centred).
export const worldOffset = (w, h) => ({ ox: Math.floor((w - WORLD_W) / 2), oy: Math.floor((h - WORLD_H) / 2) });
// How drawing maps the world onto a w x h canvas: canvas = world * k + (ox, oy), k = min(w/640, h/300), centred.
// The sim stays in world units; sprites are built natively at the mapped size, never scaled bitmaps.
export const worldView = (w, h) => { const k = Math.min(w / WORLD_W, h / WORLD_H); return { k, ox: Math.floor((w - WORLD_W * k) / 2), oy: Math.floor((h - WORLD_H * k) / 2) } };
// A canvas point back to world units, and a world point onto the canvas, for a view {k, ox, oy}.
export const toWorld = (v, p) => ({ x: (p.x - v.ox) / (v.k || 1), y: (p.y - v.oy) / (v.k || 1) });
export const toCanvas = (v, x, y) => [v.ox + x * (v.k || 1), v.oy + y * (v.k || 1)];

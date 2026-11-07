// The solar system, "D3 + Dusk" (page 43), at any canvas size: a flatter tilted orbital plane, long-exposure
// orbit trails, the glass cable, and a dithered teal-blue dusk around the sun. Nothing sits around the planets.
// The sim keeps its own orbit space (centred on [160,100], see sim/system.js); only the drawing is transformed.
// Orbit time is world 0's S.time; t is wall-clock animation time. Never writes to the game.
import { TAU, SP, P, B8, mix, rgb, u32, rngf, clamp } from '../core/pixel.js';
import { COL, SURF, KD, R_CORE, R_DUSK, ORBIT } from '../core/palette.js';
import { sysPlanets, cableGeom } from '../sim/system.js';

const GT = game => game.worlds[0].S.time;
// The plane: ratio .34, rolled -0.1 rad. Orbit scale 1.6 at 688x288, fitted to the canvas otherwise.
const RATIO = .34, ROLL = -.1, K0 = 1.6, SUN_R = 10;
export const sysView = (W, H) => ({ W, H, cx: Math.floor(W / 2), cy: Math.floor(H / 2), k: K0 * Math.min(W / 688, H / 288), sr: Math.sin(ROLL), cr: Math.cos(ROLL) });
// A point on the plane at orbit angle a and radius R, on the canvas.
export const planeXY = (v, a, R) => { const x = Math.cos(a) * R * v.k, y = Math.sin(a) * R * v.k * RATIO; return [v.cx + x * v.cr - y * v.sr, v.cy + x * v.sr + y * v.cr] };
export const sysXY = (v, p, T) => planeXY(v, p.a + T * p.v, p.R);
// Planets on the far half of their orbit (above the sun on screen) go behind it.
const isFar = (p, T) => Math.sin(p.a + T * p.v) < 0;
const radius = (v, p) => Math.max(2, Math.round((p.r + (p.r >= 10 ? 2 : 1)) * v.k / K0));

// Colour helpers, cached: each surface only has a handful of colours.
const MX = new Map(), SATC = new Map();
const mx = (a, b, t) => { const k = a + b + t; let v = MX.get(k); if (v === undefined) { v = mix(a, b, t); MX.set(k, v) } return v };
// Dusk pushes each surface colour away from its own grey by 1.25.
const sat = c => { let v = SATC.get(c); if (v === undefined) { const q = rgb(c), m = (q[0] + q[1] + q[2]) / 3; v = '#' + q.map(x => Math.round(clamp(m + (x - m) * 1.25, 0, 255)).toString(16).padStart(2, '0')).join(''); SATC.set(c, v) } return v };

// The dusk, the sun's corona and a seeded starfield: static for a given size, so built once and copied in.
const BACK = new Map();
function backdrop(v) {
  const key = v.W + 'x' + v.H; if (BACK.has(key)) return BACK.get(key);
  const { W, H, cx, cy } = v, img = new ImageData(W, H), px = new Uint32Array(img.data.buffer), sr = Math.max(4, Math.round(SUN_R * v.k / K0)), cor = sr * 3.3;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const b = B8[(y & 7) * 8 + (x & 7)], d = Math.hypot((x - cx) / (W / 2), (y - cy) / (H / 2)), val = Math.pow(Math.max(0, 1 - d / 1.25), 1.6);
    px[i] = R_DUSK[Math.min(R_DUSK.length - 1, Math.floor(val * (R_DUSK.length - 1) + b))];
    const ds = Math.hypot(x - cx, y - cy);
    if (ds > sr && ds < cor) { const q = (ds - sr) / (cor - sr), c = Math.pow(1 - q, 2) * (.9 + .1 * Math.cos(6 * Math.atan2(y - cy, x - cx))), k = Math.floor(c * 3.4 + b); if (k > 0) px[i] = R_CORE[Math.min(3, k)] }
  }
  const r = rngf(77), n = Math.round(W * H * 90 / 64000), hi = u32('#cad3f5'), lo = u32('#494d64');
  for (let s = 0; s < n; s++) { const x = Math.floor(r() * W), y = Math.floor(r() * H), c = r() > .72 ? hi : lo; if (Math.hypot(x - cx, y - cy) > cor) px[y * W + x] = c }
  const o = { img, sr }; BACK.set(key, o); return o;
}

const disc = (c, x, y, R, col) => { for (let j = -R; j <= R; j++) { const w = Math.floor(Math.sqrt((R + .3) * (R + .3) - j * j)); P(c, col, x - w, y + j, 2 * w + 1, 1) } };

// A planet lit from the sun at (sx, sy): day, a dithered terminator and night, a white highlight, and an
// optional lit rim. dim mixes it toward space (unsettled or far side); lift brightens a dark world's far night.
function planetD(c, p, x, y, r, t, sx, sy, dim, lift) {
  const f = SURF[p.surfKey], dx = sx - x, dy = sy - y, L0 = Math.hypot(dx, dy) || 1, lz = .36, k = Math.sqrt(1 - lz * lz), lx = dx / L0 * k, ly = dy / L0 * k, night = .84 - lift;
  x = Math.round(x); y = Math.round(y);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j > (r + .3) * (r + .3)) continue;
    const nx = i / r, ny = j / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), u = (((Math.atan2(nx, nz) / TAU + .5 + t * .012) % 1) + 1) % 1, vv = Math.asin(clamp(ny, -1, 1)) / Math.PI + .5;
    const L = nx * lx + ny * ly + nz * lz, lit = L + (B8[((y + j) & 7) * 8 + ((x + i) & 7)] - .5) * .3; let col = sat(f(u, vv, t));
    col = lit > .3 ? (L > .9 ? mx(col, '#ffffff', .35) : col) : lit > .02 ? mx(col, SP, .5) : mx(col, SP, night);
    if (p.rim && i * i + j * j > (r - 1) * (r - 1) && L > .25) col = p.rim;
    if (dim > 0) col = mx(col, SP, dim);
    P(c, col, x + i, y + j);
  }
}

// A glass tube from A to B (wall + bore), drawn up to fraction `upto`.
export function tube(c, A, B, wall, bore, upto = 1) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 1) return; const ux = dx / L, uy = dy / L, px = -uy, py = ux, M = L * upto;
  for (let k = 0; k <= M; k += .5) { const x = A[0] + ux * k, y = A[1] + uy * k; for (const o of [-1.5, -1, -.5, 0, .5, 1, 1.5]) P(c, bore, x + px * o, y + py * o); for (const o of [-2.5, 2.5]) P(c, wall, x + px * o, y + py * o) }
}

// The cargo pod in a tube at s; bright when it carries something.
export function orb(c, A, B, s, col, full) { const x = Math.round(A[0] + (B[0] - A[0]) * s), y = Math.round(A[1] + (B[1] - A[1]) * s); if (full) { P(c, col, x - 1, y - 1, 3, 3); P(c, '#ffffff', x - 1, y - 1) } else { P(c, mix(col, '#14151f', .45), x - 1, y - 1, 3, 3); P(c, '#14151f', x, y) } }

// sel is the selected planet's name (game.ui.sysSel) or null (always null in wallpaper).
export function drawSystem(ctx, game, t, sel, W = 688, H = 288) {
  const c = ctx, T = GT(game), SYSP = sysPlanets(game), v = sysView(W, H), back = backdrop(v), sx = v.cx, sy = v.cy;
  c.putImageData(back.img, 0, 0);
  // Faint orbit dots, about every 6 px.
  SYSP.forEach(p => { const n = Math.max(24, Math.round(TAU * p.R * v.k / 6)); for (let i = 0; i < n; i++) { const a = i / n * TAU, q = planeXY(v, a, p.R); P(c, Math.sin(a) < 0 ? ORBIT.far : ORBIT.near, q[0], q[1]) } });
  // Long-exposure trails: 1.25 rad behind each planet, solid for the first quarter, then thinning out through B8.
  SYSP.forEach(p => {
    const a0 = p.a + T * p.v, n = Math.ceil(1.25 * p.R * v.k * 1.5), cool = mx(p.col, KD.blue, .45), near = mx(cool, SP, .38), far = mx(cool, SP, .62);
    for (let s = 0; s <= n; s++) {
      const off = s / n * 1.25, a = a0 - off * Math.sign(p.v || 1), q = planeXY(v, a, p.R), X = Math.round(q[0]), Y = Math.round(q[1]), f = off / 1.25;
      if (f > .25 && B8[(Y & 7) * 8 + (X & 7)] > 1 - (f - .25) / .75) continue;
      P(c, Math.sin(a) < 0 ? far : near, X, Y);
    }
  });
  const drawP = p => {
    const q = sysXY(v, p, T), on = p.w && p.w.started, fr = isFar(p, T), r = radius(v, p), lift = fr && p.lift ? p.lift : 0;
    const dim = 1 - (1 - (on ? 0 : .38)) * (1 - (fr && !lift ? .25 : 0));
    planetD(c, p, q[0], q[1], r, t, sx, sy, dim, lift);
    // Play only: one small chevron above the selected planet.
    if (sel === p.name) { const X = Math.round(q[0]), Y = Math.round(q[1]) - r - 3; P(c, KD.mauve, X, Y); P(c, KD.mauve, X - 1, Y - 1); P(c, KD.mauve, X + 1, Y - 1) }
  };
  SYSP.filter(p => isFar(p, T)).forEach(drawP);
  disc(c, sx, sy, back.sr, KD.peach); disc(c, sx, sy, Math.max(1, Math.round(back.sr * .86)), KD.yellow); disc(c, sx, sy, Math.max(1, Math.round(back.sr * .58)), '#fffbf0');
  (game.cables || []).forEach(cb => {
    const g = cableGeom(game, cb), A = sysXY(v, SYSP[cb.a], T), B = sysXY(v, SYSP[cb.b], T);
    tube(c, A, B, g.blocked ? '#ed8796' : '#8aadf4', g.blocked ? '#3a2430' : '#1a1c2b'); if (!g.blocked) orb(c, A, B, cb.u, cb.load.length ? COL[cb.load[0]] : '#8aadf4', cb.load.length > 0);
  });
  SYSP.filter(p => !isFar(p, T)).forEach(drawP);
}

// Where each planet is drawn on a W x H canvas, and its drawn radius (for names and hit tests).
export const sysSpots = (game, W, H) => { const v = sysView(W, H), T = GT(game); return sysPlanets(game).map(p => { const q = sysXY(v, p, T); return { p, x: q[0], y: q[1], r: radius(v, p), up: q[1] < v.cy } }) };

// The planet (a sysPlanets entry) under canvas point pt on a W x H canvas, or null.
export const sysAt = (game, pt, W = 688, H = 288) => { let best = null, bd = 1e9; sysSpots(game, W, H).forEach(s => { const d = Math.hypot(s.x - pt.x, s.y - pt.y); if (d < s.r + 8 && d < bd) { bd = d; best = s.p } }); return best };

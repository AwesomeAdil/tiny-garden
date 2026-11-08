// The solar system, "D3 + Dusk" (page 43), at any canvas size: a flatter tilted orbital plane, long-exposure
// orbit trails, the cables (thin dotted threads that bow around the sun, page 45 sc-arc), and a dithered
// teal-blue dusk around the sun, over the kit's starfield. Nothing sits around the planets.
// The sim keeps its own orbit space (centred on [160,100], see sim/system.js); only the drawing is transformed.
// Orbit time is world 0's S.time; t is wall-clock animation time. Never writes to the game.
import { TAU, SP, P, B8, mix, rgb, u32, rngf, clamp } from '../core/pixel.js';
import { COL, SURF, KD, R_CORE, R_DUSK, ORBIT } from '../core/palette.js';
import { sysPlanets } from '../sim/system.js';
import { skyLayer, twinkle, A } from './kit.js';

const SKY_BG = '#161722', GT = game => game.worlds[0].S.time;
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

// The kit's starfield with a dithered dusk and the sun's corona laid over it: static for a given size and seed, so
// built once and copied in. Fixed stars and stardust show through wherever the dusk is pure space; the twinkling
// stars outside the corona are kept for each frame.
const BACK = new Map(), STAR_PX = [u32('#2a2d42'), u32('#3b3f55')];
function backdrop(v, seed) {
  const key = v.W + 'x' + v.H + ':' + seed; if (BACK.has(key)) return BACK.get(key);
  const { W, H, cx, cy } = v, L = skyLayer(W, H, seed), img = new ImageData(W, H), px = new Uint32Array(img.data.buffer), sr = Math.max(4, Math.round(SUN_R * v.k / K0)), cor = sr * 3.3;
  px.set(L.px.px);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const b = B8[(y & 7) * 8 + (x & 7)], d = Math.hypot((x - cx) / (W / 2), (y - cy) / (H / 2)), val = Math.pow(Math.max(0, 1 - d / 1.25), 1.6), keep = px[i] === STAR_PX[0] || px[i] === STAR_PX[1];
    const k0 = Math.min(R_DUSK.length - 1, Math.floor(val * (R_DUSK.length - 1) + b)); if (k0 > 0 && !keep) px[i] = R_DUSK[k0];
    const ds = Math.hypot(x - cx, y - cy);
    if (ds > sr && ds < cor) { const q = (ds - sr) / (cor - sr), c = Math.pow(1 - q, 2) * (.9 + .1 * Math.cos(6 * Math.atan2(y - cy, x - cx))), k = Math.floor(c * 3.4 + b); if (k > 0) px[i] = R_CORE[Math.min(3, k)] }
  }
  const o = { img, sr, tw: L.tw.filter(s => Math.hypot(s.x - cx, s.y - cy) > cor) }; BACK.set(key, o); if (BACK.size > 6) BACK.delete(BACK.keys().next().value); return o;
}
const skySeed = game => ((game.seed | 0) * 5 + 77) | 0;

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

// A cable from A to B that never crosses the sun at `sun` (radius rSun on the canvas): a quadratic Bezier whose
// control point is pushed off the A-B line, away from the sun. It bows 0.15 L when the straight line is already
// clear, and further only as much as it takes to keep every point at least rSun + 6 from the sun. About one
// point per pixel.
export function arcPath(A, B, sun, rSun, margin = 6) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  const s = (sun[0] - mx) * nx + (sun[1] - my) * ny, side = s > .5 ? -1 : s < -.5 ? 1 : (ny <= 0 ? 1 : -1), need = rSun + margin;
  const at = (d, f) => { const cx = mx + nx * side * d * 2, cy = my + ny * side * d * 2, g = 1 - f; return [g * g * A[0] + 2 * g * f * cx + f * f * B[0], g * g * A[1] + 2 * g * f * cy + f * f * B[1]] };
  const clear = d => { for (let i = 0; i <= 200; i++) { const q = at(d, i / 200); if (Math.hypot(q[0] - sun[0], q[1] - sun[1]) < need + .25) return false } return true };
  let d = .15 * L / 2; for (let i = 0; i < 2000 && !clear(d); i++) d += 1;
  let len = 0, prev = A; for (let i = 1; i <= 24; i++) { const q = at(d, i / 24); len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q }
  const n = Math.max(8, Math.ceil(len)), out = []; for (let i = 0; i <= n; i++) out.push(at(d, i / n));
  out[0] = [A[0], A[1]]; out[n] = [B[0], B[1]];
  return out;
}
const CABLE = '#cad3f5';

// sel is the selected planet's name (game.ui.sysSel) or null (always null in wallpaper).
export function drawSystem(ctx, game, t, sel, W = 688, H = 288) {
  const c = ctx, T = GT(game), SYSP = sysPlanets(game), v = sysView(W, H), back = backdrop(v, skySeed(game)), sx = v.cx, sy = v.cy;
  c.putImageData(back.img, 0, 0); twinkle(c, back.tw, t);
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
  // Cables go down before the sun and the planets, so nothing ever crosses either. A glint runs along one every
  // 8 s while a walker is crossing either end world's bridges.
  (game.cables || []).forEach(cb => {
    const pts = arcPath(sysXY(v, SYSP[cb.a], T), sysXY(v, SYSP[cb.b], T), [sx, sy], back.sr), dot = mx(CABLE, SKY_BG, .5);
    pts.forEach(([x, y], i) => { if ((i & 3) < 2) P(c, dot, x, y) });
    if ([cb.a, cb.b].some(i => game.worlds[i] && game.worlds[i].S.ropes.some(r => r.dir !== 0))) {
      const g = (t / 8) % 1, n = pts.length - 1;
      for (let k = 0; k < 8; k++) { const q = pts[Math.max(0, Math.round(g * n) - k * 2)]; A(c, k ? '#8aadf4' : '#e3eafc', 1 - k / 8, q[0], q[1]) }
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
  SYSP.filter(p => !isFar(p, T)).forEach(drawP);
}

// Where each planet is drawn on a W x H canvas, and its drawn radius (for names and hit tests).
export const sysSpots = (game, W, H) => { const v = sysView(W, H), T = GT(game); return sysPlanets(game).map(p => { const q = sysXY(v, p, T); return { p, x: q[0], y: q[1], r: radius(v, p), up: q[1] < v.cy } }) };

// The planet (a sysPlanets entry) under canvas point pt on a W x H canvas, or null.
export const sysAt = (game, pt, W = 688, H = 288) => { let best = null, bd = 1e9; sysSpots(game, W, H).forEach(s => { const d = Math.hypot(s.x - pt.x, s.y - pt.y); if (d < s.r + 8 && d < bd) { bd = d; best = s.p } }); return best };

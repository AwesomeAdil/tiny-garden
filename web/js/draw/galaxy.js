// The galaxy (320x200): page 08's C, "The Blade". Ported from page 38. Galaxy-wide state only, no sim.
import { TAU, P, B8, NN, rngf } from '../core/pixel.js';
import { R_ARM, R_IN, R_CORE, R_PINK } from '../core/palette.js';
import { W, H, GSYS_NAMES } from '../sim/content.js';

const GO = { arms: 3, pitch: 6, sharp: 1.3, tilt: .14, fall: 1.35, floor: .42, armAmt: .62, dust: .22, dustOff: 1, bulge: .1, bulgeAmt: .42, lane: .016, heatR: .05, heatSharp: 2.2, spin: .02, bh: 4, roll: -.2 };
let GAL = null;
const LAST = new WeakMap();

// Star systems; the first is ours.
export const GSYS = GSYS_NAMES.map(([name, q], i) => ({ name, q, a: i * 2.399 + .7, ours: i === 0 }));

// Per-pixel polar tables (built once).
export function galInit() {
  const n = W * H, G = { img: new ImageData(W, H), rs: new Float32Array(n), th: new Float32Array(n), ln: new Float32Array(n), xs: new Float32Array(n), ys: new Float32Array(n), cx: W / 2, cy: H / 2, sc: W * .47 }; G.px = new Uint32Array(G.img.data.buffer);
  const sr = Math.sin(GO.roll), cr = Math.cos(GO.roll); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - G.cx) / G.sc, dy = (y - G.cy) / G.sc, i = y * W + x, py = dx * sr + dy * cr, pxx = dx * cr - dy * sr, gy = py / GO.tilt, r = Math.hypot(pxx, gy); G.rs[i] = r; G.th[i] = Math.atan2(gy, pxx); G.ln[i] = Math.log(r + .012); G.xs[i] = pxx; G.ys[i] = py }
  const S2 = rngf(99 * 31); G.stars = Array.from({ length: 300 }, () => ({ q: Math.pow(S2(), .65) * 1.12, a: S2() * TAU, v: S2(), ph: S2() * TAU, big: S2() > .92 })); GAL = G;
  return G;
}
const gal = () => GAL || galInit();

export const galRot = t => t * GO.spin;
export const gpos = (q, a, rot) => { const G = gal(), A = a - rot, gx = Math.cos(A) * q, gy = Math.sin(A) * q * GO.tilt, sr = Math.sin(GO.roll), cr = Math.cos(GO.roll); return { x: G.cx + (gx * cr + gy * sr) * G.sc, y: G.cy + (-gx * sr + gy * cr) * G.sc } };

// The star system near map point p at time t, or null.
export const galAt = (p, t) => { let best = null, bd = 14; GSYS.forEach(g => { const q = gpos(g.q, g.a, galRot(t)), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = g } }); return best };

export function blackHole(c, cx, cy, R) { for (let a = 0; a < TAU; a += .02)P(c, Math.cos(a + .8) > -.2 ? '#fff6e0' : '#f5a97f', Math.round(cx + Math.cos(a) * (R + .6)), Math.round(cy + Math.sin(a) * (R + .6))); for (let y = -R + 1; y <= R - 1; y++) { const w = Math.floor(Math.sqrt((R + .2) * (R + .2) - y * y)); P(c, '#030308', cx - w, cy + y, w * 2 + 1, 1) } }

// Forget the last redraw time on ctx, so the next drawGalaxy always paints (use after a view switch).
export const galInvalidate = ctx => { LAST.delete(ctx) };

// sel is the selected system's name (game.ui.galSel) or null. Redraws at most every 0.1 s per canvas.
export function drawGalaxy(ctx, t, sel) {
  const mc = ctx, last = LAST.has(mc) ? LAST.get(mc) : -1; if (last >= 0 && t >= last && t - last < .1) return; LAST.set(mc, t);
  const G = gal(), o = GO, rot = galRot(t), m = o.arms, rotN = rot / TAU * 768, px = G.px;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const r = G.rs[i], th = G.th[i] + rot, b = B8[(y & 7) * 8 + (x & 7)];
    const phase = m * th - o.pitch * G.ln[i], armRaw = .5 + .5 * Math.cos(phase), arm = Math.pow(armRaw, o.sharp);
    const nA = NN((G.th[i] / TAU + .5) * 768 + rotN, G.ln[i] * 70), nB = NN((G.th[i] / TAU + .5) * 1536 + rotN * 2, G.ln[i] * 150 + 80);
    const fade = Math.max(0, 1 - Math.pow(r / 1.08, 3)); let v = Math.exp(-r * o.fall) * fade * (o.floor + arm * o.armAmt) * (.5 + nA * .95);
    const dust = Math.pow(.5 + .5 * Math.cos(phase + o.dustOff), 6); v *= 1 - o.dust * dust * Math.min(1, r / .12) * (.55 + nB * .6); v += Math.exp(-r * 3.3) * fade * .09 * nB;
    const hx = G.xs[i], hy = G.ys[i], sph = Math.hypot(hx, hy), bulge = Math.exp(-Math.pow(sph / o.bulge, 2)), l = Math.exp(-Math.pow(hy / o.lane, 2)); v *= 1 - .88 * l * (.7 + nA * .5) * (Math.abs(hx) > .07 ? 1 : .8);
    const heat = Math.exp(-r / o.heatR) * (.1 + Math.pow(armRaw, o.heatSharp) * 1.5), bl = bulge * o.bulgeAmt * (1 - .55 * l), val = v + heat + bl;
    const RR = (heat + bl + (b - .5) * .22 > .3) ? R_CORE : (arm > .72 && nB + (b - .5) * .1 > .7 && r > .18) ? R_PINK : (r + (b - .5) * .1 < .36 - nA * .1) ? R_IN : R_ARM;
    let idx = Math.floor(Math.min(1, val) * (RR.length - 1) + b); if (idx >= RR.length) idx = RR.length - 1; px[i] = RR[idx < 0 ? 0 : idx];
  }
  mc.putImageData(G.img, 0, 0);
  G.stars.forEach(s => { const p = gpos(s.q, s.a, rot); if (p.x < 0 || p.x >= W || p.y < 0 || p.y >= H) return; const tw = Math.sin(t * .8 + s.ph); if (tw < -.6) return; const col = s.v > .82 ? '#f0c6c6' : s.v > .55 ? '#cad3f5' : '#8aadf4'; P(mc, col, Math.round(p.x), Math.round(p.y)); if (s.big && tw > .45) { mc.globalAlpha = .42; P(mc, col, Math.round(p.x) - 1, Math.round(p.y), 3, 1); P(mc, col, Math.round(p.x), Math.round(p.y) - 1, 1, 3); mc.globalAlpha = 1 } });
  for (let k = -1; k <= 1; k += 2) for (let q = 0; q < 70; q++) { const j = Math.sin(q * .3 - t * 2.2); mc.globalAlpha = Math.max(0, 1 - q / 76) * (.62 + .38 * j); const w = q < 24 ? 1 : q < 52 ? 2 : 3, sway = Math.sin(q * .13 + t * .7) * (q / 24); P(mc, q < 26 ? '#e3eafc' : q < 50 ? '#7dc4e4' : '#8aadf4', Math.round(G.cx + sway - w / 2 - (k * q * Math.sin(-.2))), Math.round(G.cy + k * (o.bh + 3 + q)), w, 1); mc.globalAlpha = 1 }
  blackHole(mc, Math.round(G.cx), Math.round(G.cy), o.bh);
  GSYS.forEach((g, i) => {
    const p = gpos(g.q, g.a, rot), X = Math.round(p.x), Y = Math.round(p.y), tw = Math.sin(t * 1.3 + i) > 0, col = g.ours ? '#eed49f' : '#f6f8ff'; mc.globalAlpha = g.ours ? 1 : .7; P(mc, col, X, Y); P(mc, col, X - 1, Y, 3, 1); P(mc, col, X, Y - 1, 1, 3); if (tw || g.ours) { mc.globalAlpha = .45; P(mc, col, X - 2, Y, 5, 1); P(mc, col, X, Y - 2, 1, 5) } mc.globalAlpha = 1;
    if (sel === g.name) for (let a = 0; a < 16; a++) { if ((a + Math.floor(t * 4)) % 4 === 0) continue; const an = a / 16 * TAU; P(mc, '#c6a0f6', X + Math.cos(an) * 7, Y + Math.sin(an) * 6) }
  });
}

// The galaxy: page 08's C, "The Blade". Ported from page 38, at any canvas size (page 42's C-OUT: the whole
// disc with a margin; disc scale 262 at 688x288). Galaxy-wide state only, no sim.
// The starfield behind it is the kit's skyLayer. In play the view can be panned (game.ui.galPan, canvas pixels) to
// bring the three neighbour galaxies, which sit outside the home disc's frame, into view; the sky stays put.
import { TAU, P, B8, NN, rngf, clamp } from '../core/pixel.js';
import { skyLayer, twinkle } from './kit.js';
import { R_ARM, R_IN, R_CORE, R_PINK } from '../core/palette.js';
import { W as W0, H as H0, GSYS_NAMES } from '../sim/content.js';

const GO = { arms: 3, pitch: 6, sharp: 1.3, tilt: .14, fall: 1.35, floor: .42, armAmt: .62, dust: .22, dustOff: 1, bulge: .1, bulgeAmt: .42, lane: .016, heatR: .05, heatSharp: 2.2, spin: .02, bh: 4, roll: -.2 };
let GAL = null;
const LAST = new WeakMap(), LASTPAN = new WeakMap();

// Three neighbour galaxies at fixed offsets from the home disc centre (dx, dy in disc-scale units, r the radius in the
// same units). Each is rendered once into a small cached sprite.
export const NEIGHBOURS = [
  { kind: 'elliptical', dx: -1.3, dy: -.33, r: .3, seed: 11 },
  { kind: 'ring', dx: 1.35, dy: .28, r: .26, seed: 23 },
  { kind: 'irregular', dx: .5, dy: .42, r: .17, seed: 37 },
];

// Star systems; the first is ours.
export const GSYS = GSYS_NAMES.map(([name, q], i) => ({ name, q, a: i * 2.399 + .7, ours: i === 0 }));

// The disc scale that shows the whole disc with a margin: 262 at 688x288.
export const discScale = (W, H) => Math.min(H * 262 / 288, W * 262 / 688);

// A pan that keeps the home disc at least partly on screen.
export const galClampPan = (p, W, H) => { const sc = discScale(W, H); return { x: clamp(+p.x || 0, -(W / 2 + .5 * sc), W / 2 + .5 * sc), y: clamp(+p.y || 0, -(H / 2 + .1 * sc), H / 2 + .1 * sc) } };
// The pan to draw with: only play pans; the wallpaper always shows home.
export const galPanFor = (mode, game) => mode === 'play' && game.ui.galPan ? { x: +game.ui.galPan.x || 0, y: +game.ui.galPan.y || 0 } : { x: 0, y: 0 };

// A neighbour galaxy sprite (transparent where it is pure space), dithered through the same ramps as the disc.
const NBS = new Map();
function neighbourSprite(nb, sc) {
  const R = Math.max(6, Math.round(nb.r * sc)), key = nb.kind + R; let S = NBS.get(key); if (S) return S;
  const D = 2 * R + 2, px = new Uint32Array(D * D), rnd = rngf(nb.seed), c = D / 2, bl = Array.from({ length: 7 }, () => ({ x: (rnd() - .5) * 1.2, y: (rnd() - .5) * 1.2, s: .18 + rnd() * .22 }));
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const u = (x + .5 - c) / R, v = (y + .5 - c) / R, b = B8[(y & 7) * 8 + (x & 7)]; let val = 0, ramp = R_ARM;
    if (nb.kind === 'elliptical') { const a = -.4, uu = u * Math.cos(a) - v * Math.sin(a), vv = u * Math.sin(a) + v * Math.cos(a), e = Math.hypot(uu, vv / .62); val = Math.exp(-e * e * 3.4) * .95; ramp = val > .5 ? R_CORE : R_IN }
    else if (nb.kind === 'ring') { const e = Math.hypot(u, v / .55), rg = Math.exp(-Math.pow((e - .72) / .13, 2)) * (.65 + .35 * NN(Math.atan2(v / .55, u) * 40, 3)), core = Math.exp(-e * e * 26) * .9; val = rg * .85 + core; ramp = core > rg * .6 ? R_CORE : R_ARM }
    else { for (const q of bl) { const d = Math.hypot(u - q.x, v - q.y) / q.s; val += Math.exp(-d * d) * (.55 + .7 * NN(x * 5 + nb.seed, y * 5)) } val *= .55; ramp = R_PINK }
    const i = Math.floor(Math.min(1, val * .8) * (ramp.length - 1) + b); if (i > 0 && Math.hypot(u, v) < 1.05) px[y * D + x] = ramp[Math.min(i, ramp.length - 1)];
  }
  S = { w: D, h: D, px }; NBS.set(key, S); return S;
}

// Per-pixel tables, built once per size. Only pixels the disc or bulge can reach ("active") are recomputed
// as it turns; every other pixel stays space, with a seeded starfield like the sky's.
export function galInit(W = W0, H = H0, sc = discScale(W, H)) {
  const n = W * H, G = { W, H, img: new ImageData(W, H), cx: W / 2, cy: H / 2, sc, k: sc / 150.4, pan: { x: 0, y: 0 }, key: null, sky: skyLayer(W, H, 57) }; G.px = new Uint32Array(G.img.data.buffer);
  const sr = Math.sin(GO.roll), cr = Math.cos(GO.roll), act = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - G.cx) / sc, dy = (y - G.cy) / sc, py = dx * sr + dy * cr, pxx = dx * cr - dy * sr, r = Math.hypot(pxx, py / GO.tilt); if (r < 1.1 || Math.hypot(pxx, py) < .4) act.push(y * W + x) }
  const m = act.length, F = () => new Float32Array(m);
  Object.assign(G, { act: Int32Array.from(act), ax: Int16Array.from(act, i => i % W), ay: Int16Array.from(act, i => (i / W) | 0), dc: new Uint32Array(m), rs: F(), th: F(), ln: F(), e1: F(), e2: F(), rd: F(), lane: F(), lk: F(), bl: F(), he: F(), b: F() });
  act.forEach((i, j) => {
    const x = i % W, y = (i - x) / W, dx = (x - G.cx) / sc, dy = (y - G.cy) / sc, py = dx * sr + dy * cr, pxx = dx * cr - dy * sr, gy = py / GO.tilt, r = Math.hypot(pxx, gy);
    const fade = Math.max(0, 1 - Math.pow(r / 1.08, 3)), sph = Math.hypot(pxx, py), l = Math.exp(-Math.pow(py / GO.lane, 2));
    G.rs[j] = r; G.th[j] = Math.atan2(gy, pxx); G.ln[j] = Math.log(r + .012); G.e1[j] = Math.exp(-r * GO.fall) * fade; G.e2[j] = Math.exp(-r * 3.3) * fade * .09;
    G.rd[j] = Math.min(1, r / .12); G.lane[j] = l; G.lk[j] = Math.abs(pxx) > .07 ? 1 : .8; G.bl[j] = Math.exp(-Math.pow(sph / GO.bulge, 2)) * GO.bulgeAmt * (1 - .55 * l); G.he[j] = Math.exp(-r / GO.heatR); G.b[j] = B8[(y & 7) * 8 + (x & 7)];
  });
  G.px.set(G.sky.px.px);
  const S2 = rngf(99 * 31); G.stars = Array.from({ length: Math.round(300 * G.k * G.k) }, () => ({ q: Math.pow(S2(), .65) * 1.12, a: S2() * TAU, v: S2(), ph: S2() * TAU, big: S2() > .92 }));
  G.rot = null; GAL = G;
  return G;
}
const gal = (W, H) => (GAL && (W === undefined || (GAL.W === W && GAL.H === H))) ? GAL : galInit(W, H);

export const galRot = t => t * GO.spin;
// The rotation the galaxy was last drawn at (names follow the drawn frame, not the clock).
export const galShownRot = () => GAL ? GAL.rot : null;
export const gpos = (q, a, rot) => { const G = gal(), A = a - rot, gx = Math.cos(A) * q, gy = Math.sin(A) * q * GO.tilt, sr = Math.sin(GO.roll), cr = Math.cos(GO.roll); return { x: G.cx + G.pan.x + (gx * cr + gy * sr) * G.sc, y: G.cy + G.pan.y + (-gx * sr + gy * cr) * G.sc } };
// The disc's centre line, for which side a name goes: y < cy + (x - cx) * 0.2 is above it.
export const galAbove = (x, y) => { const G = gal(); return y < G.cy + G.pan.y + (x - G.cx - G.pan.x) * -Math.tan(GO.roll) };

// The star system near canvas point p at time t, or null.
export const galAt = (p, t) => { let best = null, bd = 14; GSYS.forEach(g => { const q = gpos(g.q, g.a, galRot(t)), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = g } }); return best };

export function blackHole(c, cx, cy, R) { for (let a = 0; a < TAU; a += .02)P(c, Math.cos(a + .8) > -.2 ? '#fff6e0' : '#f5a97f', Math.round(cx + Math.cos(a) * (R + .6)), Math.round(cy + Math.sin(a) * (R + .6))); for (let y = -R + 1; y <= R - 1; y++) { const w = Math.floor(Math.sqrt((R + .2) * (R + .2) - y * y)); P(c, '#030308', cx - w, cy + y, w * 2 + 1, 1) } }

// Forget the last redraw time on ctx, so the next drawGalaxy always paints (use after a view switch).
export const galInvalidate = ctx => { LAST.delete(ctx); LASTPAN.delete(ctx) };

// sel is the selected system's name (game.ui.galSel) or null. Redraws at most every 0.1 s per canvas.
// rt is the time the galaxy has turned to (default t); the costly per-pixel disc is only recomputed when it changes.
// pan ({x, y}, canvas pixels, default none) slides the disc and its neighbours over the fixed sky; the caller passes
// galPanFor(mode, game), so the wallpaper never pans.
export function drawGalaxy(ctx, t, sel, rt = t, W = W0, H = H0, pan = null) {
  const mc = ctx, last = LAST.has(mc) ? LAST.get(mc) : -1, pp = galClampPan(pan || { x: 0, y: 0 }, W, H), pk = Math.round(pp.x) + ',' + Math.round(pp.y);
  if (last >= 0 && t >= last && t - last < .1 && LASTPAN.get(mc) === pk) return; LAST.set(mc, t); LASTPAN.set(mc, pk);
  const G = gal(W, H), o = GO, rot = galRot(rt), m = o.arms, rotN = rot / TAU * 768, px = G.px, k = G.k;
  G.pan = { x: Math.round(pp.x), y: Math.round(pp.y) };
  let fresh = false;
  if (G.rot !== rot) {
    fresh = true;
    const A = G.act, crust = R_ARM[0];
    for (let j = 0, n = A.length; j < n; j++) {
      const r = G.rs[j], th = G.th[j] + rot, b = G.b[j], ln = G.ln[j];
      const phase = m * th - o.pitch * ln, armRaw = .5 + .5 * Math.cos(phase), arm = Math.pow(armRaw, o.sharp);
      const nA = NN((G.th[j] / TAU + .5) * 768 + rotN, ln * 70), nB = NN((G.th[j] / TAU + .5) * 1536 + rotN * 2, ln * 150 + 80);
      let v = G.e1[j] * (o.floor + arm * o.armAmt) * (.5 + nA * .95);
      const dc = .5 + .5 * Math.cos(phase + o.dustOff), d2 = dc * dc, dust = d2 * d2 * d2; v *= 1 - o.dust * dust * G.rd[j] * (.55 + nB * .6); v += G.e2[j] * nB;
      v *= 1 - .88 * G.lane[j] * (.7 + nA * .5) * G.lk[j];
      const heat = G.he[j] * (.1 + Math.pow(armRaw, o.heatSharp) * 1.5), bl = G.bl[j], val = v + heat + bl;
      const RR = (heat + bl + (b - .5) * .22 > .3) ? R_CORE : (arm > .72 && nB + (b - .5) * .1 > .7 && r > .18) ? R_PINK : (r + (b - .5) * .1 < .36 - nA * .1) ? R_IN : R_ARM;
      let idx = Math.floor(Math.min(1, val) * (RR.length - 1) + b); if (idx >= RR.length) idx = RR.length - 1; const col = RR[idx < 0 ? 0 : idx]; G.dc[j] = col === crust ? 0 : col; // pure space stays transparent: the sky's stars show
    }
  }
  G.rot = rot;
  // Compose: the sky, then the neighbours, then the disc, all offset by the pan. Only when the disc or the pan moved.
  if (fresh || G.key !== pk) {
    G.key = pk; px.set(G.sky.px.px);
    for (const nb of NEIGHBOURS) {
      const S = neighbourSprite(nb, G.sc), x0 = Math.round(G.cx + G.pan.x + nb.dx * G.sc - S.w / 2), y0 = Math.round(G.cy + G.pan.y + nb.dy * G.sc - S.h / 2);
      for (let y = Math.max(0, -y0); y < Math.min(S.h, H - y0); y++) for (let x = Math.max(0, -x0); x < Math.min(S.w, W - x0); x++) { const c = S.px[y * S.w + x]; if (c) px[(y0 + y) * W + x0 + x] = c }
    }
    const { ax, ay, dc } = G, px0 = G.pan.x, py0 = G.pan.y;
    for (let j = 0, n = dc.length; j < n; j++) { const c = dc[j]; if (!c) continue; const x = ax[j] + px0, y = ay[j] + py0; if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = c }
  }
  mc.putImageData(G.img, 0, 0); twinkle(mc, G.sky.tw, t);
  G.stars.forEach(s => { const p = gpos(s.q, s.a, rot); if (p.x < 0 || p.x >= W || p.y < 0 || p.y >= H) return; const tw = Math.sin(t * .8 + s.ph); if (tw < -.6) return; const col = s.v > .82 ? '#f0c6c6' : s.v > .55 ? '#cad3f5' : '#8aadf4'; P(mc, col, Math.round(p.x), Math.round(p.y)); if (s.big && tw > .45) { mc.globalAlpha = .42; P(mc, col, Math.round(p.x) - 1, Math.round(p.y), 3, 1); P(mc, col, Math.round(p.x), Math.round(p.y) - 1, 1, 3); mc.globalAlpha = 1 } });
  const bh = Math.max(2, Math.round(o.bh * k)), jl = Math.round(70 * k);
  for (let s = -1; s <= 1; s += 2) for (let q = 0; q < jl; q++) { const qq = q / k, j = Math.sin(qq * .3 - t * 2.2); mc.globalAlpha = Math.max(0, 1 - qq / 76) * (.62 + .38 * j); const w = qq < 24 ? 1 : qq < 52 ? 2 : 3, sway = Math.sin(qq * .13 + t * .7) * (q / 24); P(mc, qq < 26 ? '#e3eafc' : qq < 50 ? '#7dc4e4' : '#8aadf4', Math.round(G.cx + G.pan.x + sway - w / 2 - (s * q * Math.sin(-.2))), Math.round(G.cy + G.pan.y + s * (bh + 3 + q)), w, 1); mc.globalAlpha = 1 }
  blackHole(mc, Math.round(G.cx + G.pan.x), Math.round(G.cy + G.pan.y), bh);
  GSYS.forEach((g, i) => {
    const p = gpos(g.q, g.a, rot), X = Math.round(p.x), Y = Math.round(p.y), tw = Math.sin(t * 1.3 + i) > 0, col = g.ours ? '#eed49f' : '#f6f8ff'; mc.globalAlpha = g.ours ? 1 : .7; P(mc, col, X, Y); P(mc, col, X - 1, Y, 3, 1); P(mc, col, X, Y - 1, 1, 3); if (tw || g.ours) { mc.globalAlpha = .45; P(mc, col, X - 2, Y, 5, 1); P(mc, col, X, Y - 2, 1, 5) } mc.globalAlpha = 1;
    if (sel === g.name) for (let a = 0; a < 16; a++) { if ((a + Math.floor(t * 4)) % 4 === 0) continue; const an = a / 16 * TAU; P(mc, '#c6a0f6', X + Math.cos(an) * 7, Y + Math.sin(an) * 6) }
  });
}

// Close-ups: the town square, an island, and the Long Dawn behind them. Ported from page 38.
// Each takes the canvas size (W x H): 200x120 in the side panel, 344x144 or wider as the 'close' view
// (page 42's B1+). The 200x120 layout is kept as is and centred; the extra width and height become more
// sky, ground and dawn around it. Reads the world; never writes to it.
import { TAU, P, B8, NN, pickR, mix, rngf } from '../core/pixel.js';
import { C, COL, HEAT, KD, R_ARM, R_IN, R_CORE, R_TEAL } from '../core/palette.js';
import { isl } from '../sim/world.js';
import { met } from '../sim/economy.js';
import { VW, VH, sky, star, island, stream, tuft, lantern, piles, pxTree, rock, snail, firefly, bridgeOut, levelDeco, pt, walker } from './scene.js';

// Bridges leaving node n off one side of a close-up, with the walker shown while it's near this end.
// ex is where they leave on the right (the canvas edge), dy shifts their far ends down with a taller canvas.
export function bridgesOut(c, w, n, px, py, toward, t, ex = VW + 4, dy = 0) {
  const S = w.S, rs = S.ropes.filter(r => r.a === n.id || r.b === n.id);
  rs.forEach((r, i) => {
    const b = [toward < 0 ? -4 : ex, Math.max(-2, 44 - i * 15) + dy, px + (toward < 0 ? -2 : 2) * i, py + i, 4 - i]; bridgeOut(c, b, 0, w.TANG.has(r.id)); P(c, '#6e5a55', b[2] - 1, b[3] - 8, 2, 10); P(c, '#a98a7c', b[2] - 1, b[3] - 9, 2, 1);
    const here = r.a === n.id ? 0 : 1, d = Math.abs(r.u - here); if (d < .45) { const q = pt(b, 1 - d / .45); walker(c, q.x, q.y, S.time, r.load.length ? COL[r.load[0].k] : null) }
  });
}

// Town-square ground styles, keyed by a world def's squareKey. side(c, x, t) decorates the extra ground of a wide view.
export const SQUARE = {
  garden: { moss: C.moss, pond: C.water, glint: C.text, tree: (c, t) => pxTree(c, 46, 94, 80, t), side: (c, x, t) => lantern(c, x, 85, t) },
  ember: { moss: '#5b4a44', pond: HEAT, glint: '#eed49f', tree: (c, t) => { for (let i = 0; i < 5; i++) { const s2 = (t * .4 + i / 5) % 1; P(c, i % 2 ? HEAT : '#eed49f', 40 + i * 6, 90 - s2 * 40) } rock(c, 48, 90, 7, 3, ['#6e738d', '#494d64', '#2b2e42']) },
    side: (c, x, t) => { for (let i = 0; i < 4; i++) { const s2 = (t * .4 + i / 4) % 1; P(c, i % 2 ? HEAT : '#eed49f', x + i * 5, 92 - s2 * 30) } } },
};

// The town square of world w on a W x H canvas.
export function planetView(c, game, w, t, W = VW, H = VH) {
  const S = w.S, hub = w.hub, sq = SQUARE[w.def.squareKey] || SQUARE.garden, moss = sq.moss, pondC = sq.pond, dx = Math.round((W - VW) / 2), dy = H - VH, wide = dx > 0 || dy > 0;
  sky(c, t, W, H, dy);
  const f = isl(w).filter(n => S.found.has(n.id));
  // The layout below is page 38's 200x120 one, shifted to the middle of the ground.
  if (wide) { star(c, dx + 150, 30, { r: 7, core: '#fffbf0', mid: '#eed49f', edge: '#f5a97f' }); f.forEach((n, i) => island(c, w.def.isl, Math.round(W * .1 + i * W * .8 / Math.max(1, f.length - 1)), dy + 34 + (i % 2) * 9, 4, n.id, t, false)) }
  if (wide) c.translate(dx, dy);
  if (!wide) { star(c, 128, 20, { r: 7, core: '#fffbf0', mid: '#eed49f', edge: '#f5a97f' }); f.forEach((n, i) => island(c, w.def.isl, 14 + i * 22, 34 + (i % 2) * 9, 4, n.id, t, false)) }
  const x0 = -dx, x1 = W - dx;
  if (S.cable) { const s = Math.min(1, S.cableT / 2); stream(c, [150, 70, 150 + (x1 - 150) * s, 70 - 74 * s, 0], t, '#c6a0f6') }
  for (let x = x0; x < x1; x++) { const h = Math.round(72 + Math.sin(x * .05) * 6 + Math.sin(x * .13 + 1) * 2); P(c, mix(C.surface, C.crust, .35), x, h, 1, VH - h) }
  for (let x = x0; x < x1; x++) { const h = Math.round(94 + Math.sin(x * .09 + 2) * 1.6); P(c, moss, x, h, 1, 1); P(c, mix(moss, C.crust, .3), x, h + 1, 1, 3); P(c, C.soil, x, h + 4, 1, VH - h - 4) }
  for (let y = 0; y < 10; y++) { const hw = 24 - Math.abs(y - 3) * 2.8; P(c, mix(pondC, C.crust, y > 4 ? .35 : .15), 120 - hw, 97 + y, hw * 2, 1) }
  for (let i = 0; i < 4; i++)P(c, mix(pondC, sq.glint, .55), 102 + ((t * 1.1 + i * 9) % 32), 98 + i * 2, 3, 1);
  [6, 14, 30, 48, 88, 150, 178, 192].forEach((x, i) => tuft(c, x, 95, t, i * 1.7, i % 2 ? C.leafM : C.leaf2));
  // The extra ground on either side of a wide view: tufts, two rocks and a lantern (or ember sparks).
  if (dx > 8) {
    for (let x = x0 + 7, i = 0; x < x1 - 4; x += 19, i++) if (x < -4 || x > VW + 2) tuft(c, x, 95, t, i * 1.3, i % 2 ? C.leafM : C.leaf2);
    rock(c, Math.round(x0 * .55), 93, 4, 2); rock(c, Math.round(VW + (x1 - VW) * .7), 93, 3, 5); sq.side(c, Math.round(VW + (x1 - VW) * .35), t);
  }
  lantern(c, 80, 85, t); bridgesOut(c, w, hub, 176, 86, 1, t, x1 + 4, wide ? -dy : 0); piles(c, 118, 92, hub.stock, 2, 4); sq.tree(c, t); snail(c, 6 + ((t * .7) % 70), 91, false);
  firefly(c, 24 + Math.sin(t * .23) * 16, 52 + Math.cos(t * .31) * 9, t, 0);
  if (wide) c.translate(-dx, -dy);
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

// Island n of world w, big, over the dawn. A thought bubble shows what it is missing.
export function islandView(c, w, n, t, W = VW, H = VH, rt = t) {
  const ISL = w.def.isl; dawn(c, t, W, H, rt); const bob = Math.round(Math.sin(t * .35) * 1.3), wd = 28 + n.level * 5, oy = Math.round((H - VH) * .55), x = 80 + Math.round((W - VW) * .37), y = 62 + oy + bob;
  island(c, ISL, x, y, wd, n.id, t, true); levelDeco(c, x, y, wd, n, t, 2); piles(c, x - wd + 10, y - 1, n.stock, 2); bridgesOut(c, w, n, x - wd + 4, y - 1, -1, t, W + 4, oy);
  if (!met(w, n) && Math.floor(t * 2) % 2) { const k = ISL[n.id].needs.find(k => n.stock[k] < 1); P(c, '#e6eaf8', x + 30, y - 34, 14, 10); P(c, COL[k], x + 34, y - 31, 6, 4); P(c, '#e6eaf8', x + 33, y - 24, 2, 3) }
}

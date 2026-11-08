// The city view, "Horizon" (page 45 lay-h): TIDE as a big curve along the bottom with the town on it, the
// islands floating above in three depth bands, plank bridges between piers, and the astronauts walking them.
// Reads the game; never writes to it. Goods are never drawn here except as a walker's backpack colour.
//
// The sky, the stars that never twinkle, the sun, the planet curve and the town's houses are drawn once into a
// cached background (keyed on the canvas size, the world and the town's stage); each frame copies it in and
// draws only the islands, bridges, walkers, lamps, glows and the event on top.
import { TAU, P, clamp } from '../core/pixel.js';
import { PixCtx } from '../core/pixctx.js';
import { COL } from '../core/palette.js';
import { MAXR, TOWN } from '../sim/content.js';
import { node, isl, dist, canTie } from '../sim/world.js';
import { pierSide } from '../sim/grow.js';
import { SPOTS } from '../sim/picks.js';
import { CR, STY, BANDS, BASE_HW, skyLayer, twinkle, sun, planetLayer, glowAt, lamp, PROPS, getSprite, drawIsland, SPOT_X, span, plank, along, pier, pierGlow, astro, hazed, bandOf, isleBob } from './kit.js';
import { drawEvent } from './events.js';

const S = STY.book, IDLE = '#494d64', BAND_ORDER = ['far', 'mid', 'near'];

// ---------- the horizon ----------
// TIDE's curve: its top at world y TOWN.y - 6, centred on the town, wide enough that the bottom row is planet
// from edge to edge. All in canvas pixels.
export function horizon(view) {
  const top = view.oy + TOWN.y - 6, cx = view.ox + TOWN.x, d = Math.max(8, view.h - 1 - top), half = Math.max(cx, view.w - cx) + 6;
  const r = (half * half + d * d) / (2 * d);
  return { cx, top, r, cy: top + r, surf: x => top + r - Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))) };
}
const skySeed = (game, w) => ((game.seed | 0) * 7 + (w.def.seedOffset | 0) * 131 + 31) | 0;
// The city's starfield for this game and world at W x H (exported for tests).
export const citySky = (game, w, W, H) => skyLayer(W, H, skySeed(game, w));

// The town: 1 + 2*(stage-1) houses along the curve (outermost added last), and `stage` lamps.
const HOUSE_H = [5, 7, 6, 5, 7, 4, 6], ROOF = [['#ed8796', '#a8473f'], ['#8aadf4', '#3f5fa8'], ['#a6da95', '#5f9a68'], ['#eed49f', '#a98a7c']];
function townHouse(c, x, y, h, rf) {
  const [r, rd] = ROOF[rf % ROOF.length];
  P(c, CR, x - 3, y - h - 1, 7, h + 1); P(c, CR, x - 4, y - h - 2, 9, 2); P(c, CR, x - 3, y - h - 3, 7, 1);
  P(c, S.wall, x - 2, y - h, 5, h); P(c, S.wallD, x + 2, y - h, 1, h);
  P(c, r, x - 3, y - h - 1, 7, 1); P(c, r, x - 2, y - h - 2, 5, 1); P(c, rd, x + 2, y - h - 2, 1, 1); P(c, rd, x + 3, y - h - 1, 1, 1);
  P(c, S.win, x, y - h + 1); P(c, S.wood, x - 1, y - 2, 1, 2);
}
export function townLayout(view, stage) {
  const H = horizon(view), st = clamp(stage | 0, 1, 4), n = 1 + 2 * (st - 1), houses = [], lamps = [];
  for (let i = 0; i < n; i++) { const x = Math.round(H.cx + (i - (n - 1) / 2) * 10); houses.push({ x, y: Math.round(H.surf(x)) + 2, h: HOUSE_H[i % HOUSE_H.length], rf: i }) }
  const half = (n - 1) * 5 + 4, slots = [half + 3, -(half + 3)];
  for (let i = 0; i < n - 1; i++) if (i % 2 === 0) slots.push(Math.round((i - (n - 2) / 2) * 10));
  for (let j = 0; j < st && j < slots.length; j++) { const x = Math.round(H.cx + slots[j]); lamps.push({ x, y: Math.round(H.surf(x)) + 1 }) }
  return { H, houses, lamps, half: half + 6 };
}

// ---------- the cached background ----------
const BGS = new Map();
export function cityBackground(game, w, view) {
  const W = view.w, Hh = view.h, stage = w.hub.stage, key = [W, Hh, view.ox, view.oy, w.def.key, skySeed(game, w), stage].join();
  let B = BGS.get(key); if (B) return B;
  const px = new PixCtx(W, Hh), L = citySky(game, w, W, Hh), T = townLayout(view, stage), H = T.H;
  px.putImageData(L.img, 0, 0);
  sun(px, W - Math.max(20, Math.round(W * .1)), Math.max(10, Math.round(Hh * .09)));
  // Land and clouds follow the curve, foreshortened toward the horizon (page 45's 1.1 x 3.2 there, larger nearer).
  const PD = 40, map = (x, y) => { const d = Math.max(0, y - H.surf(x)), k = 1 / (1 + d / PD); return [H.cx + (x - H.cx) * 1.1 * k, 3.2 * PD * Math.log(1 + d / PD) + 300] };
  planetLayer(px, W, Hh, H.cx, H.cy, H.r, 1, 1, { rim: 8, map });
  for (const h of T.houses) townHouse(px, h.x, h.y, h.h, h.rf);
  for (const l of T.lamps) lamp(px, l.x, l.y, S);
  B = { px, town: T, tw: L.tw.filter(s => s.y < H.surf(s.x) - 4) };
  BGS.set(key, B); if (BGS.size > 4) BGS.delete(BGS.keys().next().value);
  return B;
}

// ---------- hit test ----------
const islHW = n => Math.round(BASE_HW[clamp(n.stage | 0, 1, 4)] * BANDS[bandOf(n.y)].k);
// The node under world point p: the town round its centre, an island over its top and body.
export const nodeAt = (w, p) => {
  let best = null, bd = 1e9;
  for (const n of w.S.nodes) {
    let d;
    if (n.kind === 'planet') { d = Math.hypot(n.x - p.x, n.y - p.y); if (d >= n.r + 3) continue }
    else { const hw = islHW(n); if (Math.abs(p.x - n.x) > hw + 3 || p.y < n.y - 16 || p.y > n.y + hw * .85 + 2) continue; d = Math.hypot(p.x - n.x, p.y - n.y - 4) }
    if (d < bd) { bd = d; best = n }
  }
  return best;
};

// ---------- piers ----------
// The outermost pixel of a sprite's row dy below its top, on one side, relative to the top centre.
function edgeOf(I, dy, side) {
  const E = I.edges || (I.edges = {}), k = dy * 2 + (side > 0 ? 1 : 0);
  if (E[k] !== undefined) return E[k];
  const row = I.oy + dy, d = I.px.d, Wd = I.w; let x = side > 0 ? Wd - 1 : 0;
  if (row >= 0 && row < I.h) while (x >= 0 && x < Wd && !d[(row * Wd + x) * 4 + 3]) x -= side;
  return (E[k] = x - I.ox);
}
// Every pier this frame: Map 'ropeId:nodeId' -> {x, y, s} (the pier's root at the rim, s its side), in world units.
function piersOf(w, isles, T, H, view) {
  const out = new Map(), bySide = new Map();
  for (const r of w.S.ropes) for (const id of [r.a, r.b]) {
    const n = node(w, id), o = node(w, id === r.a ? r.b : r.a); if (!n || !o) continue;
    const s = n.kind === 'planet' ? Math.sign(o.x - n.x) || 1 : pierSide(w, n, r.id), k = id + ':' + s;
    if (!bySide.has(k)) bySide.set(k, []);
    bySide.get(k).push({ r, n, o, s });
  }
  for (const list of bySide.values()) {
    list.sort((a, b) => a.o.y - b.o.y || a.r.id - b.r.id);
    list.forEach(({ r, n, s }, j) => {
      let x, y;
      if (n.kind === 'planet') { x = Math.round(TOWN.x + s * (T.half + 2 + j * 11)); y = Math.round(H.surf(x + view.ox)) - view.oy + 1 }
      else { const D = isles.get(n.id), dy = j * 7; x = Math.round(D.x) + edgeOf(D.I, dy, s) - s; y = Math.round(D.y) + dy }
      out.set(r.id + ':' + n.id, { x, y, s, n });
    });
  }
  return out;
}
const endOf = p => [p.x + p.s * 4, p.y - 1];

// ---------- walkers ----------
function zzz(c, x, y, t) { [[0, 0], [2, -3], [5, -6]].forEach(([a, b], i) => { if (Math.sin(t * 2 - i) > -.3) { const zx = x + a, zy = y + b; P(c, '#cad3f5', zx, zy, 3, 1); P(c, '#cad3f5', zx + 1, zy + 1); P(c, '#cad3f5', zx, zy + 2, 3, 1) } }) }
function walker(c, r, B, t) {
  const cg = r.load.length ? COL[r.load[0].k] || IDLE : IDLE;
  if (r.dir === 0 && (r.u <= 0 || r.u >= 1)) {
    const p = r.u >= 1 ? B.pb : B.pa, x = p.x + p.s * 2, y = p.y - 2;
    astro(c, x, y, 0, p.s, cg);
    if (!r.load.length) zzz(c, x + 2, y - 9, t);
    return;
  }
  const [x, y] = along(B.pts, clamp(r.u)), ex = B.pts[B.pts.length - 1][0] - B.pts[0][0], d = (r.dir < 0 ? -1 : 1) * (Math.sign(ex) || 1);
  astro(c, x, y - 1, Math.floor(t * 6 + r.id * .7) % 2, d, cg);
}
// A one-way bridge: a 3-px chevron above the rail at mid-span, pointing the way goods may go.
function chevron(c, B, way) {
  const [mx, my] = along(B.pts, .5), ex = B.pts[B.pts.length - 1][0] - B.pts[0][0], d = (Math.sign(ex) || 1) * way, x = Math.round(mx), y = Math.round(my) - 6;
  for (const [a, b] of [[-2, -1], [-1, -1], [-1, 0], [0, 0], [-2, 1], [-1, 1]]) P(c, '#eed49f', x + a * d, y + b);
}

// ---------- play-mode overlays ----------
// The dotted MAXR circle round n, with a green pip over everything in reach (v1 reachRing).
export function reachRing(c, w, n, t) {
  const N = Math.round(MAXR * 1.4);
  for (let i = 0; i < N; i++) { if ((i + Math.floor(t * 3)) % 3 === 0) continue; const a = i / N * TAU; P(c, '#6e738d', n.x + Math.cos(a) * MAXR, n.y + Math.sin(a) * MAXR) }
  for (const o of w.S.nodes) if (o !== n && dist(o, n) <= MAXR) P(c, '#a6da95', o.x - 1, o.y - (o.kind === 'planet' ? 14 : 22), 3, 3);
}
function dottedRing(c, x, y, rx, ry, t, col = '#c6a0f6') { const N = Math.max(24, Math.round((rx + ry) * 2)); for (let i = 0; i < N; i++) { if ((i + Math.floor(t * 4)) % 4 === 0) continue; const a = i / N * TAU; P(c, col, x + Math.cos(a) * rx, y + Math.sin(a) * ry) } }
function overlays(c, game, w, isles, bridges, t, input) {
  const Sx = w.S, { drag = null, pointer = null, tool = 'move' } = input;
  // open spots glow (spot 4 only while a gift waits in the tray)
  for (const D of isles.values()) {
    const n = D.n;
    for (const sp of SPOTS) {
      if (n.stage < sp.opensAt || (n.spots && n.spots[sp.i]) || (sp.i === 4 && !game.gifts.length)) continue;
      const x = Math.round(D.x + SPOT_X[sp.i] * D.I.hw), y = Math.round(D.y) - 4;
      glowAt(c, x, y, '#c6a0f6', .8 + Math.sin(t * 3 + sp.i) * .3); P(c, '#e0caf9', x, y + 1);
    }
  }
  // the selection
  if (Sx.sel && Sx.sel.t === 'node') {
    const n = node(w, Sx.sel.id), D = n && isles.get(n.id);
    if (D) dottedRing(c, D.x, D.y + D.I.depth / 2 - 4, D.I.hw + 6, D.I.depth / 2 + 10, t);
    else if (n) dottedRing(c, n.x, n.y - 10, 30, 10, t);
  } else if (Sx.sel) { const B = bridges.get(Sx.sel.id); if (B) for (let i = 0; i <= 12; i++) { const [x, y] = along(B.pts, i / 12); P(c, '#c6a0f6', x, y + 3) } }
  // the reach ring: round the island under the pointer, or the source of a bridge being tied
  const src = drag && drag.kind === 'rope' ? node(w, drag.id) : pointer && nodeAt(w, pointer);
  if (src) reachRing(c, w, src, t);
  // drag previews
  if (drag && drag.kind === 'move' && drag.moved) {
    const n = node(w, drag.id), D = n && isles.get(n.id);
    if (D) { c.globalAlpha = .25; c.blit ? c.blit(D.I.px, Math.round(drag.ox) - D.I.ox, Math.round(drag.oy) - D.I.oy) : drawIsland(c, D.I, drag.ox, drag.oy, t); c.globalAlpha = 1; const L = Math.hypot(n.x - drag.ox, n.y - drag.oy), m = Math.ceil(L); for (let i = 0; i <= m; i += 2) P(c, '#eed49f', drag.ox + (n.x - drag.ox) * i / m, drag.oy - 2 + (n.y - drag.oy) * i / m) }
  }
  if (drag && drag.kind === 'rope' && pointer) {
    const A = node(w, drag.id), Bn = nodeAt(w, pointer), tp = Bn && Bn !== A ? Bn : pointer, d = Math.hypot(tp.x - A.x, tp.y - A.y);
    const ok = Bn && Bn !== A ? canTie(w, A, Bn).ok : d <= MAXR, col = ok ? '#a6da95' : '#ed8796', n = Math.max(1, Math.ceil(d));
    for (let i = 0; i <= n; i++) { if (!ok && i % 3) continue; P(c, col, A.x + (tp.x - A.x) * i / n, A.y - 2 + (tp.y - A.y) * i / n) }
  }
}

// ---------- the frame ----------
// view = {w, h, ox, oy}: the canvas size and where the 640x300 world's top-left sits on it (ox, oy may be < 0).
// input = {drag, pointer, tool} in play mode, null in wallpaper mode.
export function drawCity(c, game, w, t, view, input = null) {
  const bg = cityBackground(game, w, view), T = bg.town, H = T.H;
  c.putImageData(bg.px.img, 0, 0);
  twinkle(c, bg.tw, t);
  for (const l of T.lamps) PROPS.lamp.a(c, l.x, l.y, S, {}, t);
  c.translate(view.ox, view.oy);
  try {
    // islands: band, sprite and where its top centre is this frame
    const isles = new Map();
    for (const n of isl(w)) { const band = bandOf(n.y); isles.set(n.id, { n, band, bi: BAND_ORDER.indexOf(band), I: getSprite(w, n, band), x: n.x, y: n.y + isleBob(n, t) }) }
    const piers = piersOf(w, isles, T, H, view), bridges = new Map(), hz = id => { const D = isles.get(id); return D ? BANDS[D.band].haze : 0 }, bi = id => { const D = isles.get(id); return D ? D.bi : 2 };
    for (const r of w.S.ropes) {
      const pa = piers.get(r.id + ':' + r.a), pb = piers.get(r.id + ':' + r.b); if (!pa || !pb) continue;
      const [x1, y1] = endOf(pa), [x2, y2] = endOf(pb), L = Math.hypot(x2 - x1, y2 - y1);
      bridges.set(r.id, { r, pa, pb, pts: span(x1, y1, x2, y2, clamp(L * .06, 2, 10)), band: Math.max(bi(r.a), bi(r.b)), haze: (hz(r.a) + hz(r.b)) / 2 });
    }
    for (let b = 0; b < 3; b++) {
      for (const B of bridges.values()) if (B.band === b) { const hc = hazed(c, B.haze); plank(hc, B.pts, S); if (B.r.way) chevron(hc, B, B.r.way) }
      const here = [...isles.values()].filter(D => D.bi === b).sort((p, q) => p.n.y - q.n.y);
      for (const D of here) drawIsland(c, D.I, D.x, D.y, t);
      for (const p of piers.values()) {
        const D = isles.get(p.n.id); if (D ? D.bi !== b : b !== 2) continue;
        const hc = hazed(c, D ? BANDS[D.band].haze : 0); pier(hc, p.x, p.y, S, p.s); pierGlow(c, p.x, p.y, S, p.s);
      }
      for (const B of bridges.values()) if (B.band === b) walker(c, B.r, B, t);
    }
    if (input) overlays(c, game, w, isles, bridges, t, input);
  } finally { c.translate(-view.ox, -view.oy) }
  drawEvent(c, game, view, t, w);
}

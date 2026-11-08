// The city view, "Horizon" (page 45 lay-h): TIDE as a big curve along the bottom with the town on it, the
// islands floating above in three depth bands, plank bridges between piers, and the astronauts walking them.
// Reads the game; never writes to it. Goods are never drawn here except as a walker's backpack colour.
//
// The sky, the stars that never twinkle, the sun, the planet curve and the town's houses are drawn once into a
// cached background (keyed on the canvas size, the world and the town's stage); each frame copies it in and
// draws only the islands, bridges, walkers, lamps, glows and the event on top.
//
// Coordinates (Ruling 9): the sim is in 640x300 world units; everything here is drawn in canvas pixels, at
// canvas = world * view.k + (view.ox, view.oy) (core/pixel.js worldView). Island sprites are built natively at
// hw x k; bridges, piers, walkers, glows and the town keep their native pixel sizes.
import { TAU, P, clamp, toCanvas, worldView } from '../core/pixel.js';
import { PixCtx } from '../core/pixctx.js';
import { COL } from '../core/palette.js';
import { MAXR, TOWN } from '../sim/content.js';
import { node, isl, dist, canTie } from '../sim/world.js';
import { pierSide } from '../sim/grow.js';
import { SPOTS } from '../sim/picks.js';
import { CR, STY, makeIsland, BANDS, islandHW, bandFor, skyLayer, twinkle, sun, planetLayer, glowAt, lamp, PROPS, getSprite, drawIsland, SPOT_X, span, plank, along, pier, pierGlow, astro, hazed, isleBob, depthFor, noteSeed } from './kit.js';
import { drawEvent } from './events.js';

const S = STY.book, IDLE = '#494d64', BAND_ORDER = ['far', 'mid', 'near'];

// ---------- the horizon ----------
// TIDE's curve: its top at the town's mapped y, centred on the town, wide enough that the bottom row is planet
// from edge to edge. All in canvas pixels.
export function horizon(view) {
  const k = view.k || 1, top = Math.round(view.oy + TOWN.y * k), cx = Math.round(view.ox + TOWN.x * k), d = Math.max(8, view.h - 1 - top), half = Math.max(cx, view.w - cx) + 6;
  const r = (half * half + d * d) / (2 * d);
  return { cx, top, r, cy: top + r, surf: x => top + r - Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))) };
}
const skySeed = (game, w) => ((game.seed | 0) * 7 + (w.def.seedOffset | 0) * 131 + 31) | 0;
// The city's starfield for this game and world at W x H (exported for tests).
export const citySky = (game, w, W, H) => skyLayer(W, H, skySeed(game, w));

// The hub: a flat-topped storybook rock resting on TIDE's crest, wide enough for the grown town and four piers
// (two a side). Built once; its top sits HUB_RISE px above the crest so its body is partly sunk into the planet.
export const HUB_HW = 46, HUB_DEPTH = 26, HUB_RISE = 5;
let HUB = null;
export const hubSprite = () => HUB || (HUB = makeIsland({ S, hw: HUB_HW, depth: HUB_DEPTH, seed: 5, lobes: 1, props: [] }));
// The town: 1 + 2*(stage-1) houses along the rock's top (outermost added last), and `stage` lamps.
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
  const hubTop = H.top - HUB_RISE;
  for (let i = 0; i < n; i++) { const x = Math.round(H.cx + (i - (n - 1) / 2) * 10); houses.push({ x, y: hubTop + 1, h: HOUSE_H[i % HOUSE_H.length], rf: i }) }
  const half = (n - 1) * 5 + 4, slots = [half + 3, -(half + 3)];
  for (let i = 0; i < n - 1; i++) if (i % 2 === 0) slots.push(Math.round((i - (n - 2) / 2) * 10));
  for (let j = 0; j < st && j < slots.length; j++) { const x = Math.round(H.cx + slots[j]); lamps.push({ x, y: hubTop + 1 }) }
  return { H, houses, lamps, half: half + 6, hubTop };
}

// The town on its rock as one transparent sprite, for the town-square close-up: {px, w, h, ox, oy (the rock's
// top-centre), lamps (in sprite pixels)}. One per stage.
const TOWNS = new Map();
export function townSprite(stage) {
  const st = clamp(stage | 0, 1, 4); let T = TOWNS.get(st); if (T) return T;
  const I = hubSprite(), px = new PixCtx(I.w, I.h, { transparent: true }), L = townLayout({ w: I.w, h: I.h, k: 1, ox: I.ox - TOWN.x, oy: I.oy + HUB_RISE - TOWN.y }, st);
  px.blit(I.px, 0, 0);
  for (const h of L.houses) townHouse(px, h.x, h.y, h.h, h.rf);
  for (const l of L.lamps) lamp(px, l.x, l.y, S);
  T = { px, w: I.w, h: I.h, ox: I.ox, oy: I.oy, lamps: L.lamps }; TOWNS.set(st, T); return T;
}

// ---------- the cached background ----------
const BGS = new Map();
export function cityBackground(game, w, view) {
  noteSeed(game, w);
  const W = view.w, Hh = view.h, stage = w.hub.stage, key = [W, Hh, view.k || 1, view.ox, view.oy, w.def.key, game.seed | 0, skySeed(game, w), stage].join();
  let B = BGS.get(key); if (B) return B;
  const px = new PixCtx(W, Hh), L = citySky(game, w, W, Hh), T = townLayout(view, stage), H = T.H;
  px.putImageData(L.img, 0, 0);
  sun(px, W - Math.max(20, Math.round(W * .1)), Math.max(10, Math.round(Hh * .09)));
  // TIDE: this game's own continents (kit.js tideWorld), laid along the curve and foreshortened toward the horizon.
  planetLayer(px, W, Hh, H.cx, H.cy, H.r, 1, 1, { rim: 8, seed: game.seed });
  { const I = hubSprite(); px.blit(I.px, H.cx - I.ox, T.hubTop - I.oy) }
  for (const h of T.houses) townHouse(px, h.x, h.y, h.h, h.rf);
  for (const l of T.lamps) lamp(px, l.x, l.y, S);
  B = { px, town: T, tw: L.tw.filter(s => s.y < H.surf(s.x) - 4) };
  BGS.set(key, B); if (BGS.size > 4) BGS.delete(BGS.keys().next().value);
  return B;
}

// ---------- hit test ----------
// The node under point p, tested in CANVAS pixels against what is drawn: the hub's rock (its drawn outline,
// plus the houses and lamps standing on it) and each island's sprite box (its top, the props above it and its
// rock below), with the view's own k, ox and oy. Pass the view with a canvas point (nodeAt(w, canvasPoint,
// view)). Without a view, p is in WORLD units and is tested against the reference 1146x480 canvas.
const REF = { w: 1146, h: 480, ...worldView(1146, 480) };
const PROP_UP = 16; // props, houses and lamps stand up to this many native pixels above a top
// The opaque run of a sprite row dy below its top, relative to the top centre, or null.
const rowSpan = (I, dy) => { const l = edgeOf(I, dy, -1), r = edgeOf(I, dy, 1); return r >= l && r < I.w ? [l, r] : null };
export const nodeAt = (w, p, view = null) => {
  if (!view) { view = REF; const [x, y] = toCanvas(view, p.x, p.y); p = { x, y } }
  const k = view.k || 1;
  let best = null, bd = 1e9;
  for (const n of w.S.nodes) {
    let d;
    if (n.kind === 'planet') {
      const T = townLayout(view, w.hub.stage), I = hubSprite(), dx = p.x - T.H.cx, dy = p.y - T.hubTop;
      if (Math.abs(dx) > HUB_HW + 3 || dy < -PROP_UP || dy > I.depth + 2) continue;
      if (dy > 2) { const s = rowSpan(I, Math.min(I.depth, Math.round(dy))); if (!s || dx < s[0] - 2 || dx > s[1] + 2) continue }
      d = Math.hypot(dx, dy);
    } else {
      const hw = spriteHW(n, k), x = Math.round(view.ox + n.x * k), y = Math.round(view.oy + n.y * k), dx = p.x - x, dy = p.y - y;
      if (Math.abs(dx) > hw + 3 || dy < -PROP_UP || dy > depthFor(hw) + 2) continue;
      d = Math.hypot(dx, dy - 4);
    }
    if (d < bd) { bd = d; best = n }
  }
  return best;
};
// An island sprite's half-width in canvas pixels at view scale k (kit.js islandSpec builds it at this size).
const spriteHW = (n, k) => Math.max(4, Math.round(islandHW(n) * k));

// ---------- spots ----------
// Where spot i of island n glows this frame, in canvas pixels (the glow's centre is one row above the bright
// pixel). spotAt (ui/input.js) tests against the same point.
export const spotXY = (n, i, view, t) => {
  const k = view.k || 1, hw = spriteHW(n, k);
  return [Math.round(Math.round(view.ox + n.x * k) + SPOT_X[i] * hw), Math.round(view.oy + n.y * k) + isleBob(n, t) - 4];
};
// Spot i of n glows (and takes a click): open at this stage, nothing grown on it, and spot 4 only while a gift waits.
export const spotShown = (n, i, gifts) => !!SPOTS[i] && n.stage >= SPOTS[i].opensAt && !(n.spots && n.spots[i]) && (i !== 4 || gifts > 0);

// ---------- piers ----------
// The outermost pixel of a sprite's row dy below its top, on one side, relative to the top centre.
function edgeOf(I, dy, side) {
  const E = I.edges || (I.edges = {}), k = dy * 2 + (side > 0 ? 1 : 0);
  if (E[k] !== undefined) return E[k];
  const row = I.oy + dy, d = I.px.d, Wd = I.w; let x = side > 0 ? Wd - 1 : 0;
  if (row >= 0 && row < I.h) while (x >= 0 && x < Wd && !d[(row * Wd + x) * 4 + 3]) x -= side;
  return (E[k] = x - I.ox);
}
// Every pier this frame: Map 'ropeId:nodeId' -> {x, y, s} (the pier's root at the rim, s its side), in canvas pixels.
function piersOf(w, isles, T, H) {
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
      if (n.kind === 'planet') { const I = hubSprite(), dy = 2 + Math.min(j, 3) * 5; x = Math.round(H.cx) + edgeOf(I, dy, s) - s; y = T.hubTop + dy }
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
// The dotted MAXR circle round n, with a green pip over everything in reach (v1 reachRing), on the canvas.
export function reachRing(c, w, n, t, view) {
  const k = view.k || 1, R = MAXR * k, [cx, cy] = toCanvas(view, n.x, n.y), N = Math.round(R * 1.4);
  for (let i = 0; i < N; i++) { if ((i + Math.floor(t * 3)) % 3 === 0) continue; const a = i / N * TAU; P(c, '#6e738d', cx + Math.cos(a) * R, cy + Math.sin(a) * R) }
  for (const o of w.S.nodes) if (o !== n && dist(o, n) <= MAXR) { const [x, y] = toCanvas(view, o.x, o.y); P(c, '#a6da95', x - 1, y - (o.kind === 'planet' ? 14 : 24), 3, 3) }
}
function dottedRing(c, x, y, rx, ry, t, col = '#c6a0f6') { const N = Math.max(24, Math.round((rx + ry) * 2)); for (let i = 0; i < N; i++) { if ((i + Math.floor(t * 4)) % 4 === 0) continue; const a = i / N * TAU; P(c, col, x + Math.cos(a) * rx, y + Math.sin(a) * ry) } }
function overlays(c, game, w, isles, bridges, t, input, view, H) {
  const Sx = w.S, { drag = null, pointer = null, armedGift = null, card = null } = input;
  // the pointer and the drag's ox/oy are world units; hit tests run in canvas pixels against what is drawn
  const cp = pointer && (([x, y]) => ({ x, y }))(toCanvas(view, pointer.x, pointer.y)), under = cp && nodeAt(w, cp, view);
  // open spots glow (spot 4 only while a gift waits in the tray)
  // (an armed gift or an open card brightens them; the card's own spot glows yellow)
  for (const D of isles.values()) {
    const n = D.n;
    for (const sp of SPOTS) {
      if (!spotShown(n, sp.i, game.gifts.length)) continue;
      const [x, y] = spotXY(n, sp.i, view, t), mine = card && card.id === n.id && card.i === sp.i;
      glowAt(c, x, y, mine ? '#eed49f' : '#c6a0f6', (armedGift != null ? 1.2 : .8) + Math.sin(t * 3 + sp.i) * .3); P(c, '#e0caf9', x, y + 1);
    }
  }
  // the selection
  if (Sx.sel && Sx.sel.t === 'node') {
    const n = node(w, Sx.sel.id), D = n && isles.get(n.id);
    if (D) dottedRing(c, D.x, D.y + D.I.depth / 2 - 4, D.I.hw + 6, D.I.depth / 2 + 10, t);
    else if (n) dottedRing(c, H.cx, H.top - 2, HUB_HW + 6, 12, t);
  } else if (Sx.sel) { const B = bridges.get(Sx.sel.id); if (B) for (let i = 0; i <= 12; i++) { const [x, y] = along(B.pts, i / 12); P(c, '#c6a0f6', x, y + 3) } }
  // the reach ring: round the island under the pointer, or the source of a bridge being tied
  const src = drag && drag.kind === 'rope' ? node(w, drag.id) : under;
  if (src) reachRing(c, w, src, t, view);
  // drag previews
  if (drag && drag.kind === 'move' && drag.moved) {
    const n = node(w, drag.id), D = n && isles.get(n.id);
    if (D) {
      const [gx, gy] = toCanvas(view, drag.ox, drag.oy).map(Math.round), [nx, ny] = toCanvas(view, n.x, n.y);
      c.globalAlpha = .25; c.blit ? c.blit(D.I.px, gx - D.I.ox, gy - D.I.oy) : drawIsland(c, D.I, gx, gy, t); c.globalAlpha = 1;
      const m = Math.ceil(Math.hypot(nx - gx, ny - gy)); for (let i = 0; i <= m; i += 2) P(c, '#eed49f', gx + (nx - gx) * i / m, gy - 2 + (ny - gy) * i / m);
    }
  }
  if (drag && drag.kind === 'rope' && pointer) {
    const A = node(w, drag.id), Bn = under, tp = Bn && Bn !== A ? Bn : pointer, d = Math.hypot(tp.x - A.x, tp.y - A.y);
    const ok = Bn && Bn !== A ? canTie(w, A, Bn).ok : d <= MAXR, col = ok ? '#a6da95' : '#ed8796', n = Math.max(1, Math.ceil(d));
    const [ax, ay] = toCanvas(view, A.x, A.y), [bx, by] = toCanvas(view, tp.x, tp.y), m = Math.max(1, Math.ceil(n * (view.k || 1)));
    for (let i = 0; i <= m; i++) { if (!ok && i % 3) continue; P(c, col, ax + (bx - ax) * i / m, ay - 2 + (by - ay) * i / m) }
  }
}

// ---------- frame geometry ----------
// This frame's islands, piers and bridges, all in canvas pixels: isles Map id -> {n, band, bi, I, x, y} (the
// sprite's top centre), piers Map 'ropeId:nodeId' -> {x, y, s, n}, bridges Map ropeId -> {r, pa, pb, pts, band,
// haze}. Drawing and the hit tests (ropeSpans, ui/input.js ropeAt) share it, so a click lands on what is drawn.
export function cityFrame(w, view, t) {
  const k = view.k || 1, T = townLayout(view, w.hub.stage), H = T.H, isles = new Map();
  for (const n of isl(w)) { const band = bandFor(n); isles.set(n.id, { n, band, bi: BAND_ORDER.indexOf(band), I: getSprite(w, n, band, k), x: Math.round(view.ox + n.x * k), y: Math.round(view.oy + n.y * k) + isleBob(n, t) }) }
  const piers = piersOf(w, isles, T, H), bridges = new Map(), hz = id => { const D = isles.get(id); return D ? BANDS[D.band].haze : 0 }, bi = id => { const D = isles.get(id); return D ? D.bi : 2 };
  for (const r of w.S.ropes) {
    const pa = piers.get(r.id + ':' + r.a), pb = piers.get(r.id + ':' + r.b); if (!pa || !pb) continue;
    const [x1, y1] = endOf(pa), [x2, y2] = endOf(pb), L = Math.hypot(x2 - x1, y2 - y1);
    bridges.set(r.id, { r, pa, pb, pts: span(x1, y1, x2, y2, clamp(L * .06, 2, 10)), band: Math.max(bi(r.a), bi(r.b)), haze: (hz(r.a) + hz(r.b)) / 2 });
  }
  return { T, H, isles, piers, bridges };
}
// Each bridge's drawn span this frame: Map ropeId -> [[x, y], ...] in canvas pixels (the plank row).
export const ropeSpans = (w, view, t) => new Map([...cityFrame(w, view, t).bridges].map(([id, B]) => [id, B.pts]));

// ---------- the frame ----------
// view = {w, h, k, ox, oy}: the canvas size and the world-to-canvas map (core/pixel.js worldView; k defaults to 1,
// ox, oy may be < 0). input = {drag, pointer, tool, armedGift, card} in play mode, null in wallpaper mode; its
// pointer and the drag's ox/oy are in WORLD units; card is {id, i} (the island and spot the open card is for).
export function drawCity(c, game, w, t, view, input = null) {
  const bg = cityBackground(game, w, view), T = bg.town, H = T.H;
  c.putImageData(bg.px.img, 0, 0);
  twinkle(c, bg.tw, t);
  for (const l of T.lamps) PROPS.lamp.a(c, l.x, l.y, S, {}, t);
  const { isles, piers, bridges } = cityFrame(w, view, t);
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
  if (input) overlays(c, game, w, isles, bridges, t, input, view, H);
  drawEvent(c, game, view, t, w);
}

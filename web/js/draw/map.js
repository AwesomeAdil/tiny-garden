// The planet map (320x200): the town square, islands, bridges and walkers. Ported from page 38 drawMap.
// Reads the world; never writes to it.
import { TAU, P, SP, mix, clamp } from '../core/pixel.js';
import { COL, SURF } from '../core/palette.js';
import { W, H, MAXR } from '../sim/content.js';
import { node, isl, dist } from '../sim/world.js';
import { ropeCost } from '../sim/economy.js';
import { bg, star, stream, planet, island, levelDeco, pt, walker } from './scene.js';

// The node under map point p (page 38 nodeAt). Shared with ui/input.js.
export const nodeAt = (w, p) => { let best = null, bd = 1e9; w.S.nodes.forEach(n => { const d = Math.hypot(n.x - p.x, (n.kind === 'planet' ? n.y : n.y - 3) - p.y); if (d < (n.kind === 'planet' ? n.r + 3 : 14) && d < bd) { bd = d; best = n } }); return best };

// A bridge between A and B; T is how taut it is (distance / rope length). Returns its curve [x0,y0,x1,y1,sag].
export function ropeDraw(c, A, B, ra, rb, tang, T) {
  const a = [A.x, A.y - 2], b = [B.x, B.y - 2], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, slack = clamp(1 - T, 0, .5), bb = [a[0] + ux * ra, a[1] + uy * ra, b[0] - ux * rb, b[1] - uy * rb, Math.min(14, 2 + slack * L * .35)], n = Math.ceil(L);
  const lo = T > .97 ? '#f0d6c2' : mix('#5b4a44', '#a5826e', clamp((T - .55) / .42)), hi = T > .97 ? '#ffffff' : mix('#8a7064', '#d8b49c', clamp((T - .55) / .42));
  for (let i = 0; i <= n; i++) { const q = pt(bb, i / n); if (tang && i % 3 === 0) { P(c, '#ed8796', q.x, q.y); continue } P(c, i % 3 === 0 ? hi : lo, q.x, q.y); P(c, mix(lo, SP, .35), q.x, q.y - 3); if (i % 8 === 0) P(c, lo, q.x, q.y - 3, 1, 3) }
  return bb;
}

export const geomR = (w, r) => { const A = node(w, r.a), B = node(w, r.b), T = dist(A, B) / r.len; return { A, B, T, ra: A.kind === 'planet' ? A.r + 1 : 12, rb: B.kind === 'planet' ? B.r + 1 : 12 } };

// The dotted MAXR circle while tying a rope, with a green pip over everything in reach.
export function reachRing(c, w, n, t) { const N = Math.round(MAXR * 1.4); for (let i = 0; i < N; i++) { if ((i + Math.floor(t * 3)) % 3 === 0) continue; const a = i / N * TAU; P(c, '#6e738d', n.x + Math.cos(a) * MAXR, n.y + Math.sin(a) * MAXR) } w.S.nodes.forEach(o => { if (o !== n && dist(o, n) <= MAXR) { P(c, '#a6da95', o.x - 1, o.y - 18, 3, 3) } }) }

// input = {drag, pointer, tool}: drag is {kind:'move'|'rope', id, moved?, ox?, oy?} or null; pointer is a map point or null.
export function drawMap(ctx, game, w, t, input = {}) {
  const mc = ctx, S = w.S, hub = w.hub, TANG = w.TANG, ISL = w.def.isl, { drag = null, pointer = null, tool = 'move' } = input;
  bg(mc, W, H, t, 70); star(mc, 300, 18, { r: 5, core: '#fffbf0', mid: '#eed49f', edge: '#f5a97f' });
  if (S.cable) { const s = Math.min(1, S.cableT / 2); stream(mc, [hub.x + 12, hub.y - 10, hub.x + 12 + (W - hub.x) * s, hub.y - 10 + (H - 20 - hub.y) * s * .2, 0], t, '#c6a0f6') }
  const G = S.ropes.map(r => { const g = geomR(w, r); g.bb = ropeDraw(mc, g.A, g.B, g.ra, g.rb, TANG.has(r.id), g.T); return g });
  planet(mc, SURF[w.def.surfKey], hub.x, hub.y, hub.r, t, .6, -.7, .4);
  isl(w).forEach(n => {
    const seen = S.found.has(n.id) || S.survey, near = !seen && S.nodes.some(o => S.found.has(o.id) && dist(o, n) <= MAXR);
    mc.globalAlpha = seen ? 1 : near ? .45 : .18; island(mc, ISL, n.x, n.y, 10 + n.level, n.id, t, false); if (seen) levelDeco(mc, n.x, n.y, 10 + n.level, n, t, 1); mc.globalAlpha = 1;
  });
  S.ropes.forEach((r, i) => { if (!r.fast) return; const q = pt(G[i].bb, .5), X = Math.round(q.x), Y = Math.round(q.y); P(mc, '#6e5a55', X, Y - 7, 1, 7); const fl = Math.sin(t * 4) > 0 ? 1 : 0; P(mc, '#eed49f', X + 1, Y - 7, 3, 1); P(mc, '#eed49f', X + 1, Y - 6, 2 + fl, 1); P(mc, '#f5a97f', X + 1, Y - 5, 1, 1) });
  S.ropes.forEach((r, i) => { const g = G[i], q = pt(g.bb, r.u), col = r.load.length ? COL[r.load[0].k] : null; walker(mc, q.x, q.y, TANG.has(r.id) || r.dir === 0 ? 0 : S.time, col) });
  if (S.sel.t === 'node') { const n = node(w, S.sel.id); if (n) { const R = n.kind === 'planet' ? n.r + 4 : 16; for (let i = 0; i < 30; i++) { if ((i + Math.floor(t * 4)) % 4 === 0) continue; const a = i / 30 * TAU; P(mc, '#c6a0f6', n.x + Math.cos(a) * R, n.y - (n.kind === 'planet' ? 0 : 4) + Math.sin(a) * R * .8) } } }
  else { const r = S.ropes.find(r => r.id === S.sel.id); if (r) { const g = G[S.ropes.indexOf(r)]; for (let i = 0; i <= 10; i++) { const q = pt(g.bb, i / 10); P(mc, '#c6a0f6', q.x, q.y + 3) } } }
  if (drag && drag.kind === 'move' && drag.moved) { const n = node(w, drag.id), L = Math.hypot(n.x - drag.ox, n.y - drag.oy), m = Math.ceil(L); mc.globalAlpha = .25; island(mc, ISL, drag.ox, drag.oy, 10 + n.level, n.id, t, false); mc.globalAlpha = 1; for (let i = 0; i <= m; i += 2)P(mc, '#eed49f', drag.ox + (n.x - drag.ox) * i / m, drag.oy - 2 + (n.y - drag.oy) * i / m) }
  if (tool === 'rope') { const src = drag && drag.kind === 'rope' ? node(w, drag.id) : (pointer && nodeAt(w, pointer)); if (src) reachRing(mc, w, src, t) }
  if (drag && drag.kind === 'rope' && pointer) { const A = node(w, drag.id), B = nodeAt(w, pointer), tp = B && B !== A ? B : pointer, d = Math.hypot(tp.x - A.x, tp.y - A.y), c = ropeCost(d), ok = d <= MAXR && hub.stock.rock >= c, col = ok ? (c <= 3 ? '#a6da95' : c <= 8 ? '#eed49f' : '#f5a97f') : '#ed8796', n = Math.ceil(d), th = c <= 3 ? 0 : c <= 8 ? 1 : 2; for (let i = 0; i <= n; i++) { if (!ok && i % 3) continue; const x = A.x + (tp.x - A.x) * i / n, y = A.y + (tp.y - A.y) * i / n; P(mc, col, x - (th > 1 ? 1 : 0), y - (th > 1 ? 1 : 0), 1 + th, 1 + th) } }
}

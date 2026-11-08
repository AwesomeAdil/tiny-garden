import { rngf } from '../core/pixel.js';
import { GOODS } from '../core/palette.js';
import { TOWN, MAXR, BAND_Y, ISLAND_HW } from './content.js';
import { cross } from './graph.js';

const inv0 = () => Object.fromEntries(GOODS.map(k => [k, 0]));

// The depth band of a world y, with thresholds halfway between the layout's band ranges (a dragged island's
// band follows its y).
export const bandOf = y => y < (BAND_Y.far[1] + BAND_Y.mid[0]) / 2 ? 'far' : y < (BAND_Y.mid[1] + BAND_Y.near[0]) / 2 ? 'mid' : 'near';

// The horizon layout: x in [40, 600] split into one column per island (islands in seeded order), each column in a
// depth band. About a third are near: side by side on the columns nearest the town, so short bridges rise from
// the town to them. The rest are split far and mid by the seed. Positions get seeded jitter (x by up to a quarter
// column, near islands only outward; y anywhere in the band) until islands keep apart and the spine is in reach:
// town to each near island, then outward column by column (spine() below, which dev autoNet ties first). A spine
// is a set of paths (2 piers per stage-1 island) whose segments never cross. The un-jittered slots (near
// islands pushed out a quarter column) are the fallback and are in reach by construction.
// Returns {id: [x, y, band]}.
export function layout(seed, ids) {
  const r = rngf(seed), n = ids.length, cw = 560 / n, reach = MAXR - 8;
  const order = ids.slice(); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const cols = order.map((_, i) => 40 + cw * (i + .5)), band = new Array(n).fill(null);
  // near: the run of adjacent columns whose farthest one is nearest the town (ties broken by the seed)
  const nNear = Math.min(n, Math.max(1, Math.round(n / 3))), nFar = Math.max(n > 2 ? 1 : 0, Math.round(n / 3)), off = i => Math.abs(cols[i] - TOWN.x);
  let best = [], bk = Infinity;
  for (let a = 0; a + nNear <= n; a++) { let k = 0; for (let i = a; i < a + nNear; i++) k = Math.max(k, off(i)); if (k < bk - 1e-9) { best = [a]; bk = k } else if (Math.abs(k - bk) < 1e-9) best.push(a) }
  const a0 = best[Math.floor(r() * best.length)], mid = (cols[a0] + cols[a0 + nNear - 1]) / 2;
  for (let i = a0; i < a0 + nNear; i++) band[i] = 'near';
  const rest = band.map((b, i) => b ? -1 : i).filter(i => i >= 0);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]] }
  rest.forEach((i, k) => { band[i] = k < nFar ? 'far' : 'mid' });
  const outward = i => band[i] === 'near' ? Math.sign(cols[i] - mid) : 0;
  const ok = P => {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = Math.abs(P[i][0] - P[j][0]), need = band[i] === band[j] ? ISLAND_HW[band[i]] * 2 + 12 : (ISLAND_HW[band[i]] + ISLAND_HW[band[j]]) * .6 + 8;
      if (dx < need) return false;
    }
    const pts = Object.fromEntries(order.map((k, i) => [k, { x: P[i][0], y: P[i][1], band: band[i] }]));
    return spine(order.slice().sort((p, q) => pts[p].x - pts[q].x).map(k => ({ id: k, ...pts[k] }))).every(([p, q]) => Math.hypot(p.x - q.x, p.y - q.y) <= reach);
  };
  const out = P => Object.fromEntries(order.map((k, i) => [k, [P[i][0], P[i][1], band[i]]]));
  for (let tries = 0; tries < 500; tries++) {
    const P = cols.map((x, i) => { const [lo, hi] = BAND_Y[band[i]], o = outward(i); return [Math.round(x + (o ? o * r() : r() * 2 - 1) * cw * .25), Math.round(lo + r() * (hi - lo))] });
    if (ok(P)) return out(P);
  }
  const P = cols.map((x, i) => { const [lo, hi] = BAND_Y[band[i]]; return [Math.round(x + outward(i) * cw * .25), Math.round((lo + hi) / 2)] });
  if (!ok(P)) throw new Error('layout: the un-jittered slots must be in reach');
  return out(P);
}

// The spine of a horizon layout, as pairs of {id, x, y}: the town to each near island, then outward from the
// leftmost and rightmost near islands, island by island. `isles` is sorted by x and carries each band.
export function spine(isles) {
  const town = { id: 'planet', x: TOWN.x, y: TOWN.y }, near = isles.map((p, i) => p.band === 'near' ? i : -1).filter(i => i >= 0);
  if (!near.length) return [];
  const L = near[0], R = near[near.length - 1], pairs = near.map(i => [town, isles[i]]);
  for (let i = L; i > 0; i--) pairs.push([isles[i], isles[i - 1]]);
  for (let i = R; i < isles.length - 1; i++) pairs.push([isles[i], isles[i + 1]]);
  for (let i = L; i < R; i++) if (isles[i + 1].band !== 'near') pairs.push([isles[i], isles[i + 1]]);
  return pairs;
}

export function makeWorld(def, seed) {
  const pos = layout(seed, Object.keys(def.isl));
  const w = { def, HOP: {}, started: false, events: [] };
  w.S = { time: 0, nodes: [], ropes: [], sel: { t: 'node', id: 'planet' }, cable: false, cableT: 0, nextId: 1 };
  w.hub = { id: 'planet', kind: 'planet', x: TOWN.x, y: TOWN.y, r: TOWN.r, stage: 1, paid: inv0(), relay: [] };
  w.S.nodes.push(w.hub);
  Object.keys(pos).forEach((k, i) => w.S.nodes.push({ id: k, kind: 'island', x: pos[k][0], y: pos[k][1], band: pos[k][2], r: 12, stage: 1, paid: inv0(), out: inv0(), relay: [], spots: {}, sends: null, satisfied: [], gifts: [], name: null, seed: i + 1 }));
  return w;
}

export const node = (w, id) => w.S.nodes.find(n => n.id === id);
export const isl = w => w.S.nodes.filter(n => n.kind === 'island');
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Goods an island sends: its type's good, plus one a pick added.
export const makes = (w, n) => n.kind === 'island' ? [w.def.isl[n.id].makes, ...(n.sends ? [n.sends] : [])] : [];
export const piers = n => n.kind === 'planet' ? 4 : n.stage + 1;
const ropesAt = (w, id) => w.S.ropes.filter(r => r.a === id || r.b === id).length;

export function canTie(w, a, b) {
  if (a.id === b.id) return { ok: false, why: 'self' };
  if (w.S.ropes.some(r => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) return { ok: false, why: 'dup' };
  if (dist(a, b) > MAXR) return { ok: false, why: 'reach' };
  if (ropesAt(w, a.id) >= piers(a) || ropesAt(w, b.id) >= piers(b)) return { ok: false, why: 'piers' };
  if (w.S.ropes.some(r => r.a !== a.id && r.a !== b.id && r.b !== a.id && r.b !== b.id && cross(a, b, node(w, r.a), node(w, r.b)))) return { ok: false, why: 'cross' };
  return { ok: true };
}

// way: 0 both, 1 a->b only, -1 b->a only.
export function tie(w, a, b) {
  const r = { id: w.S.nextId++, a: a.id, b: b.id, way: 0, u: 0, dir: 0, load: [], next: 0 };
  w.S.ropes.push(r);
  return r;
}

export const untie = (w, ropeId) => { w.S.ropes = w.S.ropes.filter(r => r.id !== ropeId) };

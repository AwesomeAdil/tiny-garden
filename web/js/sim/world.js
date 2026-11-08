import { rngf } from '../core/pixel.js';
import { GOODS } from '../core/palette.js';
import { TOWN, MAXR } from './content.js';
import { cross } from './graph.js';

const inv0 = () => Object.fromEntries(GOODS.map(k => [k, 0]));

// Rejection-sample island spots: spread out, and every island within bridge reach of a chain from the town.
export function layout(seed, ids) {
  const r = rngf(seed), reach = MAXR - 8, yMax = TOWN.y - 40;
  for (let tries = 0; tries < 500; tries++) {
    const pos = {}; let ok = true;
    for (const k of ids) {
      let placed = false;
      for (let n = 0; n < 200 && !placed; n++) {
        const x = 40 + r() * 560, y = 36 + r() * (yMax - 36);
        if (Object.values(pos).some(p => Math.hypot(p[0] - x, p[1] - y) < 70)) continue;
        pos[k] = [Math.round(x), Math.round(y)]; placed = true;
      }
      if (!placed) { ok = false; break }
    }
    if (!ok) continue;
    const all = [['planet', [TOWN.x, TOWN.y]], ...Object.entries(pos)], seen = new Set(['planet']), q = ['planet'];
    while (q.length) {
      const c = q.shift(), cp = all.find(e => e[0] === c)[1];
      all.forEach(([k, p]) => { if (!seen.has(k) && Math.hypot(p[0] - cp[0], p[1] - cp[1]) <= reach) { seen.add(k); q.push(k) } });
    }
    if (seen.size === ids.length + 1) return pos;
  }
  // fallback: an arc of islands above the town, each within reach of the last
  const pos = {};
  ids.forEach((k, i) => { const t = ids.length > 1 ? i / (ids.length - 1) : .5; pos[k] = [Math.round(60 + t * 520), Math.round(yMax - 20 - Math.sin(t * Math.PI) * 120)] });
  return pos;
}

export function makeWorld(def, seed) {
  const pos = layout(seed, Object.keys(def.isl));
  const w = { def, HOP: {}, started: false, events: [] };
  w.S = { time: 0, nodes: [], ropes: [], sel: { t: 'node', id: 'planet' }, cable: false, cableT: 0, nextId: 1 };
  w.hub = { id: 'planet', kind: 'planet', x: TOWN.x, y: TOWN.y, r: TOWN.r, stage: 1, paid: inv0(), relay: [] };
  w.S.nodes.push(w.hub);
  Object.keys(pos).forEach((k, i) => w.S.nodes.push({ id: k, kind: 'island', x: pos[k][0], y: pos[k][1], r: 12, stage: 1, paid: inv0(), out: inv0(), relay: [], spots: {}, sends: null, satisfied: [], gifts: [], name: null, seed: i + 1 }));
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

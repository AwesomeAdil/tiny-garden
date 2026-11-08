import { node } from './world.js';

export const cross = (p, q, r, s) => { const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)); return o(p, q, r) !== o(p, q, s) && o(r, s, p) !== o(r, s, q) };

export function tangled(w) {
  const R = w.S.ropes, out = new Set();
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
    if (cross(node(w, a.a), node(w, a.b), node(w, b.a), node(w, b.b))) { out.add(a.id); out.add(b.id) }
  }
  return out;
}

// Neighbours you can send to: way 1 is a->b only, -1 is b->a only. canTie forbids crossings, so no tangles to skip.
export const arcs = (w, id) => w.S.ropes.filter(r => (r.a === id && r.way >= 0) || (r.b === id && r.way <= 0)).map(r => r.a === id ? r.b : r.a);

export const cycleWay = r => r.way === 0 ? 1 : r.way === 1 ? -1 : 0;

export function allPairs(w) {
  w.HOP = {};
  w.S.nodes.forEach(n => {
    const d = { [n.id]: 0 }, q = [n.id];
    while (q.length) { const c = q.shift(); arcs(w, c).forEach(o => { if (d[o] === undefined) { d[o] = d[c] + 1; q.push(o) } }) }
    w.HOP[n.id] = d;
  });
}

export const hops = (w, a, b) => w.HOP[a] && w.HOP[a][b] !== undefined ? w.HOP[a][b] : Infinity;

export const nextHop = (w, from, to) => hops(w, from, to) === Infinity ? undefined : arcs(w, from).find(n => hops(w, n, to) === hops(w, from, to) - 1);

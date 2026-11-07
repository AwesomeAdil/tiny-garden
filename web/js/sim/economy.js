import { KEEP, LVM } from './content.js';
import { node, isl } from './world.js';
import { hops, nbrs } from './graph.js';

export const ropeCost = d => Math.max(1, Math.round(d * d / 1000));
export const ropeUp = len => .2 + len / 150;

export const needs = (w, n, k) => n.kind === 'island' && w.def.isl[n.id].needs.includes(k);
export const transit = (w, id, k) => w.S.ropes.reduce((s, r) => s + r.load.filter(x => x.k === k && x.d === id).length, 0);
export const wants = (w, n, k) => w.S.found.has(n.id) && needs(w, n, k) && n.stock[k] + transit(w, n.id, k) < KEEP;

export const ropesAt = (w, id) => w.S.ropes.filter(r => r.a === id || r.b === id).length;
export const slots = n => (n.kind === 'planet' ? 4 : 3) + (n.dock || 0);
export const crowd = (w, n) => Math.max(0, ropesAt(w, n.id) - slots(n));

export function upkeep(w) {
  const S = w.S, m = 1 - .25 * S.patch;
  const b = S.ropes.reduce((s, r) => s + ropeUp(r.len), 0) * m;
  const i = isl(w).reduce((s, n) => s + (S.found.has(n.id) ? (n.level - 1) * .35 : 0), 0) * m;
  return { b, i, all: b + i };
}

export function surplus(w, n, k) {
  if (n.kind === 'planet') return n.stock[k] - (k === 'rock' ? Math.ceil(upkeep(w).all) : 0);
  return n.stock[k] - (needs(w, n, k) ? KEEP : 0);
}

export function destFor(w, X, k) {
  let best = null, bh = Infinity;
  isl(w).forEach(n => { if (n === X || !wants(w, n, k)) return; const h = hops(w, X.id, n.id); if (h < bh) { bh = h; best = n.id } });
  if (best) return best;
  if (X.kind === 'planet') return null;
  return hops(w, X.id, 'planet') < Infinity ? 'planet' : null;
}

export const met = (w, n) => w.def.isl[n.id].needs.every(k => n.stock[k] >= 1);

export function boost(w, n) {
  let b = 1;
  nbrs(w, n.id).forEach(o => { const m = node(w, o); if (m.kind === 'island' && w.def.isl[o].bonus && w.S.found.has(o)) b += .25 });
  return b;
}

export function incomeMin(w, k) {
  const S = w.S, now = S.time, c = S.inLog.filter(e => e[1] === k && now - e[0] <= 60).length;
  return S.time < 60 ? Math.round(c * 60 / Math.max(15, S.time)) : c;
}

export const ropeSpeed = (w, r) => {
  const A = node(w, r.a), B = node(w, r.b);
  return (r.fast ? 1.5 : 1) * (w.S.unpaid ? .5 : 1) / (1 + .35 * (crowd(w, A) + crowd(w, B)));
};

export function rateOf(w, n) {
  const s = w.def.isl[n.id];
  return s.rate * (met(w, n) ? LVM[n.level - 1] : .35) * boost(w, n) * (s.makes === w.def.bonusKind ? 1.5 : 1);
}

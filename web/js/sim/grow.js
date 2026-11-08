// Stages, spots and picks: islands grow one stage at a time, and each stage opens spots to shape.
import { rngf } from '../core/pixel.js';
import { GOODS } from '../core/palette.js';
import { isl, node, makes } from './world.js';
import { arcs } from './graph.js';
import { cost } from './flow.js';
import { SPOTS, PIER_PICKS, MID_PICKS } from './picks.js';

const paidUp = (w, n) => {
  const c = cost(w, n);
  return GOODS.some(k => c[k] > 0) && GOODS.every(k => c[k] <= 0 || n.paid[k] >= c[k]);
};

// At most one stage per call, so every stage's spots open (a long catch-up calls it again).
export function grow(w) {
  for (const n of isl(w)) {
    if (n.stage >= 4 || !paidUp(w, n)) continue;
    n.stage++;
    for (const k of GOODS) n.paid[k] = 0;
    w.events.push({ msg: `${w.def.isl[n.id].name} grew to stage ${n.stage}.`, warn: false });
  }
}

export const pierSide = (w, n, ropeId) => {
  const r = w.S.ropes.find(q => q.id === ropeId), o = node(w, r.a === n.id ? r.b : r.a);
  return Math.sign(o.x - n.x) || 1;
};

export const spotOpen = (n, i) => n.stage >= SPOTS[i].opensAt;

export function spotKind(w, n, i) {
  const side = SPOTS[i].side;
  if (side === 0) return { kind: 'mid' };
  for (const r of w.S.ropes) {
    if (r.a !== n.id && r.b !== n.id) continue;
    const far = node(w, r.a === n.id ? r.b : r.a);
    if (pierSide(w, n, r.id) !== side || !arcs(w, far.id).includes(n.id)) continue;
    const good = GOODS.find(k => makes(w, far).includes(k));
    if (good) return { kind: 'pier', good };
  }
  return { kind: 'mid' };
}

export function offers(w, n, i) {
  if (i === 4 || !SPOTS[i]) return [];
  const kind = spotKind(w, n, i);
  const taken = Object.values(n.spots).map(s => s.pick);
  let c = (kind.kind === 'pier' ? PIER_PICKS[kind.good] : MID_PICKS[n.id]).filter(x => !taken.includes(x.id));
  c = c.filter(x => !x.sends || (!n.sends && !makes(w, n).includes(x.sends)));
  const r = rngf(n.seed * 31 + i), a = c.slice();
  for (let j = a.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [a[j], a[k]] = [a[k], a[j]] }
  return a.slice(0, 3);
}

export function choose(w, n, i, pickId) {
  if (i === 4 || !SPOTS[i] || !spotOpen(n, i) || n.spots[i]) return false;
  const pick = offers(w, n, i).find(x => x.id === pickId);
  if (!pick) return false;
  n.spots[i] = { pick: pickId };
  if (pick.sends) { n.sends = pick.sends; if (!n.satisfied.includes(pick.sends)) n.satisfied.push(pick.sends) }
  return true;
}

export const cleanName = s => {
  const t = String(s).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  return t.length >= 1 && t.length <= 10 ? t : null;
};

export function rename(n, s) {
  const t = cleanName(s);
  if (!t) return false;
  n.name = t;
  return true;
}

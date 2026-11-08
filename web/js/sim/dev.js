// Dev helpers (tests, ?skip=1 and shots). Not part of normal play.
import { dist, isl, canTie, tie, spine, bandOf } from './world.js';
import { SPOTS } from './picks.js';
import { offers, choose } from './grow.js';
import { stepAll } from './system.js';
import { growTown, CABLE_COST } from './town.js';

const closest = (w, ok) => {
  let best = null, bd = Infinity;
  for (const a of w.S.nodes) for (const b of w.S.nodes) {
    if (a.id === b.id || !ok(a, b) || !canTie(w, a, b).ok) continue;
    const d = dist(a, b);
    if (d < bd) { bd = d; best = [a, b] }
  }
  return best;
};

// The layout's spine first (town to the near islands, then outward island by island), then greedy: tie the
// nearest unconnected island to the connected set, then up to 4 extra ropes for redundancy.
export function autoNet(w) {
  const sorted = isl(w).slice().sort((a, b) => a.x - b.x).map(n => ({ id: n.id, x: n.x, y: n.y, band: n.band || bandOf(n.y) }));
  for (const [p, q] of spine(sorted)) { const a = w.S.nodes.find(n => n.id === p.id), b = w.S.nodes.find(n => n.id === q.id); if (canTie(w, a, b).ok) tie(w, a, b) }
  const on = new Set([w.hub.id]);
  for (const r of w.S.ropes) { on.add(r.a); on.add(r.b) }
  for (let p; (p = closest(w, (a, b) => on.has(a.id) && !on.has(b.id)));) { tie(w, p[0], p[1]); on.add(p[1].id) }
  for (let i = 0, p; i < 4 && (p = closest(w, () => true)); i++) tie(w, p[0], p[1]);
}

// Chooses the first offer at every open, unused spot (not spot 4), skipping `sends` picks.
export function autoPick(w) {
  for (const n of isl(w)) for (let i = 0; i < SPOTS.length; i++) {
    if (i === 4 || n.stage < SPOTS[i].opensAt || n.spots[i]) continue;
    const o = offers(w, n, i).find(p => !p.sends);
    if (o) choose(w, n, i, o.id);
  }
}

// World 0 networked, islands at stage 3 and picked, the cable paid, then 30 s of play.
export function skip(game) {
  const w = game.worlds[0];
  autoNet(w);
  isl(w).forEach(n => { n.stage = 3 });
  autoPick(w);
  w.hub.stage = 4;
  for (const k of Object.keys(w.hub.paid)) w.hub.paid[k] = CABLE_COST;
  growTown(game, w);
  for (let i = 0; i < 300; i++) stepAll(game, .1);
  return game;
}

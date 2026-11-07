// Dev helpers (page 38 autoNet and skip). Used by tests and web/art.html; not part of normal play.
import { RES } from '../core/palette.js';
import { MAXR } from './content.js';
import { dist, node, isl, tie } from './world.js';
import { cross } from './graph.js';
import { ropesAt, slots } from './economy.js';
import { stepAll } from './system.js';
import { launch } from './shop.js';

// Greedy nearest-reachable tie loop, respecting slots and crossings.
export function autoNet(w) {
  const S = w.S, done = new Set(['planet', ...S.ropes.flatMap(r => [r.a, r.b])]);
  for (let g = 0; g < 8; g++) {
    let best = null, bd = 1e9;
    S.nodes.forEach(a => {
      if (!done.has(a.id) || ropesAt(w, a.id) >= slots(a)) return;
      S.nodes.forEach(b => {
        if (done.has(b.id)) return;
        const d = dist(a, b);
        if (d <= MAXR && d < bd && !S.ropes.some(r => r.a !== a.id && r.b !== a.id && r.a !== b.id && r.b !== b.id && cross(a, b, node(w, r.a), node(w, r.b)))) { bd = d; best = [a, b] }
      });
    });
    if (!best) break;
    tie(w, best[0], best[1]); done.add(best[1].id);
  }
}

// Skip ahead: world 0 networked, every island found at level 3, stock topped up to its goal,
// the cable launched, then 30 s of play.
export function skip(game) {
  const w = game.worlds[0], S = w.S, hub = w.hub;
  autoNet(w);
  isl(w).forEach(n => { S.found.add(n.id); n.level = 3 });
  S.time = Math.max(S.time, 600);
  RES.forEach(k => hub.stock[k] += 12);
  Object.keys(w.def.goal).forEach(k => hub.stock[k] = Math.max(hub.stock[k], w.def.goal[k]));
  launch(game, w); hub.stock.rock += 20;
  for (let i = 0; i < 300; i++) stepAll(game, .1);
  return game;
}

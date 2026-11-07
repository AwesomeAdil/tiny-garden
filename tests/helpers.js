import { dist, node, tie } from '../web/js/sim/world.js';
import { cross } from '../web/js/sim/graph.js';
import { MAXR } from '../web/js/sim/content.js';
import { stepAll } from '../web/js/sim/system.js';
import { newGame } from '../web/js/sim/game.js';
import { ropesAt, slots } from '../web/js/sim/economy.js';

export const freshGame = (seed, defs) => newGame(seed, defs);


// Greedy nearest-reachable tie loop from page 38 autoNet, respecting slots and crossings.
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

// Advance every started world in the game by `seconds` in 0.1 s sub-steps.
export function sim(game, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) stepAll(game, 0.1);
}

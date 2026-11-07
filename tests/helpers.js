import { makeWorld, dist, node, tie } from '../web/js/sim/world.js';
import { cross } from '../web/js/sim/graph.js';
import { DEF_OCEAN, MAXR } from '../web/js/sim/content.js';
import { step } from '../web/js/sim/step.js';
import { ropesAt, slots } from '../web/js/sim/economy.js';

// Replaced by the real newGame in Task 3.
export function freshGame(seed) { return { worlds: [makeWorld(DEF_OCEAN, seed)] }; }


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
// Task 3 switches this to stepAll (cables).
export function sim(game, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) game.worlds.forEach(w => { if (w.started) step(w, 0.1) });
}

import { makeWorld, dist, node, tie } from '../web/js/sim/world.js';
import { cross } from '../web/js/sim/graph.js';
import { DEF_OCEAN, MAXR } from '../web/js/sim/content.js';

// Replaced by the real newGame in Task 3.
export function freshGame(seed) { return { worlds: [makeWorld(DEF_OCEAN, seed)] }; }

const ropesAt = (w, id) => w.S.ropes.filter(r => r.a === id || r.b === id).length;
const slots = n => (n.kind === 'planet' ? 4 : 3) + (n.dock || 0);

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

// Advance every world in the game by `seconds` in 0.1 s sub-steps.
// Until step.js lands (Task 3) this is a no-op beyond the clock.
export function sim(game, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) game.worlds.forEach(w => { w.S.time += 0.1 });
}

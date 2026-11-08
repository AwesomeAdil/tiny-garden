import { WORLD_DEFS } from './content.js';
import { makeWorld } from './world.js';
import { stepAll } from './system.js';
import { newEv, endCatchup } from './events.js';
import { clockStep } from './clock.js';

const STEP = .1;

export function freshWorld(def, seed, started) {
  const w = makeWorld(def, seed + def.seedOffset);
  w.started = started;
  return w;
}

export function newGame(seed, defs = WORLD_DEFS, savedAt = 0) {
  const worlds = defs.map((def, i) => freshWorld(def, seed, i === 0));
  return { seed, worlds, cables: [], gifts: [], ev: newEv(seed), ui: { view: 'planet', world: 0, speed: 1, sysSel: null, galSel: null, galPan: { x: 0, y: 0 }, names: true, lessons: {} }, savedAt };
}

// Steps realSec (x speed in play mode) in 0.1 s sub-steps.
export function advance(game, realSec, mode, opts = {}) {
  const total = realSec * (mode === 'play' ? game.ui.speed : 1);
  const n = Math.floor(total / STEP + 1e-9), rem = total - n * STEP;
  for (let i = 0; i < n; i++) stepAll(game, STEP, opts);
  if (rem > 1e-6) stepAll(game, rem, opts);
}

// One app frame at nowMs (main.js tick): the live step in the current mode, then a chunk of catch-up (sim/clock.js).
// While any catch-up is running, both steps go through the catch-up event rule (at most one visit, no live visit
// starting mid-way), however many frames the gap takes; the catch-up ends on the frame the clock is current.
export function frame(game, clock, nowMs, mode) {
  const { live, chunk } = clockStep(clock, nowMs), opts = chunk > 0 ? { catchup: true } : {};
  if (live > 0) advance(game, live, mode, opts);
  if (chunk > 0) advance(game, chunk, 'wallpaper', opts);
  // A save made mid-catch-up can come back with no gap left to run; it still has to end.
  if (clock.behind === 0 && game.ev.caught) endCatchup(game);
  return { live, chunk };
}

import { WORLD_DEFS } from './content.js';
import { makeWorld } from './world.js';
import { stepAll } from './system.js';
import { newEv, endCatchup } from './events.js';
import { clockStep } from './clock.js';

export const STEP = .1, MAX_STEPS = 120;
// Developer mode's x600 wants 100 sub-steps a frame at 60 fps. A play frame runs at most MAX_STEPS; the rest is
// carried to the next frames (clock.carry, at most one frame's worth), so a slow frame slows the sim instead of
// stalling the page. Wallpaper (speed 1) never needs it and drops any carry.

export function freshWorld(def, seed, started) {
  const w = makeWorld(def, seed + def.seedOffset);
  w.started = started;
  return w;
}

export function newGame(seed, defs = WORLD_DEFS, savedAt = 0) {
  const worlds = defs.map((def, i) => freshWorld(def, seed, i === 0));
  return { seed, worlds, cables: [], gifts: [], ev: newEv(seed), ui: { view: 'planet', world: 0, speed: 1, sysSel: null, galSel: null, galPan: { x: 0, y: 0 }, names: true, lessons: {} }, savedAt };
}

// Steps realSec (x speed in play mode), plus `carry` s of sim time left over from earlier frames, in 0.1 s
// sub-steps, at most maxSteps of them. Returns the sim seconds it did not run.
export function advance(game, realSec, mode, opts = {}, carry = 0, maxSteps = Infinity) {
  const total = realSec * (mode === 'play' ? game.ui.speed : 1) + carry;
  let n = Math.floor(total / STEP + 1e-9), rem = total - n * STEP;
  if (n >= maxSteps) { n = maxSteps; rem = 0 }
  for (let i = 0; i < n; i++) stepAll(game, STEP, opts);
  if (rem > 1e-6) stepAll(game, rem, opts);
  return Math.max(0, total - n * STEP - rem);
}

// One app frame at nowMs (main.js tick): the live step in the current mode, then a chunk of catch-up (sim/clock.js).
// While any catch-up is running, both steps go through the catch-up event rule (at most one visit, no live visit
// starting mid-way), however many frames the gap takes; the catch-up ends on the frame the clock is current.
export function frame(game, clock, nowMs, mode) {
  const { live, chunk } = clockStep(clock, nowMs), opts = chunk > 0 ? { catchup: true } : {};
  const play = mode === 'play';
  if (!play) clock.carry = 0;
  if (live > 0 || clock.carry > 0) clock.carry = Math.min(MAX_STEPS * STEP, advance(game, live, mode, opts, clock.carry || 0, play ? MAX_STEPS : Infinity));
  if (chunk > 0) advance(game, chunk, 'wallpaper', opts);
  // A save made mid-catch-up can come back with no gap left to run; it still has to end.
  if (clock.behind === 0 && game.ev.caught) endCatchup(game);
  return { live, chunk };
}

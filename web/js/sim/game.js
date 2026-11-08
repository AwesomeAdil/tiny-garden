import { WORLD_DEFS } from './content.js';
import { makeWorld } from './world.js';
import { stepAll } from './system.js';
import { newEv, endCatchup } from './events.js';

const STEP = .1, MAX_GAP = 43200;

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

export function catchUp(game, nowMs) {
  const elapsed = Math.min(MAX_GAP, Math.max(0, (nowMs - game.savedAt) / 1000));
  advance(game, elapsed, 'wallpaper', { catchup: true });
  endCatchup(game);
  game.savedAt = nowMs;
  return elapsed;
}

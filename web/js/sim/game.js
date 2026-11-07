import { WORLD_DEFS } from './content.js';
import { makeWorld, node, tie } from './world.js';
import { stepAll } from './system.js';

const STEP = .1, MAX_GAP = 43200;

export function newGame(seed, defs = WORLD_DEFS, savedAt = 0) {
  const worlds = defs.map((def, i) => {
    const w = makeWorld(def, seed + def.seedOffset);
    tie(w, w.hub, node(w, def.start));
    w.started = i === 0;
    return w;
  });
  return { seed, worlds, cables: [], ui: { view: 'planet', world: 0, speed: 1, pri: 'auto', sysSel: null, galSel: null }, savedAt };
}

// Steps realSec (x speed in play mode) in 0.1 s sub-steps.
export function advance(game, realSec, mode) {
  const total = realSec * (mode === 'play' ? game.ui.speed : 1);
  const n = Math.floor(total / STEP + 1e-9), rem = total - n * STEP;
  for (let i = 0; i < n; i++) stepAll(game, STEP);
  if (rem > 1e-6) stepAll(game, rem);
}

export function catchUp(game, nowMs) {
  const elapsed = Math.min(MAX_GAP, Math.max(0, (nowMs - game.savedAt) / 1000));
  advance(game, elapsed, 'wallpaper');
  game.savedAt = nowMs;
  return elapsed;
}

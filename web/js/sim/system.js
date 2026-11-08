import { SYS_EXTRA } from './content.js';
import { step } from './flow.js';
import { grow } from './grow.js';
import { growTown } from './town.js';

const SC = [160, 100], EVENT_CAP = 50;

// Worlds first (in WORLD_DEFS order), then the stars that stay unreachable in v1.
export const sysPlanets = game => [
  ...game.worlds.map(w => ({ w, name: w.def.name, full: w.def.full, surfKey: w.def.surfKey, ...w.def.sys })),
  ...SYS_EXTRA.map(p => ({ w: null, ...p })),
];

export const sysPos = (p, t) => { const a = p.a + t * p.v; return [SC[0] + Math.cos(a) * p.R, SC[1] + Math.sin(a) * p.R * .5] };

export function stepAll(game, dt) {
  game.worlds.forEach(w => {
    if (!w.started) return;
    step(w, dt);
    grow(w);
    growTown(game, w);
    if (w.events.length > EVENT_CAP) w.events.splice(0, w.events.length - EVENT_CAP);
  });
  // stepEvents(game, dt) goes here (Task 5).
}

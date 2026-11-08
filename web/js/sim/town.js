// The town on the horizon grows by receiving goods; at stage 4 it can pay for the long cable to the next world.
import { GOODS } from '../core/palette.js';
import { isl } from './world.js';

export const TOWN_COST = [0, 40, 400, 1200]; // each good, town stage i -> i+1 (Task 7 tunes)
export const CABLE_COST = 6000;             // each good (Task 7 tunes)

const all = n => Object.fromEntries(GOODS.map(k => [k, n]));

export const cableOpen = w => !!w.def.next && !w.S.cable && isl(w).every(n => n.stage >= 3);

export function townCost(w) {
  const st = w.hub.stage;
  if (st < 4) return all(TOWN_COST[st]);
  return all(cableOpen(w) ? CABLE_COST : 0);
}

// One stage per call. At stage 4, a fully paid cable starts the next world.
export function growTown(game, w) {
  const hub = w.hub, c = townCost(w);
  if (!GOODS.every(k => c[k] > 0 && hub.paid[k] >= c[k])) return;
  for (const k of GOODS) hub.paid[k] = 0;
  if (hub.stage < 4) { hub.stage++; w.events.push({ msg: 'The town grows!', warn: false }); return }
  w.S.cable = true;
  const b = game.worlds.findIndex(x => x.def.key === w.def.next);
  if (b < 0) return;
  game.worlds[b].started = true;
  game.cables.push({ a: game.worlds.indexOf(w), b });
  w.events.push({ msg: `The long cable reaches ${game.worlds[b].def.name}!`, warn: false });
}

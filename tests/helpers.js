import { stepAll } from '../web/js/sim/system.js';
import { newGame } from '../web/js/sim/game.js';

export const freshGame = (seed, defs) => newGame(seed, defs);

export { autoNet } from '../web/js/sim/dev.js';

// Advance every started world in the game by `seconds` in 0.1 s sub-steps.
export function sim(game, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) stepAll(game, 0.1);
}

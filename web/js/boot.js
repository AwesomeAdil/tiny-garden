// Loading a save for garden.boot: deserialize it, then prove it runs before handing it over.
// A save can parse and still break the sim (a field a later build no longer expects), and a frame that throws on
// every tick would freeze the garden on every launch. So a second copy is stepped 0.1 s; if that throws, the save
// counts as bad (main.js posts bad-save and starts a new game). A v1 save is a different game: {old:true}.
import { advance } from './sim/game.js';
import { deserialize, isV1 } from './sim/save.js';

// makeCtx is unused for now: Task 10 re-adds the trial draw once the draw modules can import.
// Returns {game}, {old:true} for a v1 save, or null. Never throws.
export function trialLoad(obj, makeCtx) {
  try {
    if (isV1(obj)) return { old: true };
    const game = deserialize(obj); if (!game) return null;
    const copy = deserialize(obj);
    advance(copy, .1, 'wallpaper');
    return { game };
  } catch (e) {
    return null;
  }
}

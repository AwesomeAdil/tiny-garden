// Loading a save for garden.boot: deserialize it, then prove it runs before handing it over.
// A save can parse and still break the sim or the drawing (a field a later build no longer expects), and a frame
// that throws on every tick would freeze the garden on every launch. So a second copy is stepped 0.1 s and drawn
// once; if either throws, the save counts as bad (main.js posts bad-save and starts a new game).
import { advance } from './sim/game.js';
import { deserialize } from './sim/save.js';
import { drawMap } from './draw/map.js';
import { drawSystem } from './draw/system.js';

// makeCtx() returns a 2D context (or stand-in) to draw the trial frames into. Returns a Game or null; never throws.
export function trialLoad(obj, makeCtx) {
  try {
    const game = deserialize(obj); if (!game) return null;
    const copy = deserialize(obj);
    advance(copy, .1, 'wallpaper');
    copy.worlds.filter(w => w.started).forEach(w => drawMap(makeCtx(), copy, w, 0));
    drawSystem(makeCtx(), copy, 0, null);
    return game;
  } catch (e) {
    return null;
  }
}

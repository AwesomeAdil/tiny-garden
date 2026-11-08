// Loading a save for garden.boot: deserialize it, then prove it runs before handing it over.
// A save can parse and still break the sim (a field a later build no longer expects), and a frame that throws on
// every tick would freeze the garden on every launch. So a second copy is stepped 0.1 s; if that throws, the save
// counts as bad (main.js posts bad-save and starts a new game). Then one city frame of each started world is
// drawn into makeCtx() (a PixCtx), so a save the drawing chokes on is refused too. A v1 save is a different
// game: {old:true}.
import { advance } from './sim/game.js';
import { deserialize, isV1 } from './sim/save.js';
import { worldOffset } from './core/pixel.js';
import { drawCity } from './draw/city.js';

// Returns {game}, {old:true} for a v1 save, or null. Never throws.
export function trialLoad(obj, makeCtx) {
  try {
    if (isV1(obj)) return { old: true };
    const game = deserialize(obj); if (!game) return null;
    const copy = deserialize(obj);
    advance(copy, .1, 'wallpaper');
    if (makeCtx) for (const w of copy.worlds) if (w.started) { const c = makeCtx(); drawCity(c, copy, w, 0, { w: c.width, h: c.height, ...worldOffset(c.width, c.height) }, null) }
    return { game };
  } catch (e) {
    return null;
  }
}

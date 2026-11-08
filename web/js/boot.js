// Loading a save for garden.boot: deserialize it, then prove it runs before handing it over.
// A save can parse and still break the sim (a field a later build no longer expects), and a frame that throws on
// every tick would freeze the garden on every launch. So a second copy is stepped 0.1 s; if that throws, the save
// counts as bad (main.js posts bad-save and starts a new game). Then one city frame of each started world is
// drawn into makeCtx() (a PixCtx), so a save the drawing chokes on is refused too. A v1 save is a different
// game: {old:true}.
import { advance, newGame } from './sim/game.js';
import { deserialize, isV1 } from './sim/save.js';
import { worldView } from './core/pixel.js';
import { drawCity } from './draw/city.js';

// Returns {game}, {old:true} for a v1 save, or null. Never throws.
export function trialLoad(obj, makeCtx) {
  try {
    if (isV1(obj)) return { old: true };
    const game = deserialize(obj); if (!game) return null;
    const copy = deserialize(obj);
    advance(copy, .1, 'wallpaper');
    if (makeCtx) for (const w of copy.worlds) if (w.started) { const c = makeCtx(); drawCity(c, copy, w, 0, { w: c.width, h: c.height, ...worldView(c.width, c.height) }, null) }
    return { game };
  } catch (e) {
    return null;
  }
}

// What every boot does to a game before it runs (main.js start): a known view and world, 1x, the defaults a
// save may lack, and no sim events left over. Pure, so tests can boot exactly as the page does.
import { VIEWS } from './ui/esc.js';
export function prepare(game, nowMs) {
  const ui = game.ui;
  if (!VIEWS.includes(ui.view)) ui.view = 'planet';
  if (!(ui.world >= 0 && ui.world < game.worlds.length && game.worlds[ui.world].started)) ui.world = 0;
  ui.speed = 1; ui.pri = ui.pri || 'auto'; if (typeof ui.names !== 'boolean') ui.names = true;
  if (!ui.firstSeen) ui.firstSeen = nowMs;
  game.worlds.forEach(w => { w.events.length = 0 });
  return game;
}

// garden.boot's load step: the game a boot runs. A save that won't load is reported (bad-save, or old-save for v1)
// and replaced by a new game; a sandbox (opts.dev) stands still while dev is off, so it has no catch-up.
export function bootGame(saveObj, nowMs, opts, { post, makeCtx, seed }) {
  let game = null;
  if (saveObj != null) {
    const r = trialLoad(saveObj, makeCtx);
    if (!r) post({ type: 'bad-save' });
    else if (r.old) post({ type: 'old-save' });
    else game = r.game;
  }
  if (!game) { game = newGame(seed()); game.savedAt = nowMs }
  if (opts && opts.dev) game.savedAt = nowMs;
  return game;
}

import { WORLD_DEFS } from './content.js';
import { freshWorld } from './game.js';
import { tangled, allPairs } from './graph.js';

export const SAVE_VERSION = 1;

// Upgrade an old save object to the current version. v1 is the first, so identity.
export const migrate = obj => obj;

const plain = o => JSON.parse(JSON.stringify(o));

// JSON-safe snapshot. TANG/HOP/events/def are derived and not stored; hub is nodes[0] (the planet).
export function serialize(game, nowMs) {
  return plain({
    v: SAVE_VERSION,
    savedAt: nowMs,
    seed: game.seed,
    worlds: game.worlds.map(w => ({
      key: w.def.key, started: w.started, POS: w.POS,
      S: { ...w.S, found: [...w.S.found] },
    })),
    cables: game.cables,
    ui: game.ui,
  });
}

// Returns a Game, or null for anything unusable. Never throws.
export function deserialize(obj, defs = WORLD_DEFS) {
  try {
    if (!obj || typeof obj !== 'object') return null;
    obj = migrate(plain(obj));
    if (!obj || obj.v !== SAVE_VERSION || !Array.isArray(obj.worlds) || !obj.worlds.length || obj.worlds.length > defs.length) return null;
    if (typeof obj.seed !== 'number' || !Array.isArray(obj.cables) || !obj.ui || typeof obj.ui !== 'object') return null;
    const worlds = obj.worlds.map((sw, i) => {
      const def = defs[i];
      if (!sw || sw.key !== def.key || !sw.S || !sw.POS) throw new Error('world mismatch');
      const S = { ...sw.S, found: new Set(sw.S.found) };
      if (!Array.isArray(S.nodes) || !Array.isArray(S.ropes) || typeof S.time !== 'number') throw new Error('bad S');
      const hub = S.nodes.find(n => n.kind === 'planet');
      if (!hub) throw new Error('no hub');
      const w = { def, POS: sw.POS, S, hub, TANG: new Set(), HOP: {}, started: !!sw.started, events: [] };
      w.TANG = tangled(w); allPairs(w);
      return w;
    });
    // Worlds added to content since this save was written start fresh and unstarted.
    for (let i = worlds.length; i < defs.length; i++) {
      const w = freshWorld(defs[i], obj.seed, false);
      w.TANG = tangled(w); allPairs(w);
      worlds.push(w);
    }
    return { seed: obj.seed, worlds, cables: obj.cables, ui: obj.ui, savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : 0 };
  } catch (e) {
    return null;
  }
}

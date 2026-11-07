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

// Built to grow: a content update may retire an island. Its node goes, with every rope that touches it, and
// anything that still names it (found, the selection), so an old save keeps playing instead of breaking.
function prune(S, def) {
  const ok = n => n && typeof n === 'object' && (n.kind === 'planet' || (n.kind === 'island' && Object.hasOwn(def.isl, n.id)));
  S.nodes = S.nodes.filter(ok);
  const ids = new Set(S.nodes.map(n => n.id));
  S.ropes = S.ropes.filter(r => r && ids.has(r.a) && ids.has(r.b) && r.a !== r.b);
  S.found = new Set([...S.found].filter(id => ids.has(id)));
  const sel = S.sel, keep = sel && (sel.t === 'node' ? ids.has(sel.id) : sel.t === 'rope' ? S.ropes.some(r => r.id === sel.id) : false);
  if (!keep) S.sel = { t: 'node', id: 'planet' };
}

// Returns a Game, or null for anything unusable. Never throws.
export function deserialize(obj, defs = WORLD_DEFS) {
  try {
    if (!obj || typeof obj !== 'object') return null;
    obj = migrate(plain(obj));
    if (!obj || obj.v !== SAVE_VERSION || !Array.isArray(obj.worlds) || !obj.worlds.length || obj.worlds.length > defs.length) return null;
    if (typeof obj.seed !== 'number' || !Array.isArray(obj.cables) || !obj.ui || typeof obj.ui !== 'object') return null;
    // Saved worlds match content by key, not position, so a later build can insert a world anywhere in WORLD_DEFS.
    // A saved world the content doesn't have (or one saved twice) makes the save unusable.
    const keys = obj.worlds.map(sw => sw && sw.key);
    if (new Set(keys).size !== keys.length || keys.some(k => !defs.some(d => d.key === k))) return null;
    const worlds = defs.map(def => {
      const sw = obj.worlds.find(x => x.key === def.key);
      // Worlds added to content since this save was written start fresh and unstarted.
      if (!sw) { const w = freshWorld(def, obj.seed, false); w.TANG = tangled(w); allPairs(w); return w }
      if (!sw.S || !sw.POS) throw new Error('world mismatch');
      const S = { ...sw.S, found: new Set(sw.S.found) };
      if (!Array.isArray(S.nodes) || !Array.isArray(S.ropes) || typeof S.time !== 'number') throw new Error('bad S');
      prune(S, def);
      const hub = S.nodes.find(n => n.kind === 'planet');
      if (!hub) throw new Error('no hub');
      const w = { def, POS: sw.POS, S, hub, TANG: new Set(), HOP: {}, started: !!sw.started, events: [] };
      w.TANG = tangled(w); allPairs(w);
      return w;
    });
    // Saved indices (cables, ui.world) count the save's own world order; map them onto the content's.
    const at = keys.map(k => defs.findIndex(d => d.key === k)), remap = i => Number.isInteger(i) && i >= 0 && i < at.length ? at[i] : -1;
    // A cable joins two worlds by index; one that points anywhere else would break the system step.
    if (!obj.cables.every(cb => cb && typeof cb === 'object' && remap(cb.a) >= 0 && remap(cb.b) >= 0)) return null;
    const cables = obj.cables.map(cb => ({ ...cb, a: remap(cb.a), b: remap(cb.b) }));
    obj.ui.world = Math.max(0, remap(obj.ui.world));
    // A cable bought before its next world shipped (v1's CINDER said "the next planet comes later") reaches that
    // world once the content has it: start it and run the cable, as launch() would have.
    worlds.forEach((w, i) => {
      const j = w.def.next ? worlds.findIndex(x => x.def.key === w.def.next) : -1;
      if (!w.started || w.S.cable !== true || j < 0 || worlds[j].started) return;
      worlds[j].started = true;
      if (!cables.some(c => (c.a === i && c.b === j) || (c.a === j && c.b === i))) cables.push({ a: i, b: j, u: 0, dir: 0, load: [], blocked: false });
    });
    // Fields added to ui after v1 get their defaults here (no version bump: migrate stays identity).
    if (typeof obj.ui.names !== 'boolean') obj.ui.names = true;
    return { seed: obj.seed, worlds, cables, ui: obj.ui, savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : 0 };
  } catch (e) {
    return null;
  }
}

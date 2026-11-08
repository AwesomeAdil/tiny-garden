import { WORLD_DEFS } from './content.js';
import { freshWorld } from './game.js';
import { allPairs } from './graph.js';
import { GIFTS } from './picks.js';

export const SAVE_VERSION = 2;

// A v1 save is a different game; boot.js reports it so Swift can keep it aside as save.v1.json.
export const isV1 = obj => !!obj && obj.v === 1;

const plain = o => JSON.parse(JSON.stringify(o));

// JSON-safe snapshot. HOP/events/def are derived and not stored; hub is the node with kind 'planet'.
export function serialize(game, nowMs) {
  return plain({
    v: SAVE_VERSION,
    savedAt: nowMs,
    seed: game.seed,
    worlds: game.worlds.map(w => ({ key: w.def.key, started: w.started, S: w.S })),
    cables: game.cables,
    gifts: game.gifts,
    ev: game.ev,
    ui: game.ui,
  });
}

const goodGift = g => !!g && typeof g === 'object' && Object.hasOwn(GIFTS, g.kind);

// Built to grow: a content update may retire an island. Its node goes, with every rope that touches it and the
// selection, and spots or gifts that refer to nothing, so an old save keeps playing instead of breaking.
function prune(S, def) {
  const ok = n => n && typeof n === 'object' && (n.kind === 'planet' || (n.kind === 'island' && Object.hasOwn(def.isl, n.id)));
  S.nodes = S.nodes.filter(ok);
  for (const n of S.nodes) {
    if (n.kind !== 'island') continue;
    const spots = {};
    for (const [k, s] of Object.entries(n.spots && typeof n.spots === 'object' ? n.spots : {})) {
      if (!/^[0-4]$/.test(k) || !s || typeof s !== 'object') continue;
      if (s.gift ? !goodGift(s.gift) : typeof s.pick !== 'string') continue;
      spots[k] = s;
    }
    n.spots = spots;
    n.gifts = Array.isArray(n.gifts) ? n.gifts.filter(goodGift) : [];
  }
  const ids = new Set(S.nodes.map(n => n.id));
  S.ropes = S.ropes.filter(r => r && ids.has(r.a) && ids.has(r.b) && r.a !== r.b);
  const sel = S.sel, keep = sel && (sel.t === 'node' ? ids.has(sel.id) : sel.t === 'rope' ? S.ropes.some(r => r.id === sel.id) : false);
  if (!keep) S.sel = { t: 'node', id: 'planet' };
}

// Returns a Game, or null for anything unusable. Never throws.
export function deserialize(obj, defs = WORLD_DEFS) {
  try {
    if (!obj || typeof obj !== 'object') return null;
    obj = plain(obj);
    if (obj.v !== SAVE_VERSION || !Array.isArray(obj.worlds) || !obj.worlds.length || obj.worlds.length > defs.length) return null;
    if (typeof obj.seed !== 'number' || !Array.isArray(obj.cables) || !Array.isArray(obj.gifts)) return null;
    if (!obj.ui || typeof obj.ui !== 'object' || !obj.ev || typeof obj.ev !== 'object') return null;
    // Saved worlds match content by key, not position, so a later build can insert a world anywhere in WORLD_DEFS.
    // A saved world the content doesn't have (or one saved twice) makes the save unusable.
    const keys = obj.worlds.map(sw => sw && sw.key);
    if (new Set(keys).size !== keys.length || keys.some(k => !defs.some(d => d.key === k))) return null;
    const worlds = defs.map(def => {
      const sw = obj.worlds.find(x => x.key === def.key);
      // Worlds added to content since this save was written start fresh and unstarted.
      if (!sw) { const w = freshWorld(def, obj.seed, false); allPairs(w); return w }
      const S = sw.S;
      if (!S || !Array.isArray(S.nodes) || !Array.isArray(S.ropes) || typeof S.time !== 'number') throw new Error('bad S');
      prune(S, def);
      const hub = S.nodes.find(n => n.kind === 'planet');
      if (!hub) throw new Error('no hub');
      const w = { def, S, hub, HOP: {}, started: !!sw.started, events: [] };
      allPairs(w);
      return w;
    });
    // Saved indices (cables, ui.world) count the save's own world order; map them onto the content's.
    const at = keys.map(k => defs.findIndex(d => d.key === k)), remap = i => Number.isInteger(i) && i >= 0 && i < at.length ? at[i] : -1;
    if (!obj.cables.every(cb => cb && typeof cb === 'object' && remap(cb.a) >= 0 && remap(cb.b) >= 0)) return null;
    const cables = obj.cables.map(cb => ({ a: remap(cb.a), b: remap(cb.b) }));
    obj.ui.world = Math.max(0, remap(obj.ui.world));
    if (typeof obj.ui.names !== 'boolean') obj.ui.names = true;
    const gifts = obj.gifts.filter(goodGift);
    return { seed: obj.seed, worlds, cables, gifts, ev: obj.ev, ui: obj.ui, savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : 0 };
  } catch (e) {
    return null;
  }
}

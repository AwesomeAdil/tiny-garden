// Shared play-mode helpers: what things are called on screen, and the actions more than one control performs
// (placing a gift from the card or an armed tray gift; untying from a right-click, the Untie tool or the panel).
import { untie } from '../sim/world.js';
import { placeGift } from '../sim/events.js';
import { GIFTS } from '../sim/picks.js';
import { renderPanel } from './panel.js';
import { say } from './guide.js';
import { renderTray } from './card.js';

// A node's name: "The town", or an island's own name if renamed, else its type's.
export const nameOf = (w, n) => n.kind === 'planet' ? 'The town' : n.name || w.def.isl[n.id].name;
// A gift's name: a traveller's hut carries its owner's name ("MIRA's hut").
export const giftName = g => g.kind === 'hut' && g.name ? `${g.name}'s hut` : GIFTS[g.kind] ? GIFTS[g.kind].name : 'Gift';

// Put tray gift gi on spot i of island n, say so, and disarm the tray. Returns whether it was placed.
export function placeGiftAt(app, w, n, gi, i) {
  const g = app.game.gifts[gi], ok = !!g && placeGift(app.game, w, n, gi, i);
  if (ok) say(app, `${giftName(g)} placed on ${nameOf(w, n)}.`);
  app.armedGift = null; renderTray(app); app.panelKey = ''; renderPanel(app);
  return ok;
}

// Untie bridge ropeId; a selection on it falls back to the town.
export function untieRope(app, ropeId) {
  const w = app.w, S = w.S;
  untie(w, ropeId);
  if (S.sel.t === 'rope' && S.sel.id === ropeId) S.sel = { t: 'node', id: 'planet' };
  app.panelKey = ''; renderPanel(app); say(app, 'Bridge untied.');
}

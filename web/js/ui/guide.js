// The guide line (what to do next), the hint line (what just happened) and sim events. Ported from page 38.
import { GSYS } from '../draw/galaxy.js';
import { stalls } from '../sim/flow.js';
import { isl, node } from '../sim/world.js';
import { openSpots } from '../sim/grow.js';
import { NAME } from '../core/palette.js';
import { nameOf } from './util.js';

const home = game => game.worlds[0];
const nextName = (game, w) => { const n = w.def.next && game.worlds.find(x => x.def.key === w.def.next); return n ? n.def.name : null };

export function guideText(app) {
  const game = app.game, v = game.ui.view, w = app.w, S = w.S, H0 = home(game);
  if (v === 'galaxy') return `<b>The galaxy.</b> Your home star, <b>${GSYS[0].name}</b>, is the yellow point in one arm. Click it and press <b>Zoom in</b>, or double-click it. The other stars come later. <b>N</b> hides or shows the names.`;
  if (v === 'system') return game.cables.length ? '<b>The solar system.</b> Click a planet to see it, then <b>Zoom in</b>. <b>N</b> hides or shows the names.' : `<b>The solar system.</b> The first long cable from ${H0.def.name}'s town reaches ${nextName(game, H0) || 'the next planet'}.`;
  return cityGuide(app, w);
}

// The city's lessons, in order, each until it has been done once; then the first stall; then a general nudge.
// A lesson counts as done by what the world shows (a bridge exists, goods have arrived, a spot was chosen), so a
// loaded save never re-teaches what it has already got past.
function cityGuide(app, w) {
  const S = w.S, I = isl(w);
  const delivered = S.nodes.some(n => n.stage > 1 || Object.values(n.paid).some(v => v > 0));
  if (!S.ropes.length && !delivered) { const h = node(w, 'home'); return `Drag from <b>${h ? nameOf(w, h).toUpperCase() : 'the town'}</b> to an island to tie a bridge.` }
  if (!delivered) return 'Water, light and stone travel to islands that need them.';
  const grown = I.find(n => openSpots(n).length);
  if (grown) return `${nameOf(w, grown).toUpperCase()} grew! Click a glowing spot to choose what grows there.`;
  // Lesson 4 is done by a tap on a bridge, a one-way bridge, or an island at stage 3+; once done it stays done (saved).
  const L = app.game.ui.lessons || (app.game.ui.lessons = {});
  if (S.ropes.some(r => r.way !== 0) || I.some(n => n.stage >= 3)) L.oneWay = true;
  if (S.ropes.length && !L.oneWay) return 'Tap a bridge to make it one-way.';
  const st = stalls(w)[0];
  if (st) return `${nameOf(w, node(w, st.id)).toUpperCase()} needs ${NAME[st.k].toLowerCase()}, but nothing it can reach makes it.`;
  return 'Tie bridges so every island gets what it needs. Tap a bridge to make it one-way.';
}

export function renderGuide(app) { const el = app.els.guide, v = guideText(app); if (el.dataset.last !== v) { el.dataset.last = v; el.innerHTML = v } }

const TOOLHINT = { move: '<b>Move:</b> drag an island. Click a bridge to steer it, a glowing spot to grow something.', rope: '<b>Tie a bridge:</b> drag from one place to another. The dotted circle is how far a bridge reaches.', cut: '<b>Untie:</b> click a bridge to remove it. Right-click works in any tool.' };

// Show a message on the hint line for 4 s. Messages from a world you're not looking at name it.
export function say(app, msg, warn, from, ms = 4000) {
  if (from && from !== app.w) msg = from.def.name + ': ' + msg;
  const el = app.els.hint; el.innerHTML = '<b>' + msg + '</b>'; el.dataset.last = ''; el.classList.toggle('warn', !!warn); app.hintUntil = performance.now() + ms;
}

export function idleHint(app) {
  if (performance.now() < app.hintUntil) return;
  const el = app.els.hint, d = app.drag;
  const v = app.catching ? '<b>Catching up</b> on the time you were away.' : d && d.strain ? '<b>Full stretch.</b> Its bridges won\'t reach any further.' : app.armedGift != null ? '<b>Gift:</b> click a glowing spot to place it. Esc puts it back.' : TOOLHINT[app.tool];
  if (el.dataset.last !== v) { el.dataset.last = v; el.innerHTML = v; el.classList.remove('warn') }
}

// Sim events go to the hint line in play mode; in wallpaper mode nobody is reading, so they're dropped. The
// catch-up's "while you were away" line is the exception: it is kept in the save (game.ui.away) and shown, for 8 s,
// the first time play mode is open once the catch-up has finished, then cleared.
export const eventLine = kind => (({ whale: 'A space whale is passing!', traveller: 'A traveller is passing by!', aurora: 'An aurora is lighting the sky!' })[kind] || 'Someone is passing by!');

export function drainEvents(app) {
  const ui = app.game.ui;
  if (ui.away && app.mode === 'play' && !app.catching) { say(app, ui.away, false, null, 8000); delete ui.away }
  // A visit starts when game.ev.active appears: one line per visit, however long it lasts.
  const a = app.game.ev && app.game.ev.active, id = a ? `${a.kind}@${a.t0}` : null;
  if (id !== app.seenEv) { app.seenEv = id; if (a && app.mode === 'play') say(app, eventLine(a.kind)) }
  app.game.worlds.forEach(w => {
    if (!w.events.length) return;
    const evs = w.events.splice(0);
    if (app.mode === 'play') evs.forEach(e => say(app, e.msg, e.warn, w));
  });
}

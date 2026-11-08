// The guide line (what to do next), the hint line (what just happened) and sim events. Ported from page 38.
// The city's teaching lines here are a stand-in: Task 13 writes the v2 guide (stalls, picks, the town and cable).
import { GSYS } from '../draw/galaxy.js';

const home = game => game.worlds[0];
const nextName = (game, w) => { const n = w.def.next && game.worlds.find(x => x.def.key === w.def.next); return n ? n.def.name : null };

export function guideText(app) {
  const game = app.game, v = game.ui.view, w = app.w, S = w.S, H0 = home(game);
  if (v === 'galaxy') return `<b>The galaxy.</b> Your home star, <b>${GSYS[0].name}</b>, is the yellow point in one arm. Click it and press <b>Zoom in</b>, or double-click it. The other stars come later. <b>N</b> hides or shows the names.`;
  if (v === 'system') return game.cables.length ? '<b>The solar system.</b> Click a planet to see it, then <b>Zoom in</b>. <b>N</b> hides or shows the names.' : `<b>The solar system.</b> The first long cable from ${H0.def.name}'s town reaches ${nextName(game, H0) || 'the next planet'}.`;
  if (!S.ropes.length) return '<b>Next:</b> pick <b>Rope</b> and drag from the town or an island to another one inside the dotted circle.';
  return '<b>Next:</b> tie bridges so every island gets what it needs. Click a bridge to make it one way. Click a glowing spot to choose what grows there.';
}

export function renderGuide(app) { const el = app.els.guide, v = guideText(app); if (el.dataset.last !== v) { el.dataset.last = v; el.innerHTML = v } }

const TOOLHINT = { move: '<b>Move:</b> drag an island. Click a bridge to steer it, a glowing spot to grow something.', rope: '<b>Tie a bridge:</b> drag from one place to another. The dotted circle is how far a bridge reaches.', cut: '<b>Untie:</b> click a bridge to remove it. Right-click works in any tool.' };

// Show a message on the hint line for 4 s. Messages from a world you're not looking at name it.
export function say(app, msg, warn, from) {
  if (from && from !== app.w) msg = from.def.name + ': ' + msg;
  const el = app.els.hint; el.innerHTML = '<b>' + msg + '</b>'; el.dataset.last = ''; el.classList.toggle('warn', !!warn); app.hintUntil = performance.now() + 4000;
}

export function idleHint(app) {
  if (performance.now() < app.hintUntil) return;
  const el = app.els.hint, d = app.drag;
  const v = app.catching ? '<b>Catching up</b> on the time you were away.' : d && d.strain ? '<b>Full stretch.</b> Its bridges won\'t reach any further.' : app.armedGift != null ? '<b>Gift:</b> click a glowing spot to place it. Esc puts it back.' : TOOLHINT[app.tool];
  if (el.dataset.last !== v) { el.dataset.last = v; el.innerHTML = v; el.classList.remove('warn') }
}

// Sim events go to the hint line in play mode; in wallpaper mode nobody is reading, so they're dropped.
export function drainEvents(app) {
  app.game.worlds.forEach(w => {
    if (!w.events.length) return;
    const evs = w.events.splice(0);
    if (app.mode === 'play') evs.forEach(e => say(app, e.msg, e.warn, w));
  });
}

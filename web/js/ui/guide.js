// The guide line (what to do next), the hint line (what just happened) and sim events. Ported from page 38.
import { NAME } from '../core/palette.js';
import { isl } from '../sim/world.js';
import { met, crowd } from '../sim/economy.js';
import { GSYS } from '../draw/galaxy.js';

const home = game => game.worlds[0];
const nextName = (game, w) => { const n = w.def.next && game.worlds.find(x => x.def.key === w.def.next); return n ? n.def.name : null };

export function guideText(app) {
  const game = app.game, v = game.ui.view, w = app.w, S = w.S, hub = w.hub, ISL = w.def.isl, GOAL = w.def.goal, H0 = home(game);
  if (v === 'galaxy') return `<b>The galaxy.</b> Your home star, <b>${GSYS[0].name}</b>, is the yellow point in one arm. Click it and press <b>Zoom in</b>, or double-click it. The other stars come later. <b>N</b> hides or shows the names.`;
  if (v === 'system') return game.cables.length ? '<b>The solar system.</b> Click a planet to see it, then <b>Zoom in</b>. The cable carries what each world can\'t make. The star turns it red when it\'s in the way. <b>N</b> hides or shows the names.' : `<b>The solar system.</b> Launch the first long cable from ${H0.def.name}'s town square to reach ${nextName(game, H0) || 'the next planet'}.`;
  const gl = Object.keys(GOAL).map(k => GOAL[k] + ' ' + NAME[k]).join(', '), nx = nextName(game, w);
  if (S.cable) return nx ? `<b>Done here:</b> the cable reaches ${nx}. Press <b>System</b> to zoom out and visit it.` : '<b>Done:</b> the next planet comes later. Press <b>System</b> to look at the whole system.';
  if (S.unpaid) return '<b>Upkeep is unpaid.</b> Bridges are fraying. Cut a long bridge you don\'t need, or get more Rock flowing to the town square.';
  if (Object.keys(GOAL).every(k => hub.stock[k] >= GOAL[k])) return '<b>Ready:</b> open the <b>Shop</b> and buy <b>The first long cable</b>.';
  const jam = S.nodes.find(n => crowd(w, n) > 0);
  if (jam) return `<b>Jammed:</b> ${jam.kind === 'planet' ? 'the town square' : ISL[jam.id].name} has more bridges than slots. Cut one, route through a neighbour, or buy a <b>Wider dock</b> in the Shop.`;
  if (S.found.size < 3) return `<b>Next:</b> pick <b>Rope</b> and drag from ${ISL[w.def.start].name}, or the town square, to a faint island inside the dotted circle. Watch the price tag: short hops are cheap.`;
  const slow = isl(w).find(n => S.found.has(n.id) && !met(w, n));
  if (slow) {
    const k = ISL[slow.id].needs.find(k => slow.stock[k] < 1), made = isl(w).some(n => ISL[n.id].makes === k);
    return `<b>Next:</b> ${ISL[slow.id].name} is slowed because it needs ${NAME[k]}. ${w !== H0 && !made ? `Nothing here makes it, so it has to come from ${H0.def.name} through the cable.` : 'Tie it to an island that makes ' + NAME[k] + ', or to something in between.'}`;
  }
  if (S.found.size < isl(w).length + 1) return '<b>Next:</b> there are still faint islands to find. Each one changes what its neighbours can do.';
  return `<b>Goal:</b> get ${gl} to the town square, then buy the cable in the Shop.`;
}

export function renderGuide(app) { const el = app.els.guide, v = guideText(app); if (el.dataset.last !== v) { el.dataset.last = v; el.innerHTML = v } }

const TOOLHINT = { move: '<b>Move:</b> drag an island. Click anything to see it up close.', rope: '<b>Tie rope:</b> drag from one place to another. The dotted circle is how far a rope reaches.', cut: '<b>Cut:</b> click a bridge to remove it.' };

// Show a message on the hint line for 4 s. Messages from a world you're not looking at name it.
export function say(app, msg, warn, from) {
  if (from && from !== app.w) msg = from.def.name + ': ' + msg;
  const el = app.els.hint; el.innerHTML = '<b>' + msg + '</b>'; el.dataset.last = ''; el.classList.toggle('warn', !!warn); app.hintUntil = performance.now() + 4000;
}

export function idleHint(app) {
  if (performance.now() < app.hintUntil) return;
  const el = app.els.hint, d = app.drag;
  const v = app.catching ? '<b>Catching up</b> on the time you were away.' : d && d.strain ? '<b>Full stretch.</b> That rope won\'t go any further.' : app.shop ? '<b>Shop:</b> click an island or a bridge on the map to choose what to buy for. Press S to close.' : TOOLHINT[app.tool];
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

// Developer mode's strip in the side panel (#devbar) and the DEV tag in the dock (#devtag), both play mode only.
// Each button is one sim/dev.js helper. The guard is here: devAction refuses everything unless developer mode is on
// (app.dev.on, web/js/devmode.js) and the page is in play mode, so no dev button can reach the real garden.
import { node } from '../sim/world.js';
import { devGrow, devFill, devEvent, devGift, devTown, devCable, skip } from '../sim/dev.js';
import { EVENTS, TRAY_MAX } from '../sim/events.js';
import { GIFTS } from '../sim/picks.js';
import { setSpeed, askNewMap } from './dock.js';
import { renderPanel } from './panel.js';
import { renderTray } from './card.js';
import { say } from './guide.js';
import { nameOf } from './util.js';

export const DEV_SPEEDS = [1, 60, 600];
export const DEV_ACTS = ['speed', 'grow', 'fill', 'whale', 'traveller', 'aurora', 'gift', 'town', 'cable', 'jump', 'new'];
const VISITOR = { whale: 'A space whale', traveller: 'A traveller', aurora: 'An aurora' };

export const devOn = app => !!(app.dev && app.dev.on) && app.mode === 'play' && !!app.game;

// The selected island in the current world, or null.
const selIsland = app => { const S = app.w.S, n = S.sel && S.sel.t === 'node' ? node(app.w, S.sel.id) : null; return n && n.kind === 'island' ? n : null };
const no = msg => ({ ok: false, msg });

// One button's effect on the game. Returns { ok, msg, ask? } and touches nothing but app.game.
export function devAction(app, act, v) {
  if (!devOn(app)) return no('Developer mode is off.');
  const game = app.game, w = app.w;
  switch (act) {
    case 'speed':
      if (!DEV_SPEEDS.includes(v)) return no('Speeds are x1, x60 and x600.');
      game.ui.speed = v; return { ok: true, msg: `Speed x${v}.` };
    case 'grow': case 'fill': {
      const n = selIsland(app);
      if (!n) return no('Select an island first.');
      const nm = nameOf(w, n);
      if (act === 'grow') return devGrow(w, n) ? { ok: true, msg: `${nm} grew to stage ${n.stage}.` } : no(`${nm} is at the top stage.`);
      return devFill(w, n) ? { ok: true, msg: `${nm}'s stage ${n.stage} is paid. It grows on the next step.` } : no(`${nm} has nothing left to pay.`);
    }
    case 'whale': case 'traveller': case 'aurora':
      if (game.ev.active) return no('A visitor is already here.');
      if (!devEvent(game, act)) return no('No visitor came.');
      return { ok: true, msg: `${VISITOR[act]} is passing ${game.worlds[0].def.name}.` + (game.gifts.length >= TRAY_MAX ? ' The tray is full: its gift will be lost.' : ` It leaves ${GIFTS[EVENTS[act].gift].name.toLowerCase()} when it goes.`) };
    case 'gift':
      return devGift(game) ? { ok: true, msg: 'A gift is in the tray.' } : no(`The tray is full (${TRAY_MAX}).`);
    case 'town':
      return devTown(game, w) ? { ok: true, msg: `The town is at stage ${w.hub.stage}.` } : no('The town is at stage 4. Cable builds the long cable.');
    case 'cable':
      return devCable(game, w) ? { ok: true, msg: 'The long cable is built.' } : no(w.S.cable ? 'The cable is already built.' : 'This world has no next world.');
    case 'jump':
      skip(game); return { ok: true, msg: `Jumped ahead: ${game.worlds[0].def.name} networked at stage 3, its cable built.` };
    case 'new':
      return { ok: true, ask: true, msg: '' };
    default:
      return no('Unknown dev action.');
  }
}

// Shows the strip and the tag only while dev is on in play mode, and presses the current speed.
export function renderDevbar(app) {
  const on = devOn(app), sp = app.game ? app.game.ui.speed : 1, key = on + ':' + sp;
  if (app.devKey === key) return;
  app.devKey = key;
  app.els.devbar.hidden = !on; app.els.devtag.hidden = !on;
  app.els.devbar.querySelectorAll('[data-dev="speed"]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === sp ? 'true' : 'false'));
}

export function wireDevbar(app) {
  app.els.devbar.addEventListener('click', e => {
    const b = e.target.closest('[data-dev]'); if (!b) return;
    const act = b.dataset.dev, r = devAction(app, act, b.dataset.v != null ? +b.dataset.v : undefined);
    if (r.ok && r.ask) return askNewMap(app, true);
    if (r.ok && act === 'speed') setSpeed(app, app.game.ui.speed);
    if (r.msg) say(app, r.msg, !r.ok);
    app.panelKey = ''; app.devKey = ''; renderPanel(app); renderTray(app); renderDevbar(app);
  });
  // ⌥⇧D in play mode turns developer mode on or off (main.js app.toggleDev).
  document.addEventListener('keydown', e => {
    if (app.mode !== 'play' || !e.altKey || !e.shiftKey || e.metaKey || e.ctrlKey || e.code !== 'KeyD') return;
    e.preventDefault(); app.toggleDev();
  });
}

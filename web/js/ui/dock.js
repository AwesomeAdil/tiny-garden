// The dock (Build / Spend / View / Time / New map), the keyboard, and the in-world New map prompt. Ported from page 38.
import { uiconURL } from '../core/icons.js';
import { galInvalidate, GSYS } from '../draw/galaxy.js';
import { renderPanel } from './panel.js';
import { renderTags } from './tags.js';
import { renderPrice } from './price.js';
import { renderGuide, say } from './guide.js';
import { escAction, nextView } from './esc.js';

const $$ = (app, q) => app.els.dock.querySelectorAll(q);
const press = (b, on) => b.setAttribute('aria-pressed', on ? 'true' : 'false');

export function setTool(app, t) {
  app.tool = t; if (app.shop && t !== 'move') setShop(app, false);
  $$(app, '[data-tool]').forEach(b => press(b, b.dataset.tool === t));
  app.els.map.className = t === 'move' ? '' : t; app.hintUntil = 0;
}

// Switch the big view: 'planet' (the current world's city), 'system', 'galaxy' or 'close' (the close-up).
export function setView(app, v) {
  const ui = app.game.ui; ui.view = v;
  // A drag never survives a view change: no unseen ties or moves, and its rope preview and price tag go with it.
  app.drag = null; renderPrice(app);
  $$(app, '[data-view]').forEach(b => press(b, b.dataset.view === v));
  if (v === 'system') ui.sysSel = app.w.def.name;
  if (v === 'galaxy') ui.galSel = GSYS[0].name;
  if (v !== 'planet' && app.shop) { app.shop = false; press(app.els.shopbtn, false) }
  galInvalidate(app.mapCtx); galInvalidate(app.viewCtx);
  app.panelKey = ''; app.els.tags.dataset.last = ''; app.namesKey = ''; app.namesPrev = null;
  // Each view has its own canvas size (main.js layout), so re-fit and redraw before the tags and names.
  if (app.onView) app.onView();
  renderPanel(app); renderTags(app); renderGuide(app);
}

// N: show or hide the galaxy and system names. Remembered in the save (game.ui.names); the wallpaper follows it.
export function toggleNames(app) {
  const ui = app.game.ui; ui.names = ui.names === false; app.namesKey = ''; app.namesPrev = null; renderTags(app);
  say(app, ui.names ? 'Names on. Press N to hide them.' : 'Names hidden. Press N to show them.');
}

export function zoomTo(app, i) {
  app.game.ui.world = i; app.shop = false; press(app.els.shopbtn, false);
  app.w.S.sel = app.w.S.sel || { t: 'node', id: 'planet' };
  setView(app, 'planet'); say(app, 'Zoomed into ' + app.w.def.name + '.');
}

export const goView = (app, v) => v === 'planet' ? zoomTo(app, app.game.ui.world) : setView(app, v);

export function setShop(app, on) {
  app.shop = on; if (on && app.game.ui.view !== 'planet') zoomTo(app, app.game.ui.world);
  app.shop = on; press(app.els.shopbtn, on); app.panelKey = ''; renderPanel(app); app.hintUntil = 0;
}

export function setSpeed(app, s) { app.game.ui.speed = s; $$(app, '[data-speed]').forEach(b => press(b, +b.dataset.speed === s)) }

// Sync every pressed state with the game (after boot or a new map).
export function syncDock(app) {
  setTool(app, app.tool); setSpeed(app, app.game.ui.speed); press(app.els.shopbtn, app.shop);
  $$(app, '[data-view]').forEach(b => press(b, b.dataset.view === app.game.ui.view));
}

// New map asks once, in the world, never with a browser dialog.
export function askNewMap(app, on) { app.asking = on; app.els.ask.hidden = !on; press(app.els.newbtn, on); if (on) app.els.ask.querySelector('[data-ask="yes"]').focus() }

export function onEsc(app) {
  if (app.asking) return askNewMap(app, false);
  const S = app.w.S, a = escAction({ drag: app.drag, shop: app.shop, sel: app.game.ui.view === 'planet' ? S.sel : null });
  if (a === 'cancel-drag') { app.drag = null }
  else if (a === 'close-shop') setShop(app, false);
  else if (a === 'clear-selection') { S.sel = { t: 'node', id: 'planet' }; app.panelKey = ''; renderPanel(app) }
  else app.exit();
}

export function wireDock(app) {
  app.els.dock.querySelectorAll('img[data-ui]').forEach(i => { i.src = uiconURL(i.dataset.ui) });
  app.els.ask.querySelectorAll('img[data-ui]').forEach(i => { i.src = uiconURL(i.dataset.ui) });
  $$(app, '[data-tool]').forEach(b => b.addEventListener('click', () => setTool(app, b.dataset.tool)));
  $$(app, '[data-view]').forEach(b => b.addEventListener('click', () => goView(app, b.dataset.view)));
  $$(app, '[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(app, +b.dataset.speed)));
  app.els.shopbtn.addEventListener('click', () => setShop(app, !app.shop));
  app.els.newbtn.addEventListener('click', () => askNewMap(app, !app.asking));
  app.els.ask.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (!b) return; askNewMap(app, false); if (b.dataset.ask === 'yes') app.newMap() });

  document.addEventListener('keydown', e => {
    if (app.mode !== 'play') return;
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); onEsc(app); return }
    if (app.asking) { if (k === 'enter') { askNewMap(app, false); app.newMap() } return }
    if (e.altKey) return;
    if (k === 'm') setTool(app, 'move'); else if (k === 'r') setTool(app, 'rope'); else if (k === 'c') setTool(app, 'cut');
    else if (k === 's') setShop(app, !app.shop);
    else if (k === 'n') toggleNames(app);
    else if (k === 'tab') { e.preventDefault(); goView(app, nextView(app.game.ui.view)) }
    else if (k === '1') goView(app, 'planet'); else if (k === '2') goView(app, 'system'); else if (k === '3') goView(app, 'galaxy'); else if (k === '4') goView(app, 'close');
  });
}

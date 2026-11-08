// The dock (Build / View / Time / New map), the keyboard, and the in-world New map prompt. Ported from page 38.
import { uiconURL } from '../core/icons.js';
import { galInvalidate, GSYS } from '../draw/galaxy.js';
import { renderPanel } from './panel.js';
import { renderTags, invalidateTags } from './tags.js';
import { closeCard, renderTray } from './card.js';
import { renderGuide, say } from './guide.js';
import { escAction, nextView } from './esc.js';

const $$ = (app, q) => app.els.dock.querySelectorAll(q);
const press = (b, on) => b.setAttribute('aria-pressed', on ? 'true' : 'false');

export function setTool(app, t) {
  app.tool = t;
  $$(app, '[data-tool]').forEach(b => press(b, b.dataset.tool === t));
  app.els.map.className = t === 'move' ? '' : t; app.hintUntil = 0;
}

// Switch the big view: 'planet' (the current world's city), 'system', 'galaxy' or 'close' (the close-up).
export function setView(app, v) {
  const ui = app.game.ui; ui.view = v;
  // A drag, an open card or an armed gift never survives a view change: no unseen ties, moves or placements.
  app.drag = null; closeCard(app); if (app.armedGift != null) { app.armedGift = null; renderTray(app) }
  $$(app, '[data-view]').forEach(b => press(b, b.dataset.view === v));
  if (v === 'system') ui.sysSel = app.w.def.name;
  if (v === 'galaxy') ui.galSel = GSYS[0].name;
  galInvalidate(app.mapCtx); galInvalidate(app.viewCtx);
  app.panelKey = ''; invalidateTags(app); app.namesKey = ''; app.namesPrev = null;
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
  app.game.ui.world = i;
  app.w.S.sel = app.w.S.sel || { t: 'node', id: 'planet' };
  setView(app, 'planet'); say(app, 'Zoomed into ' + app.w.def.name + '.');
}

export const goView = (app, v) => v === 'planet' ? zoomTo(app, app.game.ui.world) : setView(app, v);

export function setSpeed(app, s) { app.game.ui.speed = s; $$(app, '[data-speed]').forEach(b => press(b, +b.dataset.speed === s)) }

// Sync every pressed state with the game (after boot or a new map).
export function syncDock(app) {
  setTool(app, app.tool); setSpeed(app, app.game.ui.speed);
  $$(app, '[data-view]').forEach(b => press(b, b.dataset.view === app.game.ui.view));
}

// New map asks once, in the world, never with a browser dialog. Each prompt makes at most one new map
// (app.askArmed): a second confirm (Enter, then the focused button's click) would archive the new map over save.prev.json.
// In developer mode the same prompt makes a new sandbox (save.dev.json); the real garden is not touched.
const ASK = {
  map: ['Start a new map?', 'A fresh garden with the islands somewhere else. This one is kept as a backup.', 'New map'],
  dev: ['Start a new sandbox?', 'A fresh dev garden in save.dev.json. Your real garden is not touched.', 'New sandbox'],
};
// Which prompt this mode asks: 'dev' (a new sandbox) or 'map' (a new real map).
export const askKind = app => app.dev && app.dev.on ? 'dev' : 'map';
// A prompt remembers its kind (app.askKind); confirming one that no longer matches the mode does nothing, so a
// "New sandbox?" can never make a new real map, nor a "New map?" a sandbox.
export function askNewMap(app, on) {
  app.asking = on; app.askArmed = on; app.askKind = on ? askKind(app) : null; app.els.ask.hidden = !on; press(app.els.newbtn, on);
  if (!on) return;
  const q = s => app.els.ask.querySelector(s), [t, p, y] = ASK[app.askKind];
  q('#askt').textContent = t; q('#askp').textContent = p; q('[data-ask="yes"]').textContent = y;
  q('[data-ask="yes"]').focus();
}
export function confirmNewMap(app) {
  if (!app.askArmed) return;
  const kind = app.askKind;
  askNewMap(app, false);
  if (kind === askKind(app)) app.newMap(kind);
}

export function onEsc(app) {
  if (app.asking) return askNewMap(app, false);
  // An open card or an armed gift is the step after a drag.
  const S = app.w.S, a = escAction({ renaming: !!app.renaming, drag: app.drag, card: !!app.card || app.armedGift != null, sel: app.game.ui.view === 'planet' ? S.sel : null });
  if (a === 'cancel-rename') { app.renaming = null; app.panelKey = ''; renderPanel(app) }
  else if (a === 'cancel-drag') { app.drag = null }
  else if (a === 'close-card') { closeCard(app); app.armedGift = null; renderTray(app) }
  else if (a === 'clear-selection') { S.sel = { t: 'node', id: 'planet' }; app.panelKey = ''; renderPanel(app) }
  else app.exit();
}

export function wireDock(app) {
  app.els.dock.querySelectorAll('img[data-ui]').forEach(i => { i.src = uiconURL(i.dataset.ui) });
  app.els.ask.querySelectorAll('img[data-ui]').forEach(i => { i.src = uiconURL(i.dataset.ui) });
  $$(app, '[data-tool]').forEach(b => b.addEventListener('click', () => setTool(app, b.dataset.tool)));
  $$(app, '[data-view]').forEach(b => b.addEventListener('click', () => goView(app, b.dataset.view)));
  $$(app, '[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(app, +b.dataset.speed)));
  app.els.newbtn.addEventListener('click', () => askNewMap(app, !app.asking));
  app.els.ask.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (!b) return; if (b.dataset.ask === 'yes') confirmNewMap(app); else askNewMap(app, false) });

  document.addEventListener('keydown', e => {
    if (app.mode !== 'play') return;
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); onEsc(app); return }
    // Enter answers the prompt once: "Keep this one" if that button has focus, otherwise yes. preventDefault keeps
    // the focused button from also clicking (and confirmNewMap is armed once per prompt anyway).
    if (app.asking) { if (k === 'enter') { e.preventDefault(); const b = e.target.closest && e.target.closest('[data-ask]'); if (b && b.dataset.ask === 'no') askNewMap(app, false); else confirmNewMap(app) } return }
    if (e.altKey) return;
    if (k === 'm') setTool(app, 'move'); else if (k === 'r') setTool(app, 'rope'); else if (k === 'c') setTool(app, 'cut');
    else if (k === 'n') toggleNames(app);
    else if (k === 'tab') { e.preventDefault(); goView(app, nextView(app.game.ui.view)) }
    else if (k === '1') goView(app, 'planet'); else if (k === '2') goView(app, 'system'); else if (k === '3') goView(app, 'galaxy'); else if (k === '4') goView(app, 'close');
  });
}

// Boot, clock, modes, scaling and the Swift bridge (window.garden).
// Swift -> JS: garden.boot(saveObj|null, mode, nowMs), setMode('wallpaper'|'play'), pause(), resume(), saveNow() -> object.
// JS -> Swift: webkit.messageHandlers.garden.postMessage({type:'ready'|'save'|'exit'|'bad-save'|'new-map', ...}).
// Standalone (no webkit, for dev and shots): boots from ?seed&mode&view&skip&world&n&dump.
import { newGame, advance } from './sim/game.js';
import { serialize, deserialize } from './sim/save.js';
import { skip } from './sim/dev.js';
import { node } from './sim/world.js';
import { sysPlanets } from './sim/system.js';
import { W, H } from './sim/content.js';
import { bg } from './draw/scene.js';
import { drawMap } from './draw/map.js';
import { drawSystem } from './draw/system.js';
import { drawGalaxy, galInvalidate, GSYS } from './draw/galaxy.js';
import { planetView, islandView, dawn } from './draw/closeup.js';
import { renderTags } from './ui/tags.js';
import { renderPrice } from './ui/price.js';
import { renderPanel, renderStock, wirePanel } from './ui/panel.js';
import { renderGuide, idleHint, drainEvents } from './ui/guide.js';
import { wireDock, syncDock, setSpeed, askNewMap } from './ui/dock.js';
import { wireInput } from './ui/input.js';

const MAX_GAP = 43200, CHUNK = 1800, SAVE_MS = 30000, FIRST_DAYS = 3 * 864e5;
const VIEWS = ['planet', 'system', 'galaxy'];
const $ = id => document.getElementById(id);
const bridge = () => window.webkit?.messageHandlers?.garden;
const post = msg => { try { bridge()?.postMessage(msg) } catch (e) { /* no host */ } };
const native = !!bridge();

const els = { sky: $('sky'), stage: $('stage'), mapbox: $('mapbox'), map: $('map'), tags: $('tags'), price: $('price'), where: $('where'), catch: $('catch'), playtag: $('playtag'), ask: $('ask'),
  side: $('side'), view: $('view'), vlbl: $('vlbl'), vday: $('vday'), panel: $('panel'), dock: $('dock'), shopbtn: $('shopbtn'), newbtn: $('newbtn'), guide: $('guide'), stock: $('stock'), hint: $('hint') };

const app = {
  game: null, mode: 'wallpaper', tool: 'move', shop: false, drag: null, pointer: null, t: 0, panelKey: '', hintUntil: 0, asking: false, catching: false,
  els, mapCtx: els.map.getContext('2d'), viewCtx: els.view.getContext('2d'),
  get w() { return this.game.worlds[this.game.ui.world] || this.game.worlds[0] },
  exit: () => native ? post({ type: 'exit' }) : setMode('wallpaper'),
  newMap: () => { post({ type: 'new-map' }); start(newGame(randSeed()), 'play', Date.now()); save() },
};
window.__app = app; // dev handle for the console and scripted checks
const skyCtx = els.sky.getContext('2d'), tile = document.createElement('canvas'); tile.width = W; tile.height = H;
const tileCtx = tile.getContext('2d');
let sky = { x0: 0, y0: 0, mx: 0, my: 0 };

const randSeed = () => Math.floor(Math.random() * 2147483647);
const setText = (el, v) => { if (el.textContent !== v) el.textContent = v };

// ---------- clock ----------
let lastMs = 0, behind = 0, paused = false, timer = 0, raf = 0, lastDraw = -1e9, lastView = -1e9, lastPanel = -1e9, lastSave = 0;
const t0 = performance.now();

function tick() {
  timer = raf = 0;
  if (paused || !app.game) return;
  const game = app.game, now = Date.now(), dt = (now - lastMs) / 1000; lastMs = now;
  // Any gap over 1 s (sleep, quit, throttling) is caught up in chunks, never in one frame.
  if (dt > 1) behind = Math.min(MAX_GAP, behind + dt);
  else if (dt > 0) advance(game, dt, app.mode);
  if (behind > 0) { const c = Math.min(CHUNK, behind); advance(game, c, 'wallpaper'); behind -= c; if (behind < 1e-6) behind = 0 }
  app.catching = behind > 0;
  drainEvents(app);

  const p = performance.now(), play = app.mode === 'play'; app.t = (p - t0) / 1000;
  if (p - lastDraw >= (play ? 50 : 100) - 4) { lastDraw = p; drawMain(); if (play) renderPrice(app) }
  if (play && p - lastView >= 110) { lastView = p; drawView() }
  if (p - lastPanel >= 250) { lastPanel = p; renderSlow() }
  if (now - lastSave >= SAVE_MS) save();
  schedule();
}
// Play runs on animation frames; wallpaper ticks about 10 times a second.
function schedule() {
  if (paused || timer || raf) return;
  if (app.mode === 'play') raf = requestAnimationFrame(tick); else timer = setTimeout(tick, 100);
}
function unschedule() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0 }

// ---------- drawing ----------
function drawMain() {
  const game = app.game, ui = game.ui, w = app.w, t = app.t, ctx = app.mapCtx, play = app.mode === 'play';
  if (ui.view === 'galaxy') { if (!play) galInvalidate(ctx); drawGalaxy(ctx, t, play ? ui.galSel : null) }
  else if (ui.view === 'system') drawSystem(ctx, game, t, play ? ui.sysSel : null);
  else if (play) drawMap(ctx, game, w, t, { drag: app.drag, pointer: app.pointer, tool: app.tool });
  else { const S = w.S, keep = S.sel; S.sel = { t: 'none', id: null }; try { drawMap(ctx, game, w, t) } finally { S.sel = keep } }
  drawSky(t);
}

// The sky around the map: the map's own starfield, tiled so its pixel grid lines up with the map's.
function drawSky(t) {
  bg(tileCtx, W, H, t, 70);
  const c = skyCtx, cw = els.sky.width, ch = els.sky.height, ox = ((sky.mx % W) + W) % W - W, oy = ((sky.my % H) + H) % H - H;
  for (let y = oy; y < ch; y += H) for (let x = ox; x < cw; x += W) c.drawImage(tile, x, y);
}

function drawView() {
  const game = app.game, ui = game.ui, w = app.w, S = w.S, t = app.t, c = app.viewCtx, day = s => 'day ' + (1 + Math.floor(s / 60));
  if (ui.view === 'galaxy') {
    const g = GSYS.find(x => x.name === ui.galSel) || GSYS[0];
    if (g.ours) { planetView(c, game, w, t); setText(els.vlbl, g.name.toLowerCase() + ' · ' + w.def.name.toLowerCase() + ' town square') }
    else { dawn(c, t); setText(els.vlbl, g.name.toLowerCase() + ' · not reached yet') }
    return setText(els.vday, day(game.worlds[0].S.time));
  }
  if (ui.view === 'system') {
    const p = sysPlanets(game).find(x => x.name === ui.sysSel);
    if (p && p.w && p.w.started) { planetView(c, game, p.w, t); setText(els.vlbl, p.full + ' · ' + p.name.toLowerCase()) }
    else { dawn(c, t); setText(els.vlbl, (p ? p.full : 'the system') + ' · not reached yet') }
    return setText(els.vday, day(game.worlds[0].S.time));
  }
  const n = S.sel.t === 'node' ? node(w, S.sel.id) : null;
  if (!n || n.kind === 'planet' || !S.found.has(n.id)) { planetView(c, game, w, t); setText(els.vlbl, w.def.full + ' · town square') }
  else { islandView(c, w, n, t); setText(els.vlbl, w.def.isl[n.id].name.toLowerCase() + ' · level ' + n.level) }
  setText(els.vday, day(S.time));
}

function renderSlow() {
  const game = app.game, v = game.ui.view, play = app.mode === 'play';
  setText(els.where, v === 'galaxy' ? 'THE GALAXY' : v === 'system' ? GSYS[0].name.toUpperCase() + ' · SOLAR SYSTEM' : app.w.def.name);
  renderTags(app);
  els.catch.classList.toggle('on', app.catching);
  els.playtag.classList.toggle('on', Date.now() - (game.ui.firstSeen || 0) < FIRST_DAYS);
  if (play) { renderPanel(app); renderStock(app); renderGuide(app); idleHint(app) }
}

function renderAll() { lastDraw = lastView = lastPanel = -1e9; app.panelKey = ''; els.tags.dataset.last = ''; drawMain(); if (app.mode === 'play') { drawView(); renderPrice(app) } renderSlow() }

// ---------- scaling ----------
// The map gets the largest whole-number scale that fits the stage, counted in device pixels.
function layout() {
  const dpr = window.devicePixelRatio || 1, vw = innerWidth, vh = innerHeight, root = document.documentElement.style;
  const ui = app.mode === 'play' && vw >= 2200 && vh >= 1300 ? 2 : 1; root.setProperty('--ui', ui);
  const r = els.stage.getBoundingClientRect(), dW = Math.floor(r.width * dpr), dH = Math.floor(r.height * dpr);
  const s = Math.max(1, Math.floor(Math.min(dW / W, dH / H))), mw = W * s, mh = H * s, ox = Math.floor((dW - mw) / 2), oy = Math.floor((dH - mh) / 2);
  Object.assign(els.mapbox.style, { left: ox / dpr + 'px', top: oy / dpr + 'px', width: mw / dpr + 'px', height: mh / dpr + 'px' });
  root.setProperty('--s', String(Math.max(1, Math.ceil(s / 2 - .5)) / dpr));
  // Sky: same pixel size as the map, its grid aligned to the map's top-left corner.
  const Lx = Math.round(r.left * dpr) + ox, Ly = Math.round(r.top * dpr) + oy, x0 = (Lx % s) - s, y0 = (Ly % s) - s;
  const cols = Math.ceil((vw * dpr - x0) / s) + 1, rows = Math.ceil((vh * dpr - y0) / s) + 1;
  if (els.sky.width !== cols) els.sky.width = cols; if (els.sky.height !== rows) els.sky.height = rows;
  Object.assign(els.sky.style, { left: x0 / dpr + 'px', top: y0 / dpr + 'px', width: cols * s / dpr + 'px', height: rows * s / dpr + 'px' });
  sky = { mx: (Lx - x0) / s, my: (Ly - y0) / s };
  // Close-up: whole-number scale across the side column.
  if (app.mode === 'play') { const k = Math.max(1, Math.floor(els.side.clientWidth * dpr / 200)); Object.assign(els.view.style, { width: 200 * k / dpr + 'px', height: 120 * k / dpr + 'px' }) }
}

// ---------- modes and saving ----------
const snapshot = () => serialize(app.game, Date.now() - behind * 1000);
function save() { lastSave = Date.now(); if (app.game) post({ type: 'save', save: snapshot() }) }

function setMode(m) {
  m = m === 'play' ? 'play' : 'wallpaper';
  app.mode = m; document.body.classList.toggle('wallpaper', m !== 'play');
  if (!app.game) return;
  if (m !== 'play') { setSpeed(app, 1); app.drag = null; app.pointer = null; askNewMap(app, false); renderPrice(app) }
  unschedule(); renderAll(); layout(); renderAll(); save(); schedule();
}

function start(game, mode, nowMs) {
  const ui = game.ui;
  if (!VIEWS.includes(ui.view)) ui.view = 'planet';
  if (!(ui.world >= 0 && ui.world < game.worlds.length && game.worlds[ui.world].started)) ui.world = 0;
  ui.speed = 1; ui.pri = ui.pri || 'auto';
  if (!ui.firstSeen) ui.firstSeen = nowMs;
  behind = Math.min(MAX_GAP, Math.max(0, (nowMs - (game.savedAt || nowMs)) / 1000));
  lastMs = Date.now(); lastSave = lastMs;
  Object.assign(app, { game, tool: 'move', shop: false, drag: null, pointer: null, panelKey: '', hintUntil: 0 });
  game.worlds.forEach(w => { w.events.length = 0 });
  syncDock(app); setMode(mode);
}

window.garden = {
  boot(saveObj, mode, nowMs = Date.now()) {
    let game = null;
    if (saveObj != null) { try { game = deserialize(saveObj) } catch (e) { game = null } if (!game) post({ type: 'bad-save' }) }
    if (!game) { game = newGame(randSeed()); game.savedAt = nowMs }
    start(game, mode, nowMs);
  },
  setMode,
  pause() { paused = true; unschedule() },
  resume() { if (!paused) return; paused = false; schedule() },
  saveNow: () => app.game ? snapshot() : null,
};

// ---------- wiring ----------
wireDock(app); wirePanel(app); wireInput(app);
document.addEventListener('contextmenu', e => e.preventDefault());
// Re-fit whenever the stage or side column changes size (window resize, mode switch, a line wrapping).
new ResizeObserver(() => { if (app.game) { layout(); renderAll() } }).observe(els.stage);
if (!native) document.addEventListener('keydown', e => { if (e.altKey && e.code === 'KeyE' && app.game) { e.preventDefault(); setMode(app.mode === 'play' ? 'wallpaper' : 'play') } });

if (native) post({ type: 'ready' });
else {
  const q = new URLSearchParams(location.search), seed = q.has('seed') ? +q.get('seed') : randSeed(), game = newGame(seed);
  if (q.get('skip') === '1') { skip(game); game.ui.view = 'system'; game.ui.sysSel = (game.worlds.find(w => w.started && w !== game.worlds[0]) || game.worlds[0]).def.name }
  let v = q.get('view'); if (v === 'city') v = 'planet';
  if (VIEWS.includes(v)) { game.ui.view = v; if (v === 'galaxy') game.ui.galSel = GSYS[0].name; if (v === 'system' && !game.ui.sysSel) game.ui.sysSel = game.worlds[0].def.name }
  if (q.has('world') && game.worlds[+q.get('world')]?.started) game.ui.world = +q.get('world');
  if (q.has('n')) { const w = game.worlds[game.ui.world]; if (node(w, q.get('n'))) w.S.sel = { t: 'node', id: q.get('n') } }
  game.savedAt = Date.now();
  start(game, q.get('mode') === 'wallpaper' ? 'wallpaper' : 'play', Date.now());
  if (q.get('dump') === '1') setTimeout(dump, 1500);
}

// Dev: write the map and close-up canvases into the DOM (for scripts/shot.mjs), and check that drawing never changes the game.
function dump() {
  const before = JSON.stringify(serialize(app.game, 0)); drawMain(); if (app.mode === 'play') drawView();
  if (JSON.stringify(serialize(app.game, 0)) !== before) throw new Error('drawing changed the game state');
  [['dump-map', els.map], ['dump-view', els.view]].forEach(([id, cv]) => { const pre = document.createElement('pre'); pre.id = id; pre.hidden = true; pre.textContent = cv.toDataURL('image/png'); document.body.append(pre) });
}

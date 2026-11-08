// Boot, clock, modes, scaling and the Swift bridge (window.garden).
// Swift -> JS: garden.boot(saveObj|null, mode, nowMs, {topInset}?), setMode('wallpaper'|'play'), pause(), resume(), saveNow() -> object.
// JS -> Swift: webkit.messageHandlers.garden.postMessage({type:'ready'|'save'|'exit'|'bad-save'|'new-map', ...}).
// Standalone (no webkit, for dev and shots): boots from ?seed&mode&view&skip&world&n&dump.
import { newGame, frame } from './sim/game.js';
import { serialize } from './sim/save.js';
import { trialLoad } from './boot.js';
import { skip } from './sim/dev.js';
import { startClock, clockSavedAt } from './sim/clock.js';
import { node, tie } from './sim/world.js';
import { sysPlanets } from './sim/system.js';
import { W, H } from './sim/content.js';
import { viewScale, worldView } from './core/pixel.js';
import { VIEWS } from './ui/esc.js';
import { skyLayer, twinkle } from './draw/kit.js';
import { drawCity } from './draw/city.js';
import { drawSystem } from './draw/system.js';
import { drawGalaxy, galInvalidate, galPanFor, GSYS } from './draw/galaxy.js';
import { planetView, islandView, dawn } from './draw/closeup.js';
import { renderTags, invalidateTags } from './ui/tags.js';
import { renderPanel, wirePanel } from './ui/panel.js';
import { renderGuide, idleHint, drainEvents } from './ui/guide.js';
import { wireDock, syncDock, setSpeed, askNewMap } from './ui/dock.js';
import { wireInput } from './ui/input.js';
import { wireCard, openCard, closeCard, renderTray } from './ui/card.js';
import { PixCtx } from './core/pixctx.js';
import { present } from './core/present.js';
import { WALL_MS } from './core/cadence.js';
import { STARS, GROUPS, PERIODS, visibleStars, starDiff, drawStar, clearStar } from './core/stars.js';

const SAVE_MS = 30000;
// Wallpaper is a quiet background that still moves: the map draws 6 times a second (WALL_MS, core/cadence.js:
// walkers, waterfalls, events), but WebKit's cost per frame grows with the area it repaints, so only the box
// around the pixels that changed is put (core/present.js), a frame that didn't change puts nothing, the twinkling
// stars live on CSS-animated layers instead of the canvas (core/stars.js), and the full-screen sky around the map
// repaints every 10 s.
// docs/TIMINGS.md has the measurements.
// The close-up's dawn planet body is per-pixel, so it re-renders every 4 s in wallpaper (every 0.5 s in play).
// The wallpaper galaxy turns at 0.2 of play's spin in steps of 2/3 s (every 4th frame), so the disc edge moves
// 0.75 px a step and reads as smooth; the disc costs about 2.5 ms to recompute at 688x288 (docs/TIMINGS.md).
const SKY_MS = 10000, GAL_WALL_SPIN = .2, GAL_WALL_STEP = 1.5, DAWN_STEP = 4;
const $ = id => document.getElementById(id);
const bridge = () => window.webkit?.messageHandlers?.garden;
const post = msg => { try { bridge()?.postMessage(msg) } catch (e) { /* no host */ } };
const native = !!bridge();

const els = { sky: $('sky'), stage: $('stage'), mapbox: $('mapbox'), map: $('map'), names: $('names'), tags: $('tags'), card: $('card'), catch: $('catch'), ask: $('ask'),
  side: $('side'), stars: $('stars'), view: $('view'), vlbl: $('vlbl'), vday: $('vday'), tray: $('tray'), panel: $('panel'), dock: $('dock'), newbtn: $('newbtn'), guide: $('guide'), hint: $('hint') };

const app = {
  game: null, mode: 'wallpaper', tool: 'move', drag: null, pointer: null, armedGift: null, card: null, t: 0, panelKey: '', namesKey: '', nameU: 2, hintUntil: 0, asking: false, catching: false,
  els, mapCtx: els.map.getContext('2d'), viewCtx: els.view.getContext('2d'),
  get w() { return this.game.worlds[this.game.ui.world] || this.game.worlds[0] },
  // The city's world-to-canvas map at the current canvas size (input hit tests use the same one drawCity does).
  cityView: () => ({ w: art.w, h: art.h, ...worldView(art.w, art.h) }),
  exit: () => native ? post({ type: 'exit' }) : setMode('wallpaper'),
  newMap: () => { post({ type: 'new-map' }); start(newGame(randSeed()), 'play', Date.now()); save() },
};
window.__app = app; // dev handle for the console and scripted checks
const skyCtx = els.sky.getContext('2d'), tile = document.createElement('canvas'); tile.width = W; tile.height = H;
const tileCtx = tile.getContext('2d');
let sky = { x0: 0, y0: 0, mx: 0, my: 0 };

// sketchybar covers the top of the screen (TINY_GARDEN_TOP_INSET, CSS px; Swift passes it to boot). The wallpaper
// keeps its overlay text below it.
let topInset = 38;
const randSeed = () => Math.floor(Math.random() * 2147483647);
const setText = (el, v) => { if (el.textContent !== v) el.textContent = v };

// ---------- clock ----------
let clock = startClock(0, 0), paused = false, timer = 0, raf = 0, lastDraw = -1e9, lastView = -1e9, lastPanel = -1e9, lastSky = -1e9, lastSave = 0;
const t0 = performance.now();

function tick() {
  timer = raf = 0;
  if (paused || !app.game) return;
  // One bad frame must not stop the garden: the next one is always scheduled, and the error still reaches
  // window.onerror (index.html forwards it to the app log).
  try {
    const now = Date.now();
    // Any gap over 1 s (sleep, quit, throttling) is caught up in chunks, never in one frame (sim/clock.js), under
    // the catch-up event rule: at most one visit for the whole gap (sim/game.js frame, tests/catchup.test.js).
    frame(app.game, clock, now, app.mode);
    app.catching = clock.behind > 0;
    drainEvents(app);

    const p = performance.now(), play = app.mode === 'play'; app.t = (p - t0) / 1000;
    if (p - lastDraw >= (play ? 50 : WALL_MS) - 4) { lastDraw = p; drawMain() }
    if (play && p - lastView >= 110) { lastView = p; drawView() }
    if (p - lastPanel >= (play ? 250 : 1000) - 4) { lastPanel = p; renderSlow() }
    if (now - lastSave >= SAVE_MS) save();
  } finally { schedule() }
}
// Play runs on animation frames; wallpaper ticks 6 times a second.
function schedule() {
  if (paused || timer || raf) return;
  if (app.mode === 'play') raf = requestAnimationFrame(tick); else timer = setTimeout(tick, WALL_MS);
}
function unschedule() { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0 }

// ---------- drawing ----------
// Every view, in both modes, is drawn in JS (PixCtx) at the view's own canvas size (layout below), and only a
// frame's changed rows are put into #map. The same buffer is what the galaxy and system names are placed
// around (ui/tags.js renderNames).
const art = { pix: null, prev: null, w: 0, h: 0, s: 1, view: null };
app.art = art;

function drawMain(force = false) {
  const game = app.game, ui = game.ui, w = app.w, t = app.t, play = app.mode === 'play', v = ui.view;
  const c = art.pix;
  // Wallpaper: twinkle() records the stars instead of drawing them (core/stars.js); updateStars puts them on their layers.
  STARS.on = !play; STARS.list.length = 0;
  try {
  // Neighbour galaxies are hidden in wallpaper mode (galPanFor gives null there, the play pan otherwise).
  if (v === 'galaxy') { if (!play) galInvalidate(c); drawGalaxy(c, t, play ? ui.galSel : null, play ? t : Math.floor(t * GAL_WALL_STEP) / GAL_WALL_STEP * GAL_WALL_SPIN, art.w, art.h, galPanFor(app.mode, game)) }
  else if (v === 'system') drawSystem(c, game, t, play ? ui.sysSel : null, art.w, art.h);
  else if (v === 'close') { const n = closeSubject(w), rt = play ? Math.floor(t * 2) / 2 : Math.floor(t / DAWN_STEP) * DAWN_STEP; if (n) islandView(c, w, n, t, art.w, art.h, rt, game.seed); else planetView(c, game, w, t, art.w, art.h, rt) }
  else drawCity(c, game, w, t, app.cityView(), play ? { drag: app.drag, pointer: app.pointer, tool: app.tool, armedGift: app.armedGift, card: app.card } : null);
  } finally { STARS.on = false }
  art.view = v; present(app.mapCtx, c, art.prev, force);
  if (!play) updateStars(force);
  const p = performance.now(); if (play || p - lastSky >= SKY_MS - 4) { lastSky = p; drawSky(t) }
}
// The twinkling stars' layers (wallpaper only): GROUPS canvases over the map at its pixel size, each with a CSS
// animation stepping its opacity through the twinkle (style.css @keyframes twinkle). Only stars that were covered
// or uncovered since the last frame are drawn or cleared; force (a new size, view or mode) redraws them all.
const stars = { cv: [], shown: new Map(), w: 0, h: 0 };
function updateStars(force) {
  const w = art.w, h = art.h;
  if (stars.cv.length !== GROUPS) {
    for (let g = 0; g < GROUPS; g++) {
      const cv = document.createElement('canvas'), d = PERIODS[g];
      cv.className = 'tw'; Object.assign(cv.style, { animationDuration: d + 's', animationDelay: (-d * g / GROUPS).toFixed(2) + 's' });
      els.stars.append(cv); stars.cv.push(cv);
    }
  }
  const next = visibleStars(STARS.list, art.pix.px, w); STARS.list.length = 0;
  if (force || stars.w !== w || stars.h !== h) {
    stars.w = w; stars.h = h; stars.shown = new Map();
    for (const cv of stars.cv) { if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h; cv.getContext('2d').clearRect(0, 0, w, h) }
  }
  const { add, del } = starDiff(stars.shown, next), ctx = g => stars.cv[g].getContext('2d');
  for (const s of del) clearStar(ctx(s.g), s);
  for (const s of add) drawStar(ctx(s.g), s);
  stars.shown = next;
}

// The close-up shows the world's selected island, otherwise its town.
function closeSubject(w) { const S = w.S, n = S.sel && S.sel.t === 'node' ? node(w, S.sel.id) : null; return n && n.kind === 'island' ? n : null }

// The sky around the map: the map's own starfield, tiled so its pixel grid lines up with the map's.
// (A flat-coloured kit starfield, so the tile has no gradient to show its seams.)
function drawSky(t) {
  const L = skyLayer(W, H, 70, { top: '#14151f', bot: '#14151f' });
  tileCtx.putImageData(L.img, 0, 0); twinkle(tileCtx, L.tw, t);
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
  const n = closeSubject(w);
  if (!n) { planetView(c, game, w, t); setText(els.vlbl, w.def.full + ' · the town') }
  else { islandView(c, w, n, t, undefined, undefined, t, game.seed); setText(els.vlbl, (n.name || w.def.isl[n.id].name).toLowerCase() + ' · stage ' + n.stage) }
  setText(els.vday, day(S.time));
}

function renderSlow() {
  const game = app.game, v = game.ui.view, play = app.mode === 'play';
  renderTags(app);
  els.catch.classList.toggle('on', app.catching);
  if (play) { renderPanel(app); renderTray(app); renderGuide(app); idleHint(app) }
}

function renderAll() { lastDraw = lastView = lastPanel = lastSky = -1e9; app.panelKey = ''; app.namesKey = ''; invalidateTags(app); galInvalidate(art.pix); drawMain(true); if (app.mode === 'play') drawView(); renderSlow() }

// ---------- scaling ----------
// Each view picks its canvas size and whole-number scale from the stage, counted in device pixels
// (core/pixel.js viewScale): finer pixels on bigger screens, never smaller than the 640x300 world.
function layout() {
  const dpr = window.devicePixelRatio || 1, vw = innerWidth, vh = innerHeight, root = document.documentElement.style;
  const ui = app.mode === 'play' && vw >= 2200 && vh >= 1300 ? 2 : 1; root.setProperty('--ui', ui);
  const r = els.stage.getBoundingClientRect(), dW = Math.floor(r.width * dpr), dH = Math.floor(r.height * dpr);
  const { s, w, h } = viewScale(dW, dH);
  if (els.map.width !== w || els.map.height !== h) { els.map.width = w; els.map.height = h; galInvalidate(app.mapCtx) }
  if (!art.pix || art.w !== w || art.h !== h) Object.assign(art, { pix: new PixCtx(w, h), prev: new Uint32Array(w * h), w, h, view: null });
  art.s = s;
  const mw = w * s, mh = h * s, ox = Math.floor((dW - mw) / 2), oy = Math.floor((dH - mh) / 2);
  Object.assign(els.mapbox.style, { left: ox / dpr + 'px', top: oy / dpr + 'px', width: mw / dpr + 'px', height: mh / dpr + 'px' });
  // Overlay text (tags, the pick card) keeps the city's size in every view, so it doesn't jump on a view switch.
  root.setProperty('--inset', (app.mode === 'play' ? 0 : Math.max(0, topInset - r.top - oy / dpr)) + 'px');
  // The finer world scale is for the pixel art, not UI text: overlay text keeps v1's size from the old city scale.
  const uiScale = Math.max(1, Math.floor(Math.min(dW / 320, dH / 200))); root.setProperty('--s', String(Math.max(1, Math.ceil(uiScale / 2 - .5)) / dpr));
  // Names: pixel text with u device pixels per font pixel (3 at the wallpaper's 5x), on a canvas over the map.
  const u = Math.max(2, Math.min(4, Math.round(s * .6))), nw = Math.ceil(mw / u), nh = Math.ceil(mh / u);
  if (app.nameU !== u || art.w !== art.namesW || art.h !== art.namesH) { app.namesPrev = null; art.namesW = art.w; art.namesH = art.h }
  app.nameU = u; app.namesKey = '';
  if (els.names.width !== nw) els.names.width = nw; if (els.names.height !== nh) els.names.height = nh;
  Object.assign(els.names.style, { width: nw * u / dpr + 'px', height: nh * u / dpr + 'px' });
  // Sky: same pixel size as the map, its grid aligned to the map's top-left corner.
  const Lx = Math.round(r.left * dpr) + ox, Ly = Math.round(r.top * dpr) + oy, x0 = (Lx % s) - s, y0 = (Ly % s) - s;
  const cols = Math.ceil((vw * dpr - x0) / s) + 1, rows = Math.ceil((vh * dpr - y0) / s) + 1;
  if (els.sky.width !== cols) els.sky.width = cols; if (els.sky.height !== rows) els.sky.height = rows;
  Object.assign(els.sky.style, { left: x0 / dpr + 'px', top: y0 / dpr + 'px', width: cols * s / dpr + 'px', height: rows * s / dpr + 'px' });
  sky = { mx: (Lx - x0) / s, my: (Ly - y0) / s };
  // Close-up: whole-number scale across the side column.
  if (app.mode === 'play') { const k = Math.max(1, Math.floor(els.side.clientWidth * dpr / 200)); Object.assign(els.view.style, { width: 200 * k / dpr + 'px', height: 120 * k / dpr + 'px' }) }
}
app.onView = () => { if (app.game) { layout(); renderAll() } };

// ---------- modes and saving ----------
// The save says when the sim was last run up to, so time spent paused (or not yet ticked) is caught up next time.
const snapshot = () => serialize(app.game, clockSavedAt(clock));
function save() { lastSave = Date.now(); if (app.game) post({ type: 'save', save: snapshot() }) }

function setMode(m) {
  m = m === 'play' ? 'play' : 'wallpaper';
  app.mode = m; document.body.classList.toggle('wallpaper', m !== 'play');
  if (!app.game) return;
  if (m !== 'play') { setSpeed(app, 1); app.drag = null; app.pointer = null; app.armedGift = null; closeCard(app); askNewMap(app, false) }
  unschedule(); layout(); renderAll(); layout(); renderAll(); save(); schedule();
}

function start(game, mode, nowMs) {
  const ui = game.ui;
  if (!VIEWS.includes(ui.view)) ui.view = 'planet';
  if (!(ui.world >= 0 && ui.world < game.worlds.length && game.worlds[ui.world].started)) ui.world = 0;
  ui.speed = 1; ui.pri = ui.pri || 'auto'; if (typeof ui.names !== 'boolean') ui.names = true;
  if (!ui.firstSeen) ui.firstSeen = nowMs;
  clock = startClock(nowMs, game.savedAt || nowMs); clock.lastMs = Date.now(); lastSave = clock.lastMs;
  Object.assign(app, { game, tool: 'move', drag: null, pointer: null, armedGift: null, panelKey: '', hintUntil: 0 }); closeCard(app); els.tray.dataset.last = '';
  game.worlds.forEach(w => { w.events.length = 0 });
  syncDock(app); setMode(mode);
}

window.garden = {
  boot(saveObj, mode, nowMs = Date.now(), opts = {}) {
    if (opts && typeof opts.topInset === 'number' && opts.topInset >= 0) topInset = opts.topInset;
    let game = null;
    // A save that won't parse, or parses but throws when stepped or drawn (boot.js), is set aside for a new game.
    if (saveObj != null) {
      const r = trialLoad(saveObj, () => new PixCtx(688, 288));
      if (!r) post({ type: 'bad-save' });
      else if (r.old) post({ type: 'old-save' });
      else game = r.game;
    }
    if (!game) { game = newGame(randSeed()); game.savedAt = nowMs }
    start(game, mode, nowMs);
  },
  setMode,
  // Pausing (screens asleep, session switched away, window hidden) also saves, so a sleep that never wakes loses nothing.
  // body.paused stops the star layers' CSS animations too (style.css), so nothing runs while paused.
  pause() { paused = true; document.body.classList.add('paused'); unschedule(); save() },
  resume() { document.body.classList.remove('paused'); if (!paused) return; paused = false; schedule() },
  saveNow: () => app.game ? snapshot() : null,
};

// ---------- wiring ----------
wireDock(app); wirePanel(app); wireInput(app); wireCard(app);
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
  if (q.get('names') === '0') game.ui.names = false;
  if (q.has('inset')) topInset = Math.max(0, +q.get('inset') || 0);
  if (q.has('n')) { const w = game.worlds[game.ui.world]; if (node(w, q.get('n'))) w.S.sel = { t: 'node', id: q.get('n') } }
  // Dev (shots): rope=a:b ties two nodes and selects that bridge; rename=1 opens the name field on the selection.
  if (q.has('rope')) { const w = game.worlds[game.ui.world], [a, b] = q.get('rope').split(':'), A = node(w, a), B = node(w, b); if (A && B && A !== B) { const r = tie(w, A, B); if (r) w.S.sel = { t: 'rope', id: r.id } } }
  game.savedAt = Date.now();
  start(game, q.get('mode') === 'wallpaper' ? 'wallpaper' : 'play', Date.now());
  if (q.get('rename') === '1') { app.renaming = app.w.S.sel.id; app.panelKey = ''; renderPanel(app) }
  // Dev: gifts=N puts N gifts in the tray; card=<islandId>:<spot> opens the pick card (for shots).
  if (q.has('gifts')) { for (let i = 0; i < Math.min(3, +q.get('gifts') || 0); i++) game.gifts.push({ id: 900 + i, kind: ['coral', 'hut', 'banner'][i], variant: i, ...(i === 1 ? { name: 'MIRA' } : {}) }); renderTray(app) }
  if (q.has('card')) { const [id, i] = q.get('card').split(':'), w = app.w, n = node(w, id); if (n) openCard(app, w, n, +i) }
  if (q.get('dump') === '1') setTimeout(dump, 1500);
}

// Dev: write the map, names and close-up canvases into the DOM (for scripts/shot.mjs), and check that drawing never changes the game.
function dump() {
  const before = JSON.stringify(serialize(app.game, 0)); drawMain(true); if (app.mode === 'play') drawView();
  if (JSON.stringify(serialize(app.game, 0)) !== before) throw new Error('drawing changed the game state');
  [['dump-map', els.map], ['dump-names', els.names], ['dump-view', els.view]].forEach(([id, cv]) => { const pre = document.createElement('pre'); pre.id = id; pre.hidden = true; pre.textContent = cv.toDataURL('image/png'); document.body.append(pre) });
}

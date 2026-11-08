// Pointer input on the city: tie bridges, move islands (free), steer and untie bridges, and pick or gift spots.
// The pure helpers (toWorld, tryTie, tapRope, spotAt, ropeAt, constrain) are exported for tests.
// Coordinates: the sim is in 640x300 world units; hit tests run in canvas pixels against what draw/city.js draws.
import { clamp, toWorld as worldOf } from '../core/pixel.js';
import { W, MAXR, BAND_Y } from '../sim/content.js';
import { node, isl, piers, canTie, tie } from '../sim/world.js';
import { cycleWay } from '../sim/graph.js';
import { islandHW } from '../draw/kit.js';
import { nodeAt, ropeSpans, spotXY, spotShown } from '../draw/city.js';
import { sysAt } from '../draw/system.js';
import { galAt, galClampPan } from '../draw/galaxy.js';
import { renderPanel } from './panel.js';
import { say } from './guide.js';
import { setView, zoomTo } from './dock.js';
import { openCard, closeCard } from './card.js';
import { nameOf, placeGiftAt, untieRope } from './util.js';

// A pointer event in canvas pixels (each view has its own canvas size).
export const toMap = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height } };
// A pointer event in world units, through the city's view (core/pixel.js worldView).
export const toWorld = (cv, e, view) => worldOf(view, toMap(cv, e));

// (The town's 4 piers and a stage-4 island's are final, so their line leaves off "It gets another when it grows.")
// Tie a and b if canTie allows, else tell (msg, warn) why not. Returns canTie's {ok, why}, plus the rope when tied.
const WHY = {
  reach: () => 'Too far for a bridge.',
  piers: (w, a, b) => { const full = [a, b].find(n => w.S.ropes.filter(r => r.a === n.id || r.b === n.id).length >= piers(n)); return full.kind === 'planet' ? 'The town has no free pier.' : full.stage >= 4 ? `${nameOf(w, full)} has no free pier.` : `${nameOf(w, full)} has no free pier. It gets another when it grows.` },
  cross: () => "Bridges can't cross.",
  dup: () => 'Already tied.',
};
export function tryTie(w, a, b, tell = () => {}) {
  const c = canTie(w, a, b);
  if (!c.ok) { if (WHY[c.why]) tell(WHY[c.why](w, a, b), true); return c }
  return { ok: true, rope: tie(w, a, b) };
}

// Tapping a bridge steers it: both ways -> a to b only -> b to a only -> both ways.
export function tapRope(w, r, tell = () => {}) {
  r.way = cycleWay(r);
  const A = nameOf(w, node(w, r.a)), B = nameOf(w, node(w, r.b));
  tell(r.way === 0 ? `Goods cross this bridge both ways again.` : r.way === 1 ? `One way now: ${A} to ${B} only.` : `One way now: ${B} to ${A} only.`);
  return r.way;
}

// The spot of island n under canvas point p (within 4 px of its glow), or null. o = {view, t, gifts}: the city's
// view (default: world = canvas), the frame's time (islands bob) and how many gifts wait in the tray.
const ID = { w: 640, h: 300, k: 1, ox: 0, oy: 0 };
export function spotAt(w, n, p, o = {}) {
  const view = o.view || ID, t = o.t || 0, gifts = o.gifts || 0;
  let best = null, bd = 4 + 1e-9;
  for (let i = 0; i < 5; i++) {
    if (!spotShown(n, i, gifts)) continue;
    const [x, y] = spotXY(n, i, view, t), d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - y - 1)); // the glow's centre or its bright pixel
    if (d < bd) { bd = d; best = i }
  }
  return best;
}
// The island and spot under canvas point p, across the world.
export const spotHit = (game, w, p, view, t) => { for (const n of isl(w)) { const i = spotAt(w, n, p, { view, t, gifts: game.gifts.length }); if (i !== null) return { n, i } } return null };

// The bridge under canvas point p: within 5 px of the plank row the city draws (ropeSpans), or null.
export function ropeAt(w, p, view, t) {
  let best = null, bd = 5;
  for (const [id, pts] of ropeSpans(w, view, t)) for (const [x, y] of pts) { const d = Math.hypot(x - p.x, y - 1 - p.y); if (d < bd) { bd = d; best = id } }
  return best === null ? null : w.S.ropes.find(r => r.id === best) || null;
}

// Where island n can go when dragged toward p (v1's constrain, in world units): within reach of every node it is
// tied to, kept apart from the other islands and the town, inside the world and within the bands' heights.
export function constrain(w, n, p) {
  const S = w.S, hw = islandHW(n); let x = p.x, y = p.y, strain = false;
  for (let k = 0; k < 6; k++) {
    S.ropes.forEach(r => { if (r.a !== n.id && r.b !== n.id) return; const o = node(w, r.a === n.id ? r.b : r.a), d = Math.hypot(x - o.x, y - o.y); if (d > MAXR) { x = o.x + (x - o.x) * MAXR / d; y = o.y + (y - o.y) * MAXR / d; strain = true } });
    S.nodes.forEach(o => { if (o === n) return; const d = Math.hypot(x - o.x, y - o.y), m = (o.kind === 'planet' ? o.r + 6 : islandHW(o) * .6) + hw * .6; if (d < m && d > 0) { x = o.x + (x - o.x) * m / d; y = o.y + (y - o.y) * m / d } });
    x = clamp(x, hw + 4, W - hw - 4); y = clamp(y, BAND_Y.far[0], BAND_Y.near[1]);
  }
  return { x, y, strain: strain || Math.hypot(p.x - x, p.y - y) > 3 };
}

const sel = (app, s) => { app.w.S.sel = s; app.renaming = null; app.panelKey = ''; renderPanel(app) };
const tell = app => (m, warn) => say(app, m, warn);

// A click on an open spot: place the armed gift there, or open the pick card for it.
function onSpot(app, n, i) {
  if (app.armedGift != null) placeGiftAt(app, app.w, n, app.armedGift, i);
  else openCard(app, app.w, n, i);
}

export function wireInput(app) {
  const map = app.els.map; let lastDown = { at: 0, name: null };
  const dbl = name => { const now = performance.now(), d = now - lastDown.at < 400 && lastDown.name === name; lastDown = { at: now, name }; return d };

  map.addEventListener('pointerdown', e => {
    if (app.mode !== 'play') return;
    const game = app.game, view = game.ui.view, cp = toMap(map, e);
    // The galaxy: a drag pans it, a press that moves under 4 px is a click (select) on release.
    if (view === 'galaxy') { if (e.button !== 0) return; app.pointer = cp; app.drag = { kind: 'pan', sx: cp.x, sy: cp.y, ox: game.ui.galPan.x, oy: game.ui.galPan.y, moved: false }; map.setPointerCapture(e.pointerId); return }
    if (view === 'close') return; // the close-up is a picture: nothing on it to click
    if (view === 'system') { if (e.button !== 0) return; const q = sysAt(game, cp, map.width, map.height); if (q) { game.ui.sysSel = q.name; app.panelKey = ''; renderPanel(app); if (dbl(q.name) && q.w && q.w.started) zoomTo(app, game.worlds.indexOf(q.w)) } return }
    const w = app.w, cv = app.cityView(), p = worldOf(cv, cp), t = app.t; app.pointer = p;
    // Right-click unties the bridge under the pointer.
    if (e.button === 2) { const r = ropeAt(w, cp, cv, t); if (r) untieRope(app, r.id); return }
    if (e.button !== 0) return;
    if (app.card) closeCard(app);
    const spot = (app.tool === 'move' || app.armedGift != null) && spotHit(game, w, cp, cv, t);
    if (spot) { onSpot(app, spot.n, spot.i); return }
    const n = nodeAt(w, cp, cv);
    if (app.tool === 'cut') { const r = ropeAt(w, cp, cv, t); if (r) untieRope(app, r.id); return }
    if (app.tool === 'rope') { if (n) { app.drag = { kind: 'rope', id: n.id }; map.setPointerCapture(e.pointerId) } return }
    if (n) { app.drag = { kind: 'move', id: n.id, sx: p.x, sy: p.y, ox: n.x, oy: n.y, moved: false, strain: false }; map.setPointerCapture(e.pointerId); return }
    const r = ropeAt(w, cp, cv, t);
    if (r) { tapRope(w, r, tell(app)); (app.game.ui.lessons ||= {}).oneWay = true; sel(app, { t: 'rope', id: r.id }) }
  });

  map.addEventListener('pointermove', e => {
    if (app.mode !== 'play') return;
    const cp = toMap(map, e), drag = app.drag;
    if (app.game.ui.view === 'galaxy') {
      app.pointer = cp;
      if (drag && drag.kind === 'pan') { if (!drag.moved && Math.hypot(cp.x - drag.sx, cp.y - drag.sy) < 4) return; drag.moved = true; app.game.ui.galPan = galClampPan({ x: drag.ox + cp.x - drag.sx, y: drag.oy + cp.y - drag.sy }, map.width, map.height) }
      return;
    }
    if (app.game.ui.view !== 'planet') return;
    const p = worldOf(app.cityView(), cp); app.pointer = p;
    if (!drag || drag.kind !== 'move') return;
    const w = app.w, n = node(w, drag.id);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 2) return;
    drag.moved = true;
    if (n.kind === 'planet') { say(app, 'The town doesn\'t move. Islands do.'); return }
    const q = constrain(w, n, p);
    n.x = q.x; n.y = q.y; drag.strain = q.strain;
  });

  map.addEventListener('pointerup', e => {
    const d0 = app.drag; if (!d0) return; app.drag = null;
    if (d0.kind === 'pan') {
      if (app.mode !== 'play' || d0.moved) return;
      const game = app.game, g = galAt(toMap(map, e), app.t); if (g) { game.ui.galSel = g.name; app.panelKey = ''; renderPanel(app); if (dbl(g.name) && g.ours) setView(app, 'system') }
      return;
    }
    if (app.mode !== 'play' || app.game.ui.view !== 'planet') return;
    const w = app.w, cv = app.cityView(), cp = toMap(map, e);
    if (d0.kind === 'move') { if (!d0.moved) sel(app, { t: 'node', id: d0.id }); return }
    const A = node(w, d0.id), B = nodeAt(w, cp, cv); if (!B || B === A) return;
    const r = tryTie(w, A, B, tell(app));
    if (r.ok) sel(app, { t: 'rope', id: r.rope.id });
  });

  map.addEventListener('pointercancel', () => { app.drag = null });
  map.addEventListener('pointerleave', () => { if (!app.drag) app.pointer = null });
}

// Pointer input on the map: select, move (paid in Rock as it goes), tie and cut. Ported from page 38.
import { clamp } from '../core/pixel.js';
import { W, H, MAXR, MOVEPX } from '../sim/content.js';
import { node, dist, tie } from '../sim/world.js';
import { cross } from '../sim/graph.js';
import { ropeCost, ropesAt, slots } from '../sim/economy.js';
import { nodeAt, geomR } from '../draw/map.js';
import { sysAt } from '../draw/system.js';
import { galAt, galClampPan } from '../draw/galaxy.js';
import { renderPanel } from './panel.js';
import { say } from './guide.js';
import { setView, zoomTo } from './dock.js';

export { nodeAt };

// A pointer event in canvas pixels (each view has its own canvas size).
export const toMap = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height } };

export const ropeAt = (w, p) => { let best = null, bd = 5; w.S.ropes.forEach(r => { const g = geomR(w, r); for (let i = 0; i <= 20; i++) { const x = g.A.x + (g.B.x - g.A.x) * i / 20, y = g.A.y + (g.B.y - g.A.y) * i / 20 + 2, d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = r } } }); return best };

// Where island n can go when dragged toward p: held by its ropes, kept off other places and inside the map.
export function constrain(w, n, p) {
  const S = w.S; let x = p.x, y = p.y, strain = false;
  for (let k = 0; k < 6; k++) {
    S.ropes.forEach(r => { if (r.a !== n.id && r.b !== n.id) return; const o = node(w, r.a === n.id ? r.b : r.a), d = Math.hypot(x - o.x, y - o.y); if (d > r.len) { x = o.x + (x - o.x) * r.len / d; y = o.y + (y - o.y) * r.len / d; strain = true } });
    S.nodes.forEach(o => { if (o === n) return; const d = Math.hypot(x - o.x, y - o.y), m = (o.kind === 'planet' ? o.r : 12) + 16; if (d < m && d > 0) { x = o.x + (x - o.x) * m / d; y = o.y + (y - o.y) * m / d } });
    x = clamp(x, 16, W - 16); y = clamp(y, 22, H - 14);
  }
  return { x, y, strain: strain || Math.hypot(p.x - x, p.y - y) > 3 };
}

// Moving costs Rock as you go: one Rock for every MOVEPX map pixels.
export function payMove(w, drag, step) {
  const hub = w.hub;
  drag.acc = (drag.acc || 0) + step / MOVEPX;
  const due = Math.floor(drag.acc);
  if (due > 0) {
    if (hub.stock.rock < due) { drag.acc -= step / MOVEPX; drag.broke = true; return false }
    hub.stock.rock -= due; drag.acc -= due; drag.paid = (drag.paid || 0) + due;
  }
  drag.broke = false; return true;
}

const sel = (app, s) => { app.w.S.sel = s; app.panelKey = ''; renderPanel(app) };

export function wireInput(app) {
  const map = app.els.map; let lastDown = { at: 0, name: null };
  const dbl = name => { const now = performance.now(), d = now - lastDown.at < 400 && lastDown.name === name; lastDown = { at: now, name }; return d };

  map.addEventListener('pointerdown', e => {
    if (app.mode !== 'play' || e.button !== 0) return;
    const p = toMap(map, e), game = app.game, view = game.ui.view; app.pointer = p;
    // The galaxy: a drag pans it, a press that moves under 4 px is a click (select) on release.
    if (view === 'galaxy') { app.drag = { kind: 'pan', sx: p.x, sy: p.y, ox: game.ui.galPan.x, oy: game.ui.galPan.y, moved: false }; map.setPointerCapture(e.pointerId); return }
    if (view === 'close') return; // the close-up is a picture: nothing on it to click
    if (view === 'system') { const q = sysAt(game, p, map.width, map.height); if (q) { game.ui.sysSel = q.name; app.panelKey = ''; renderPanel(app); if (dbl(q.name) && q.w && q.w.started) zoomTo(app, game.worlds.indexOf(q.w)) } return }
    const w = app.w, S = w.S, n = nodeAt(w, p);
    if (app.tool === 'cut') { const r = ropeAt(w, p); if (r) { S.ropes = S.ropes.filter(o => o !== r); if (S.sel.t === 'rope' && S.sel.id === r.id) S.sel = { t: 'node', id: 'planet' }; app.panelKey = ''; say(app, 'Bridge cut.') } return }
    if (app.tool === 'rope') { if (n) { app.drag = { kind: 'rope', id: n.id }; map.setPointerCapture(e.pointerId) } return }
    if (n) { app.drag = { kind: 'move', id: n.id, sx: p.x, sy: p.y, ox: n.x, oy: n.y, moved: false, strain: false }; map.setPointerCapture(e.pointerId) }
    else { const r = ropeAt(w, p); if (r) sel(app, { t: 'rope', id: r.id }) }
  });

  map.addEventListener('pointermove', e => {
    if (app.mode !== 'play') return;
    const p = toMap(map, e); app.pointer = p;
    const drag = app.drag;
    if (drag && drag.kind === 'pan') { if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 4) return; drag.moved = true; app.game.ui.galPan = galClampPan({ x: drag.ox + p.x - drag.sx, y: drag.oy + p.y - drag.sy }, map.width, map.height); return }
    if (app.game.ui.view !== 'planet' || !drag || drag.kind !== 'move') return;
    const w = app.w, n = node(w, drag.id);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 2) return;
    drag.moved = true;
    if (n.kind === 'planet') { say(app, 'The planet doesn\'t move. Islands do.'); return }
    const q = constrain(w, n, p);
    if (!payMove(w, drag, Math.hypot(q.x - n.x, q.y - n.y))) return;
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
    const w = app.w, S = w.S, hub = w.hub, ISL = w.def.isl, p = toMap(map, e);
    if (d0.kind === 'move') { if (!d0.moved) sel(app, { t: 'node', id: d0.id }); else if (d0.paid) say(app, `Moved ${ISL[d0.id].name} for ${d0.paid} Rock.`); return }
    const A = node(w, d0.id), B = nodeAt(w, p); if (!B || B === A) return;
    if (S.ropes.some(r => (r.a === A.id && r.b === B.id) || (r.a === B.id && r.b === A.id))) { say(app, 'Those two are already tied.', true); return }
    const d = dist(A, B); if (d > MAXR) { say(app, 'Too far for a rope. Go through something in between.', true); return }
    if (S.ropes.some(r => r.a !== A.id && r.b !== A.id && r.a !== B.id && r.b !== B.id && cross(A, B, node(w, r.a), node(w, r.b)))) { say(app, 'That would cross another bridge.', true); return }
    const cost = ropeCost(d); if (hub.stock.rock < cost) { say(app, `That rope costs ${cost} Rock, and the town square has ${hub.stock.rock}.`, true); return }
    const crowded = [A, B].filter(n => ropesAt(w, n.id) >= slots(n)); hub.stock.rock -= cost; const r = tie(w, A, B);
    if (crowded.length) say(app, `Tied, for ${cost} Rock. ${crowded.map(n => n.kind === 'planet' ? 'The town square' : ISL[n.id].name).join(' and ')} now has more bridges than slots, so its walkers slow down.`, true);
    else if (S.found.has(A.id) && S.found.has(B.id)) say(app, `Tied, for ${cost} Rock.`);
    sel(app, { t: 'rope', id: r.id });
  });

  map.addEventListener('pointercancel', () => { app.drag = null });
  map.addEventListener('pointerleave', () => { if (!app.drag) app.pointer = null });
}

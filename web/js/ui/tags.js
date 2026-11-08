// Name tags over the city (islands and the town). Ported from page 38.
// City tags are positioned in % of the canvas (the world mapped through worldView), so they follow it at any scale.
// The galaxy and system names are pixel text on their own canvas (#names), placed by ui/names.js.
import { NAMEC } from '../core/palette.js';
import { uico, pixText, textW } from '../core/icons.js';
import { W, H } from '../sim/content.js';
import { worldView } from '../core/pixel.js';
import { isl } from '../sim/world.js';
import { islandHW, depthFor } from '../draw/kit.js';
import { HUB_DEPTH } from '../draw/city.js';
import { sysSpots } from '../draw/system.js';
import { GSYS, gpos, galShownRot, galAbove } from '../draw/galaxy.js';
import { artMask, placeNames, namesOn } from './names.js';

// World point (x, y) in % of the canvas the city is drawn on (app.art; the world itself before the first layout).
const placeAt = (app, x, y) => {
  const a = app.art, cw = a && a.w || W, ch = a && a.h || H, v = worldView(cw, ch);
  return `left:${((v.ox + x * v.k) / cw * 100).toFixed(2)}%;top:${((v.oy + y * v.k) / ch * 100).toFixed(2)}%`;
};

// Play mode only, and the N key hides them with the galaxy and system names (names.js namesOn).
function tagsHTML(app) {
  const ui = app.game.ui; if (ui.view !== 'planet' || !namesOn(app.mode, ui)) return '';
  const w = app.w, ISL = w.def.isl, hub = w.hub, a = app.art, k = worldView(a && a.w || W, a && a.h || H).k;
  // under each island's rock: its name, and a star per stage past the first
  let h = isl(w).map(n => { const s = ISL[n.id], below = (depthFor(Math.max(4, Math.round(islandHW(n) * k))) + 4) / k;
    return `<div class="ntag" style="${placeAt(app, n.x, n.y + below)}"><span style="color:${s.col}">${n.name || s.name}${n.stage > 1 ? ' <span class="lv">' + uico('star').repeat(n.stage - 1) + '</span>' : ''}</span></div>` }).join('');
  h += `<div class="ntag" style="${placeAt(app, hub.x, hub.y + (HUB_DEPTH + 9) / k)}"><span style="color:#8aadf4">TOWN${hub.stage > 1 ? ' <span class="lv">' + uico('star').repeat(hub.stage - 1) + '</span>' : ''}</span></div>`;
  return h;
}

// The last HTML put into #tags lives in app.tagsKey. Invalidate with null, never '': '' is also what every view but
// the city renders, so an '' marker would leave the city's tags behind after a view or mode change.
export const invalidateTags = app => { app.tagsKey = null };
export function renderTags(app) { const el = app.els.tags, h = tagsHTML(app); if (app.tagsKey !== h) { app.tagsKey = h; el.innerHTML = h } renderNames(app) }

// The galaxy and system names (page 43's A3), in play only, unless the N key turned them off (game.ui.names).
// The art mask comes from the frame just drawn (app.art, native pixels); the names canvas has one pixel per
// font pixel (app.nameU device pixels). Slots are kept from one placement to the next (app.namesPrev, reset on a
// view or size change), so names hold still while their leaders follow the planets and stars.
// Only redrawn when the placement changes.
export function renderNames(app) {
  const cv = app.els.names, art = app.art, v = app.game.ui.view, gal = v === 'galaxy';
  let todo = [];
  if (cv && art && art.view === v && (gal || v === 'system') && namesOn(app.mode, app.game.ui)) {
    const s = art.s, u = app.nameU, k = u / s, Wn = art.w, Hn = art.h, box = t => ({ w: Math.ceil((textW(t) + 1) * k) + 2, h: Math.ceil(8 * k) + 2 });
    let items = [];
    if (gal) { const rot = galShownRot(); if (rot !== null) items = GSYS.map(g => { const q = gpos(g.q, g.a, rot), t = g.name.toUpperCase(); return { id: g.name, ax: q.x, ay: q.y, up: galAbove(q.x, q.y), t, col: g.ours ? NAMEC.home : NAMEC.star, lead: g.ours ? NAMEC.leadHome : NAMEC.lead, ...box(t) } }) }
    else items = sysSpots(app.game, Wn, Hn).map(q => { const on = q.p.w && q.p.w.started; return { id: q.p.name, ax: q.x, ay: q.y, up: q.up, t: q.p.name, col: on ? NAMEC.world : NAMEC.far, lead: on ? NAMEC.leadHome : NAMEC.lead, ...box(q.p.name) } });
    const m = artMask(art.pix.px, Wn, Hn, gal ? 36 : 60, gal ? 6 : 2), out = placeNames(items, m, { margin: Math.ceil(24 / s), gap: 3, prev: app.namesPrev });
    app.namesPrev = out;
    todo = out.map((o, i) => o && { ...o, t: items[i].t, col: items[i].col, lead: items[i].lead }).filter(Boolean);
  }
  const key = JSON.stringify(todo.map(o => [o.t, o.x, o.y, o.line.length, o.line[0]])) + (cv ? cv.width + 'x' + cv.height : '');
  if (!cv) return;
  // Guard, independent of the key: with nothing to show (wallpaper, the city, the close-up, names off) the canvas is
  // always hidden and cleared, even if an earlier frame left it showing.
  const stale = !todo.length && cv.style.display !== 'none';
  if (app.namesKey === key && !stale) return; app.namesKey = key;
  // An empty names canvas is hidden, not just cleared: a full-screen transparent layer still costs WebKit a
  // composite every frame (the whole wallpaper, and the city and close-up views, never show it).
  cv.style.display = todo.length ? '' : 'none';
  const c = cv.getContext('2d'), k = app.art ? app.art.s / app.nameU : 1; c.clearRect(0, 0, cv.width, cv.height);
  todo.forEach(o => {
    // Leaders: 1 font pixel wide, along the native pixels the layout chose.
    c.fillStyle = o.lead;
    o.line.forEach(([x, y], i) => {
      const a = o.line[i - 1], b = o.line[i + 1], horiz = (a && a[1] === y) || (b && b[1] === y), vert = (a && a[0] === x) || (b && b[0] === x) || (!a && !b);
      const X = Math.floor((x + .5) * k), Y = Math.floor((y + .5) * k), x0 = Math.floor(x * k), x1 = Math.ceil((x + 1) * k), y0 = Math.floor(y * k), y1 = Math.ceil((y + 1) * k);
      if (vert) c.fillRect(X, y0, 1, y1 - y0); if (horiz) c.fillRect(x0, Y, x1 - x0, 1);
    });
    const lx = Math.round((o.x + 1) * k), ly = Math.round((o.y + 1) * k);
    pixText(c, o.t, lx + 1, ly + 1, NAMEC.shadow); pixText(c, o.t, lx, ly, o.col);
  });
}

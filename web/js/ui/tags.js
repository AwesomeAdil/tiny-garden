// Name tags over the city map (islands and the town square) and the bridge-slot pips. Ported from page 38.
// City tags are positioned in % of the 320x200 map, so they follow it at any scale.
// The galaxy and system names are pixel text on their own canvas (#names), placed by ui/names.js.
import { RES, NAMEC } from '../core/palette.js';
import { ico, uico, pixText, textW } from '../core/icons.js';
import { W, H } from '../sim/content.js';
import { isl } from '../sim/world.js';
import { wants, met, ropesAt, slots } from '../sim/economy.js';
import { sysSpots } from '../draw/system.js';
import { GSYS, gpos, galShownRot, galAbove } from '../draw/galaxy.js';
import { artMask, placeNames, namesOn } from './names.js';

// One square pip per bridge slot: filled = used, hollow = free, red = over the limit.
export function pips(w, n) {
  const c = ropesAt(w, n.id), s = slots(n); let h = '';
  for (let i = 0; i < Math.max(c, s); i++) h += i >= s ? '<i class="x"></i>' : i < c ? '<i class="on"></i>' : '<i></i>';
  return '<span class="pips">' + h + '</span>';
}

const at = (x, y) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`;

function tagsHTML(app) {
  if (app.game.ui.view !== 'planet') return '';
  const w = app.w, S = w.S, ISL = w.def.isl, hub = w.hub;
  let h = isl(w).map(n => {
    const s = ISL[n.id], seen = S.found.has(n.id) || S.survey; let inner;
    if (!seen) inner = '<span style="color:#6e738d">?</span>';
    else {
      const req = RES.filter(k => wants(w, n, k)).map(ico).join(''), found = S.found.has(n.id), slow = found && !met(w, n);
      inner = `<span style="color:${s.col}">${s.name}${n.level > 1 ? ' <span class="lv">' + uico('star').repeat(n.level - 1) + '</span>' : ''}${found ? ' ' + pips(w, n) : ''}</span>` +
        (found ? `<span class="row">${ico(s.makes)}${n.stock[s.makes]}${req ? ' <span class="want">wants</span>' + req : ''}${slow ? ' <span class="slow">slow</span>' : ''}</span>` : '');
    }
    return `<div class="ntag" style="${at(n.x, n.y + 12)}">${inner}</div>`;
  }).join('');
  h += `<div class="ntag" style="${at(hub.x + 44, hub.y - 5)}"><span style="color:#8aadf4">TOWN SQUARE ${pips(w, hub)}</span></div>`;
  return h;
}

export function renderTags(app) { const el = app.els.tags, h = tagsHTML(app); if (el.dataset.last !== h) { el.dataset.last = h; el.innerHTML = h } renderNames(app) }

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
    const wh = app.els.where, dpr = window.devicePixelRatio || 1, block = wh && wh.offsetWidth ? [{ x: 0, y: 0, w: Math.ceil((wh.offsetLeft + wh.offsetWidth) * dpr / s) + 2, h: Math.ceil((wh.offsetTop + wh.offsetHeight) * dpr / s) + 2 }] : [];
    const m = artMask(art.pix.px, Wn, Hn, gal ? 36 : 60, gal ? 6 : 2), out = placeNames(items, m, { margin: Math.ceil(24 / s), gap: 3, block, prev: app.namesPrev });
    app.namesPrev = out;
    todo = out.map((o, i) => o && { ...o, t: items[i].t, col: items[i].col, lead: items[i].lead }).filter(Boolean);
  }
  const key = JSON.stringify(todo.map(o => [o.t, o.x, o.y, o.line.length, o.line[0]])) + (cv ? cv.width + 'x' + cv.height : '');
  if (!cv || app.namesKey === key) return; app.namesKey = key;
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

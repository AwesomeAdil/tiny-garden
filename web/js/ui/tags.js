// Name tags over the map (islands, planets, stars) and the bridge-slot pips. Ported from page 38.
// Tags are positioned in % of the 320x200 map, so they follow it at any scale.
import { clamp } from '../core/pixel.js';
import { RES } from '../core/palette.js';
import { ico, uico } from '../core/icons.js';
import { W, H } from '../sim/content.js';
import { isl } from '../sim/world.js';
import { wants, met, ropesAt, slots } from '../sim/economy.js';
import { sysPlanets, sysPos } from '../sim/system.js';
import { GSYS, gpos, galRot } from '../draw/galaxy.js';

// One square pip per bridge slot: filled = used, hollow = free, red = over the limit.
export function pips(w, n) {
  const c = ropesAt(w, n.id), s = slots(n); let h = '';
  for (let i = 0; i < Math.max(c, s); i++) h += i >= s ? '<i class="x"></i>' : i < c ? '<i class="on"></i>' : '<i></i>';
  return '<span class="pips">' + h + '</span>';
}

const at = (x, y) => `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%`;

function tagsHTML(app) {
  const game = app.game, v = game.ui.view;
  if (v === 'galaxy') {
    const rot = galRot(app.t), settled = game.worlds.filter(w => w.started).length;
    return GSYS.map(g => { const q = gpos(g.q, g.a, rot), sub = g.ours ? '<span class="row">' + settled + ' planet' + (settled === 1 ? '' : 's') + ' settled</span>' : '';
      return `<div class="ntag" style="left:${clamp(q.x / W * 100, 11, 89).toFixed(2)}%;top:${((q.y + 5) / H * 100).toFixed(2)}%"><span style="color:${g.ours ? '#eed49f' : '#8087a2'}">${g.name.toUpperCase()}</span>${sub}</div>` }).join('');
  }
  if (v === 'system') {
    const T = game.worlds[0].S.time;
    return sysPlanets(game).map(p => {
      const q = sysPos(p, T), on = p.w && p.w.started;
      let sub = '';
      if (on) { const f = isl(p.w).filter(n => p.w.S.found.has(n.id)), top = Math.max(1, ...f.map(n => n.level)); sub = f.length + ' island' + (f.length === 1 ? '' : 's') + (top > 1 ? ' <span class="lv">' + uico('star').repeat(top - 1) + '</span>' : '') }
      return `<div class="ntag" style="${at(q[0], q[1] + p.r + 3)}"><span style="color:${on ? '#8aadf4' : '#6e738d'}">${p.name}</span>${on ? '<span class="row">' + sub + '</span>' : ''}</div>`;
    }).join('');
  }
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

export function renderTags(app) { const el = app.els.tags, h = tagsHTML(app); if (el.dataset.last !== h) { el.dataset.last = h; el.innerHTML = h } }

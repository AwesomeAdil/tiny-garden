// The side panel (island, bridge, town square with ledger, shop, system with cable priority, galaxy)
// and the stock line under the map. Ported from page 38.
import { RES, NAME } from '../core/palette.js';
import { ico, uico, chip } from '../core/icons.js';
import { SPEED } from '../sim/content.js';
import { node, isl, dist } from '../sim/world.js';
import { upkeep, incomeMin, ropeUp, ropeSpeed, ropesAt, slots, crowd, met, rateOf, boost } from '../sim/economy.js';
import { sysPlanets } from '../sim/system.js';
import { SHOP_ITEMS, canBuy, buy } from '../sim/shop.js';
import { geomR } from '../draw/map.js';
import { GSYS } from '../draw/galaxy.js';
import { say } from './guide.js';
import { setShop, setView, zoomTo } from './dock.js';

const DEFSEL = { t: 'node', id: 'planet' };
const iname = (w, id) => w.def.isl[id] ? w.def.isl[id].name : 'town square';

// What a shop item would be bought for: a found island or the town square, the selected bridge, or nothing needed.
export function shopTarget(w, it) {
  const S = w.S;
  if (it.target === 'node') { const n = S.sel.t === 'node' ? node(w, S.sel.id) : null; return n && (n.kind === 'planet' || S.found.has(n.id)) ? n : null }
  if (it.target === 'rope') return S.sel.t === 'rope' ? S.ropes.find(r => r.id === S.sel.id) || null : null;
  return true;
}
const tname = (w, it, tg) => it.target === 'node' ? (tg.kind === 'planet' ? 'the town square' : w.def.isl[tg.id].name) : it.target === 'rope' ? 'the bridge ' + iname(w, tg.a) + ' to ' + iname(w, tg.b) : '';

export function shopHTML(app) {
  const w = app.w;
  return `<h3 style="color:var(--yellow)">SHOP<small>paid from ${w.def.name}'s town square</small></h3><p>Click an island or a bridge on the map to choose what you're buying for.</p>` +
    SHOP_ITEMS.map(it => `<div class="shopi"><h5>${uico(it.icon)}${it.name}</h5><p>${it.what(app.game, w)}</p><div class="row2"><span class="chips" data-v="c_${it.id}"></span><span class="for" data-v="f_${it.id}"></span><span class="sp"></span><button class="act" type="button" data-buy="${it.id}">Buy</button></div></div>`).join('');
}

export function ledgerHTML(w) {
  const S = w.S, u = upkeep(w), inc = incomeMin(w, 'rock'), net = inc - u.all;
  return `<table class="ledger"><tr><td>Rock coming in (last minute)</td><td class="pos">+${inc}</td></tr><tr><td>Bridges (${S.ropes.length}), longer ones cost more</td><td class="neg">−${u.b.toFixed(1)}</td></tr><tr><td>Grown islands (more for each level)</td><td class="neg">−${u.i.toFixed(1)}</td></tr><tr class="tot"><td>Each minute</td><td class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${net.toFixed(1)} Rock</td></tr></table>` +
    (S.unpaid ? '<p class="st bad">Out of Rock: bridges are fraying, and walkers go at half speed.</p>' : '');
}

function fill(app, html, key, vals, dis = {}) {
  const panel = app.els.panel;
  if (html !== undefined) { panel.innerHTML = html; app.panelKey = key }
  panel.querySelectorAll('[data-v]').forEach(e => { let v = vals[e.dataset.v]; if (v === undefined) return; if (Array.isArray(v)) { e.className = 'st ' + v[1]; v = v[0] } if (e.dataset.last !== v) { e.dataset.last = v; e.innerHTML = v } });
  panel.querySelectorAll('[data-w]').forEach(e => { if (vals[e.dataset.w] !== undefined) e.style.width = vals[e.dataset.w] });
  panel.querySelectorAll('[data-act]').forEach(b => { if (dis[b.dataset.act] !== undefined) b.disabled = dis[b.dataset.act] });
  panel.querySelectorAll('[data-buy]').forEach(b => { if (dis['buy_' + b.dataset.buy] !== undefined) b.disabled = dis['buy_' + b.dataset.buy] });
  panel.querySelectorAll('[data-pri]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pri === app.game.ui.pri ? 'true' : 'false'));
}

export function renderPanel(app) {
  const game = app.game, ui = game.ui, w = app.w, S = w.S, hub = w.hub, ISL = w.def.isl, GOAL = w.def.goal;
  let key, html, vals = {}, dis = {};
  const fresh = k => { key = k; return k !== app.panelKey };

  if (app.shop && ui.view === 'planet') {
    if (fresh('shop' + w.def.key + S.patch + S.survey + S.cable)) html = shopHTML(app);
    SHOP_ITEMS.forEach(it => {
      const c = it.cost(game, w), tg = shopTarget(w, it), can = !it.can || it.can(game, w, tg === true ? undefined : tg);
      vals['c_' + it.id] = Object.keys(c).map(k => chip(k, c[k], hub.stock[k] < c[k])).join('');
      vals['f_' + it.id] = it.target === 'none' ? (can ? '' : 'done') : tg ? 'for ' + tname(w, it, tg) + (can ? '' : ' (already has it)') : 'pick ' + (it.target === 'node' ? 'an island' : 'a bridge') + ' on the map';
      dis['buy_' + it.id] = !tg || !canBuy(game, w, it.id, tg === true ? true : tg);
    });
    return fill(app, html, key, vals, dis);
  }

  if (ui.view === 'galaxy') {
    const g = GSYS.find(x => x.name === ui.galSel) || GSYS[0];
    if (fresh('gal' + g.name)) html = g.ours
      ? `<h3 style="color:var(--yellow)">${g.name.toUpperCase()}<small>your home star</small></h3><p data-v="gs"></p><div class="acts"><button class="act" type="button" data-act="tosys">Zoom in</button></div><h4>Up here</h4><p>Your whole story so far fits inside that one yellow point. The other stars come later. Once every planet around ${g.name} is linked in a ring and the Dyson sphere is built, the garden's seeds can start again at the next star.</p>`
      : `<h3 style="color:#8087a2">${g.name.toUpperCase()}<small>a star you haven't reached</small></h3><p>Not reached yet. Reaching another star comes after the Dyson sphere around ${GSYS[0].name}.</p>`;
    if (g.ours) vals = { gs: game.worlds.filter(x => x.started).map(x => x.def.name + ' (' + isl(x).filter(n => x.S.found.has(n.id)).length + ' islands)').join(' · ') + ' · ' + game.cables.length + ' cable' + (game.cables.length === 1 ? '' : 's') };
    return fill(app, html, key, vals);
  }

  if (ui.view === 'system') {
    const ps = sysPlanets(game), p = ps.find(x => x.name === ui.sysSel) || ps[0], on = p.w && p.w.started;
    if (fresh('sys' + p.name + on + game.cables.length)) html = on
      ? `<h3 style="color:#8aadf4">${p.name}<small>${p.full}</small></h3><p data-v="sum"></p><p data-v="cab"></p><h4>Town square</h4><div class="chips" data-v="inv"></div><div class="acts"><button class="act" type="button" data-act="zoom">Zoom in</button></div>${game.cables.length ? '<h4>What the cable sends first</h4><div class="acts pri">' + ['auto'].concat(RES).map(k => `<button class="px dk pk" type="button" data-pri="${k}" aria-pressed="false">${k === 'auto' ? '<span class="any">ANY</span>' : ico(k)}${k === 'auto' ? 'needed' : NAME[k]}</button>`).join('') + '</div>' : ''}<h4>What you do up here</h4><p>Each city keeps running while you look at another one. Up here you check which planet needs you, decide what the cable carries, and time things around the star. <b>Later:</b> reach the outer planets, then link every planet into a ring to build the Dyson sphere.</p>`
      : `<h3 style="color:#6e738d">${p.name}<small>${p.full}</small></h3><p>Not reached yet. ${p.w ? `Launch the first long cable from ${game.worlds[0].def.name} to reach it.` : 'Another cable will reach it later.'}</p>`;
    if (on) {
      const pw = p.w, wi = game.worlds.indexOf(pw), f = isl(pw).filter(n => pw.S.found.has(n.id)), cb = game.cables.find(c => c.a === wi || c.b === wi);
      vals = { sum: `${f.length} of ${isl(pw).length} islands found · ` + f.map(n => pw.def.isl[n.id].name + ' ' + n.level).join(', '),
        cab: cb ? (cb.blocked ? '<span style="color:var(--red)">Cable blocked by the star. It waits until the way is clear.</span>' : cb.load.length ? 'Cable carrying ' + cb.load.map(k => ico(k)).join('') + ' ' + cb.load.map(k => NAME[k]).join(', ') : 'Cable waiting for something to carry') : 'No cable yet.',
        inv: RES.map(k => chip(k, pw.hub.stock[k])).join('') };
    }
    return fill(app, html, key, vals);
  }

  if (S.sel.t === 'rope') {
    const r = S.ropes.find(r => r.id === S.sel.id);
    if (!r) { S.sel = { ...DEFSEL }; return renderPanel(app) }
    const g = geomR(w, r);
    if (fresh('r' + r.id)) html = `<h3 style="color:#c9a58e">ROPE BRIDGE<small>${ISL[r.a] ? ISL[r.a].name : 'Town square'} to ${iname(w, r.b)}</small></h3><p class="st" data-v="ten"></p><p data-v="trip"></p><p data-v="car"></p><p data-v="up"></p><p class="st bad" data-v="jam"></p><p class="st bad" data-v="tang"></p><div class="acts"><button class="act alt" type="button" data-act="cut">Cut this bridge</button></div>`;
    vals = { ten: g.T > .97 ? 'At full stretch: it won\'t go further' : g.T > .85 ? 'Taut' : g.T > .65 ? 'A little slack' : 'Very slack: trips take longer',
      trip: `About ${(Math.max(8, dist(g.A, g.B) - 24) / SPEED / ropeSpeed(w, r)).toFixed(1)} s each way${r.fast ? ' (quick walker)' : ''}`,
      up: `Upkeep: ${ropeUp(r.len).toFixed(1)} Rock a minute`,
      jam: [g.A, g.B].filter(n => crowd(w, n) > 0).map(n => `${n.kind === 'planet' ? 'The town square' : ISL[n.id].name} has more bridges than slots, so this walker is slowed.`).join(' ') + (S.unpaid ? ' Fraying: upkeep is unpaid.' : ''),
      car: r.load.length ? 'Carrying ' + r.load.map(x => `${ico(x.k)} ${NAME[x.k]} to ${x.d === 'planet' ? 'the town square' : ISL[x.d].name}`).join(', ') : 'Waiting for something to carry',
      tang: w.TANG.has(r.id) ? 'Tangled with another bridge: walkers wait until you untangle it.' : '' };
    return fill(app, html, key, vals);
  }

  const n = node(w, S.sel.id) || hub;
  if (n.kind === 'planet') {
    if (fresh('p' + S.cable)) html = `<h3 style="color:#8aadf4">TOWN SQUARE<small>the planet</small></h3><p>Surplus collects here. It pays for ropes, moves and the big shared project, and it hands things on to any island that asks.</p><p data-v="rc"></p><p data-v="sl"></p><h4>Upkeep</h4><div data-v="led"></div><h4>Here now</h4><div class="chips" data-v="inv"></div><h4>The goal: the first long cable</h4><div class="chips" data-v="goal"></div><div class="acts"><button class="act" type="button" data-act="launch">Launch the cable</button><button class="act alt" type="button" data-act="shop">Open the shop</button></div>${S.cable ? '<div class="win">The cable is up. Keep tinkering if you like.</div>' : ''}`;
    vals = { rc: 'Ropes, moves, upkeep and the shop are all paid from here.', sl: `Bridges here: ${ropesAt(w, 'planet')} of ${slots(hub)} slots` + (crowd(w, hub) ? ' <span style="color:var(--red)">(jammed)</span>' : ''), led: ledgerHTML(w),
      inv: RES.map(k => chip(k, hub.stock[k])).join(''), goal: Object.keys(GOAL).map(k => chip(k, `${Math.min(hub.stock[k], GOAL[k])}/${GOAL[k]}`, hub.stock[k] < GOAL[k])).join('') };
    dis = { launch: S.cable || !Object.keys(GOAL).every(k => hub.stock[k] >= GOAL[k]) };
    return fill(app, html, key, vals, dis);
  }
  if (!S.found.has(n.id)) {
    if (fresh('u' + n.id)) html = '<h3 style="color:#6e738d">AN ISLAND YOU HAVEN\'T REACHED</h3><p>Tie a rope to it from something within reach to find out what it is.</p>';
    return fill(app, html, key, vals);
  }
  const s = ISL[n.id];
  if (fresh('i' + n.id + n.level)) html = `<h3 style="color:${s.col}">${s.name}<small>level ${n.level}</small></h3><p>${s.quirk}</p><p>Makes ${chip(s.makes, '')} · needs ${s.needs.map(k => chip(k, '')).join(' ')}</p><p class="st" data-v="stat"></p><p data-v="bon"></p><p data-v="sl"></p><p data-v="up"></p>${n.level < 3 ? '<h4>Growing to level ' + (n.level + 1) + '</h4><div class="gbar"><i data-w="g"></i></div><p>It grows while it\'s thriving, by using up what it needs.</p>' : '<h4>Fully grown</h4>'}<h4>Sitting here</h4><div class="chips" data-v="inv"></div>`;
  const m = met(w, n), miss = s.needs.filter(k => n.stock[k] < 1);
  vals = { stat: m ? [`Thriving: making ${rateOf(w, n).toFixed(2)} ${NAME[s.makes]} a second`, 'good'] : [`Slowed: it needs ${miss.map(k => NAME[k]).join(' and ')}. Connect an island that makes it.`, 'bad'],
    bon: boost(w, n) > 1 ? `Neighbour bonus: +${Math.round((boost(w, n) - 1) * 100)}%` : '',
    sl: `Bridges: ${ropesAt(w, n.id)} of ${slots(n)} slots` + (crowd(w, n) ? ' <span style="color:var(--red)">(jammed: its walkers are slowed)</span>' : ''),
    up: n.level > 1 ? `Upkeep: ${((n.level - 1) * .35 * (1 - .25 * S.patch)).toFixed(1)} Rock a minute at level ${n.level}` : '',
    inv: RES.some(k => n.stock[k]) ? RES.filter(k => n.stock[k]).map(k => chip(k, n.stock[k])).join('') : '<span>Nothing yet</span>', g: Math.round(n.grow * 100) + '%' };
  return fill(app, html, key, vals);
}

export function renderStock(app) {
  const w = app.w, S = w.S, hub = w.hub, u = upkeep(w), inc = incomeMin(w, 'rock'), net = inc - u.all, el = app.els.stock;
  const v = '<span class="who">' + w.def.name + ' town square</span>' + RES.map(k => chip(k, hub.stock[k])).join('') + `<span class="upk${S.unpaid || net < 0 ? ' bad' : ''}">${S.unpaid ? 'BRIDGES FRAYING · ' : ''}Rock in <b>+${inc}</b>/min · upkeep <b>−${u.all.toFixed(1)}</b>/min</span>`;
  if (el.dataset.last !== v) { el.dataset.last = v; el.innerHTML = v }
}

export function wirePanel(app) {
  const panel = app.els.panel;
  panel.addEventListener('click', e => {
    const w = app.w, S = w.S;
    const pb = e.target.closest('[data-pri]'); if (pb) { app.game.ui.pri = pb.dataset.pri; renderPanel(app); return }
    const bb = e.target.closest('[data-buy]');
    if (bb && !bb.disabled) { const it = SHOP_ITEMS.find(x => x.id === bb.dataset.buy), tg = shopTarget(w, it); if (tg) buy(app.game, w, it.id, tg); app.panelKey = ''; renderPanel(app); return }
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'cut') { S.ropes = S.ropes.filter(r => r.id !== S.sel.id); S.sel = { ...DEFSEL }; say(app, 'Bridge cut.') }
    else if (a === 'launch') buy(app.game, w, 'cable', true);
    else if (a === 'shop') setShop(app, true);
    else if (a === 'zoom') { const p = sysPlanets(app.game).find(x => x.name === app.game.ui.sysSel); if (p && p.w) zoomTo(app, app.game.worlds.indexOf(p.w)) }
    else if (a === 'tosys') setView(app, 'system');
    app.panelKey = ''; renderPanel(app);
  });
}

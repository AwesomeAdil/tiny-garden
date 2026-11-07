// The price tag that follows your hand while tying or moving. Ported from page 38.
import { ico } from '../core/icons.js';
import { W, H, MAXR } from '../sim/content.js';
import { node } from '../sim/world.js';
import { ropeCost, ropeUp, ropesAt, slots } from '../sim/economy.js';
import { nodeAt } from '../draw/map.js';

export function rockRow(c) { const n = Math.min(c, 14); return ico('rock').repeat(n) + (c > 14 ? '<span class="more">+' + (c - 14) + '</span>' : '') }

export function renderPrice(app) {
  const el = app.els.price, w = app.w, S = w.S, hub = w.hub, ISL = w.def.isl, drag = app.drag, pointer = app.pointer, planet = app.game.ui.view === 'planet' && app.mode === 'play';
  let h = '', cls = '', pos = null;
  if (planet && drag && drag.kind === 'rope' && pointer) {
    const A = node(w, drag.id), B = nodeAt(w, pointer), tg = B && B !== A ? B : null, tp = tg || pointer, d = Math.hypot(tp.x - A.x, tp.y - A.y), c = ropeCost(d), far = d > MAXR, poor = hub.stock.rock < c, len = Math.min(MAXR, d + 12);
    const word = far ? 'too far' : c <= 3 ? 'cheap' : c <= 8 ? 'pricey' : 'very pricey'; cls = far || poor ? 'no' : c <= 3 ? 'p1' : c <= 8 ? 'p2' : 'p3';
    const warns = []; if (far) warns.push('Go through an island in between'); else if (poor) warns.push(`Can't afford: the town square has ${hub.stock.rock}`);
    [A, tg].forEach(n => { if (n && ropesAt(w, n.id) >= slots(n)) warns.push(`${n.kind === 'planet' ? 'The town square' : ISL[n.id].name} is full: this jams its docks`) });
    h = `<div class="word">${word}</div><div class="big">${!far ? rockRow(c) + '<b>' + c + '</b>' : ''}</div><div class="meter" style="color:${cls === 'p1' ? '#a6da95' : cls === 'p2' ? '#eed49f' : cls === 'p3' ? '#f5a97f' : '#ed8796'}"><i style="width:${Math.min(100, d / MAXR * 100).toFixed(0)}%"></i></div>` +
      (!far ? `<div>then <b>${ropeUp(len).toFixed(1)}</b> Rock/min upkeep</div>` : '') + warns.map(x => `<div class="warn">${x}</div>`).join('');
    pos = pointer;
  } else if (planet && drag && drag.kind === 'move' && drag.moved && node(w, drag.id).kind === 'island') {
    const n = node(w, drag.id), p = drag.paid || 0, frac = (drag.acc || 0) % 1; cls = drag.broke ? 'no' : p <= 3 ? 'p1' : p <= 8 ? 'p2' : 'p3';
    h = `<div class="word">moving ${ISL[n.id].name}</div><div class="big">${p ? rockRow(p) : ''}<b>${p}</b></div><div class="meter" style="color:#eed49f"><i style="width:${(frac * 100).toFixed(0)}%"></i></div><div>The bar fills toward the next Rock</div>${drag.broke ? '<div class="warn">Out of Rock: it won\'t move further</div>' : ''}`;
    pos = { x: n.x, y: n.y - 14 };
  }
  if (!h) { if (el.style.display !== 'none') el.style.display = 'none'; return }
  el.className = 'price ' + cls; if (el.dataset.last !== h) { el.dataset.last = h; el.innerHTML = h } el.style.display = 'block';
  const left = pos.x > W * .62;
  el.style.left = left ? '' : ((pos.x + 10) / W * 100).toFixed(2) + '%'; el.style.right = left ? ((W - pos.x + 10) / W * 100).toFixed(2) + '%' : ''; el.style.top = (Math.max(2, pos.y - 34) / H * 100).toFixed(2) + '%';
}

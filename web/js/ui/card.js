// The pick card (a small pixel card next to a clicked spot: its 2-3 picks, and any waiting gifts) and the gift
// tray in the side panel (up to 3 gifts; clicking one arms it, and the next spot click places it).
// Choosing calls sim/grow.js choose (or sim/events.js placeGift); the island's sprite rebuilds by itself because
// its key (draw/kit.js islandKey) changes with its spots.
import { PixCtx } from '../core/pixctx.js';
import { offers, choose } from '../sim/grow.js';
import { placeGift } from '../sim/events.js';
import { GIFTS } from '../sim/picks.js';
import { islandSprite, drawIsland } from '../draw/kit.js';
import { spotXY } from '../draw/city.js';
import { worldView } from '../core/pixel.js';
import { renderPanel } from './panel.js';
import { say } from './guide.js';

const PREV = 24, BACK = '#181926';
const PREVS = new Map();
// A 24x24 picture of one prop (or gift) on a sliver of the island type's rock: islandSprite of just that prop.
export function propPreview(type, seed, prop, gift = null) {
  const key = [type, seed, prop, gift && gift.variant].join();
  let px = PREVS.get(key);
  if (!px) {
    const spec = { type, seed, stage: 1, hw: 10, depth: 8, picks: gift ? [] : [{ spot: 4, prop }], gifts: gift ? [{ spot: 4, kind: gift.kind, variant: gift.variant | 0 }] : [] };
    const I = islandSprite(spec);
    px = new PixCtx(PREV, PREV); px.fillStyle = BACK; px.fillRect(0, 0, PREV, PREV);
    drawIsland(px, I, PREV / 2 - 2, 17, 0); // spot 4 sits 2 px right of the top centre at hw 10
    PREVS.set(key, px); if (PREVS.size > 48) PREVS.delete(PREVS.keys().next().value);
  }
  const cv = document.createElement('canvas'); cv.width = PREV; cv.height = PREV;
  cv.getContext('2d').putImageData(px.img, 0, 0);
  return cv;
}

export const giftName = g => g.kind === 'hut' && g.name ? `${g.name}'s hut` : GIFTS[g.kind] ? GIFTS[g.kind].name : 'Gift';
const nameOf = (w, n) => n.name || w.def.isl[n.id].name;
const SPOT_WORD = ['left rim', 'middle', 'right rim', 'middle', 'gift spot'];

function button(cls, data, cv, label) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'px ' + cls;
  for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
  const s = document.createElement('span'); s.textContent = label; b.append(cv, s);
  return b;
}

// Open the card for spot i of island n, next to the spot.
export function openCard(app, w, n, i) {
  const el = app.els.card, game = app.game, picks = offers(w, n, i), art = app.art;
  app.card = { id: n.id, i, world: w.def.key };
  el.replaceChildren();
  const h = document.createElement('h5'); h.textContent = `${nameOf(w, n)} · ${SPOT_WORD[i] || 'spot'}`; el.append(h);
  const row = document.createElement('div'); row.className = 'opts';
  for (const p of picks) row.append(button('opt', { pick: p.id }, propPreview(n.id, n.seed, p.prop), p.name));
  game.gifts.forEach((g, gi) => row.append(button('opt gift', { gift: gi }, propPreview(n.id, n.seed, g.kind, g), giftName(g).toUpperCase())));
  if (!row.children.length) { const p = document.createElement('p'); p.textContent = 'Nothing to grow here yet.'; el.append(p) } else el.append(row);
  // Beside the spot, flipped to its left on the right of the map; in % of the canvas so it follows any scale.
  const v = { w: art.w, h: art.h, ...worldView(art.w, art.h) }, [x, y] = spotXY(n, i, v, app.t), right = x > art.w * .6;
  Object.assign(el.style, { left: right ? '' : ((x + 8) / art.w * 100).toFixed(2) + '%', right: right ? ((art.w - x + 8) / art.w * 100).toFixed(2) + '%' : '', top: (Math.max(0, y - 30) / art.h * 100).toFixed(2) + '%' });
  el.hidden = false;
}

export function closeCard(app) { app.card = null; if (app.els.card) app.els.card.hidden = true }

function pick(app, b) {
  const c = app.card, w = app.w; if (!c || c.world !== w.def.key) return closeCard(app);
  const n = w.S.nodes.find(q => q.id === c.id); if (!n) return closeCard(app);
  if (b.dataset.pick) {
    const p = offers(w, n, c.i).find(x => x.id === b.dataset.pick);
    if (p && choose(w, n, c.i, p.id)) say(app, `${p.name[0] + p.name.slice(1).toLowerCase()} grows on ${nameOf(w, n)}${p.sends ? `. It sends ${p.sends} now too.` : '.'}`);
  } else if (b.dataset.gift !== undefined) {
    const gi = +b.dataset.gift, g = app.game.gifts[gi];
    if (g && placeGift(app.game, w, n, gi, c.i)) say(app, `${giftName(g)} placed on ${nameOf(w, n)}.`);
    app.armedGift = null; renderTray(app);
  }
  closeCard(app); app.panelKey = ''; renderPanel(app);
}

// ---------- the tray ----------
export function renderTray(app) {
  const el = app.els.tray, gifts = app.game.gifts;
  if (app.armedGift != null && !gifts[app.armedGift]) app.armedGift = null;
  const key = gifts.map(g => g.id).join() + '|' + app.armedGift;
  if (el.dataset.last === key) return; el.dataset.last = key;
  el.replaceChildren(); el.hidden = !gifts.length;
  if (!gifts.length) return;
  const h = document.createElement('h4'); h.textContent = 'Gifts'; el.append(h);
  const row = document.createElement('div'); row.className = 'opts';
  gifts.forEach((g, gi) => { const b = button('dk gift', { gi }, propPreview('home', 1, g.kind, g), giftName(g)); b.setAttribute('aria-pressed', app.armedGift === gi ? 'true' : 'false'); row.append(b) });
  el.append(row);
}

export function wireCard(app) {
  app.els.card.addEventListener('pointerdown', e => e.stopPropagation());
  app.els.card.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(app, b) });
  app.els.tray.addEventListener('click', e => {
    const b = e.target.closest('[data-gi]'); if (!b) return;
    const gi = +b.dataset.gi, g = app.game.gifts[gi]; if (!g) return;
    app.armedGift = app.armedGift === gi ? null : gi; renderTray(app);
    if (app.armedGift != null) say(app, `Click a glowing spot to place the ${giftName(g)}. ${GIFTS[g.kind] ? GIFTS[g.kind].perk : ''}`);
  });
}

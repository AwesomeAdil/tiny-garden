// The rare visitors on screen (page 44: ev-whale, ev-trav, ev-aurora). Reads game.ev.active; progress is
// (worlds[0].S.time - t0) / dur, so the event plays at sim speed and stops the moment the sim ends it.
// Nothing is drawn during catch-up (the gift just waits in the tray). The gift itself is never drawn here.
import { TAU, P, clamp } from '../core/pixel.js';
import { COL } from '../core/palette.js';
import { isl } from '../sim/world.js';
import { A, BAY, glowAt, getSprite, bandOf, isleBob } from './kit.js';

// A space whale, head to the right, at (x, y): page 44's whale.
export function whale(c, x, y, t) {
  const n = 30;
  for (let i = 0; i < n; i++) {
    const f = i / n, h = Math.max(1, Math.round(6 * Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.15)), .6))), top = y - Math.round(h * .6) + Math.round(Math.sin(t * 1.5 - f * 3) * (1 - f) * 1.2);
    for (let j = 0; j < h; j++) P(c, j === 0 ? '#4a5596' : j >= h - 2 ? '#8aadf4' : '#343b6e', x + i, top + j);
    if (i % 5 === 2 && h > 3) P(c, '#e3eafc', x + i, top + 1);
    if (i > 8 && i < 26 && i % 2 && h > 4) P(c, '#6a7dc4', x + i, top + h - 2);
  }
  const ty = y + Math.round(Math.sin(t * 1.5) * 2);
  P(c, '#343b6e', x - 3, ty - 1, 3, 2); P(c, '#4a5596', x - 6, ty - 3, 3, 1); P(c, '#4a5596', x - 6, ty + 1, 3, 1); P(c, '#4a5596', x - 5, ty - 2, 1, 4);
  P(c, '#e3eafc', x + 25, y - 1); P(c, '#4a5596', x + 14, y + 3, 4, 1); P(c, '#4a5596', x + 15, y + 4, 2, 1);
  for (let i = 0; i < 5; i++) { const f = (t * .6 + i / 5) % 1; A(c, '#c5efe7', .6 * (1 - f), x - 6 - f * 20, y - 2 + Math.sin(i * 3) * 3) }
}
// The traveller (feet at x, y), with a lantern held out front: page 44's trav.
export function trav(c, x, y, st, d, cg) {
  P(c, '#4f3876', x - 1, y - 7, 3, 1); P(c, '#7350a0', x - 1, y - 6, 3, 4); P(c, '#f0c6c6', x + d, y - 6); P(c, cg, x - 2 * d, y - 6, 2, 2);
  P(c, '#eed49f', x + 2 * d, y - 3 + (st ? 1 : 0)); A(c, '#eed49f', .25, x + 2 * d - 1, y - 4 + (st ? 1 : 0), 3, 3);
  if (st) { P(c, '#363a55', x - 1, y - 2, 1, 2); P(c, '#363a55', x + 1, y - 2, 1, 2) } else P(c, '#363a55', x, y - 2, 1, 2);
}
// The traveller's little sailboat, hull centred on bx with its top at by.
export function boat(c, bx, by) { P(c, '#9c7d70', bx - 4, by, 9, 2); P(c, '#5e4b48', bx - 3, by + 2, 7, 1); P(c, '#6e5a55', bx, by - 9, 1, 9); for (let i = 0; i < 6; i++) P(c, '#e3eafc', bx + 1, by - 9 + i, Math.min(i, 5 - i) + 2, 1) }

// Aurora curtains across the top of the canvas; s fades them in and out.
function aurora(c, W, H, t, s) {
  const k = clamp(H / 120, 1, 3);
  for (let x = 0; x < W; x++) {
    const top = Math.round((6 + Math.sin(x * .12 / k + t * .8) * 3 + Math.sin(x * .05 / k - t * .3) * 4) * k), len = Math.round((14 + Math.sin(x * .27 + t * .6) * 5 + Math.sin(x * .031 + t * .2) * 4) * k);
    for (let j = 0; j < len; j++) {
      const f = j / len; if (BAY[(top + j) & 1][x & 1] > (1 - f) * .9) continue;
      A(c, f < .3 ? '#c5efe7' : f < .7 ? '#8bd5ca' : '#a6da95', s * .55 * (1 - f * .7), x, top + j);
    }
  }
}

// The traveller sails in from the right to one of the right-hand islands, steps onto its top and stays;
// the boat leaves at the end.
function traveller(c, w, view, t, p, variant) {
  const W = view.w, list = w ? isl(w).slice().sort((a, b) => b.x - a.x) : [], n = list.length ? list[variant % Math.min(3, list.length)] : null;
  const by0 = Math.round(Math.sin(t * 1.2));
  if (!n) { const bx = Math.round(W + 12 - p * (W + 24)), by = Math.max(20, view.oy + 60) + by0; boat(c, bx, by); trav(c, bx - 2, by, 0, -1, COL.light); return }
  const k = view.k || 1, I = getSprite(w, n, bandOf(n.y), k), X = Math.round(view.ox + n.x * k), Y = Math.round(view.oy + n.y * k) + isleBob(n, t), dock = X + I.hw + 13, stand = X + Math.round(I.hw * .35);
  const by = Y - 2 + by0, sail = (f, a, b) => Math.round(a + (b - a) * f);
  if (p < .4) { const bx = sail(p / .4, W + 12, dock); boat(c, bx, by); trav(c, bx - 2, by, 0, -1, COL.light); return }
  boat(c, p < .85 ? dock : sail((p - .85) / .15, dock, W + 12), by);
  if (p < .72) trav(c, sail((p - .4) / .32, dock - 6, stand), Y - 1, Math.floor(t * 6) % 2, -1, COL.light);
  else { trav(c, stand, Y - 1, 0, 1, COL.light); glowAt(c, stand + 2, Y - 4, '#eed49f', .5) }
}

// drawEvent(c, game, view, t, w?): view = {w, h, k, ox, oy} (core/pixel.js worldView), drawn in canvas pixels; w is the world on screen (the
// traveller lands on one of its islands; defaults to the event's world).
export function drawEvent(c, game, view, t, w) {
  const ev = game.ev, a = ev && ev.active;
  if (!a || ev.caught || !(a.dur > 0)) return;
  const p = (game.worlds[0].S.time - a.t0) / a.dur;
  if (!(p >= 0 && p < 1)) return;
  const W = view.w, H = view.h;
  if (a.kind === 'whale') whale(c, Math.round(-40 + p * (W + 80)), Math.max(14, Math.round(view.oy * .6)) + Math.round(Math.sin(p * TAU) * 4), t);
  else if (a.kind === 'traveller') traveller(c, w || game.worlds[a.world | 0], view, t, p, a.variant | 0);
  else if (a.kind === 'aurora') aurora(c, W, H, t, p < .1 ? p / .1 : p > .85 ? (1 - p) / .15 : 1);
}

// Rare visitors (whale, traveller, aurora) come by about every 6 hours and leave a gift to place on an island spot.
import { rngf } from '../core/pixel.js';
import { SPOTS, TRAVELLER_NAMES } from './picks.js';
import { spotOpen } from './grow.js';

export const EVENT_MEAN = 21600;
export const TRAY_MAX = 3;
export const EVENTS = {
  whale: { dur: 150, gift: 'coral', line: 'A space whale passed by while you were away.' },
  traveller: { dur: 120, gift: 'hut', line: 'A traveller passed by while you were away.' },
  aurora: { dur: 180, gift: 'banner', line: 'An aurora lit the sky while you were away.' },
};
const KINDS = Object.keys(EVENTS);

// Saveable RNG: the integer state rs advances by the mulberry32 increment on every draw.
export function draw(ev) {
  const u = rngf(ev.rs)();
  ev.rs = (ev.rs + 0x6D2B79F5) | 0;
  return u;
}
export const gap = ev => Math.max(1800, -Math.log(1 - draw(ev)) * EVENT_MEAN);

export function newEv(seed, t = 0) {
  const ev = { rs: seed | 0, nextAt: 0, active: null, caught: false, nextGift: 1 };
  ev.nextAt = t + gap(ev);
  return ev;
}

function giftOf(ev, kind, variant) {
  const g = { id: ev.nextGift++, kind: EVENTS[kind].gift, variant };
  if (g.kind === 'hut') g.name = TRAVELLER_NAMES[variant * 2 % TRAVELLER_NAMES.length + (draw(ev) < .5 ? 0 : 1)];
  return g;
}

// Returns false when the tray was full and the gift was lost.
function leave(game, kind, variant) {
  const g = giftOf(game.ev, kind, variant);
  if (game.gifts.length >= TRAY_MAX) return false;
  game.gifts.push(g);
  return true;
}

// The catch-up's one visit: its gift, and the "while you were away" line kept in the save (game.ui.away) until
// play mode next opens (ui/guide.js drainEvents), since the catch-up usually runs while the wallpaper is showing.
function caughtVisit(game, kind, variant) {
  const kept = leave(game, kind, variant);
  game.ui.away = EVENTS[kind].line + (kept ? '' : ' The tray was full.');
  game.ev.caught = true;
}

export function stepEvents(game, dt, opts = {}) {
  const ev = game.ev, w0 = game.worlds[0], t = w0.S.time;
  if (opts.catchup) {
    // A game saved mid-event: that event is the one catch-up event (no second one fires after it).
    if (ev.active) {
      const a = ev.active;
      ev.active = null;
      if (!ev.caught) caughtVisit(game, a.kind, a.variant);
      return;
    }
    if (t < ev.nextAt) return;
    if (!ev.caught) {
      const kind = KINDS[Math.floor(draw(ev) * KINDS.length)], variant = Math.floor(draw(ev) * 6);
      caughtVisit(game, kind, variant);
    }
    ev.nextAt = t + gap(ev);
    return;
  }
  if (ev.active) {
    const a = ev.active;
    if (t >= a.t0 + a.dur) { leave(game, a.kind, a.variant); ev.active = null }
    return;
  }
  if (t < ev.nextAt) return;
  const kind = KINDS[Math.floor(draw(ev) * KINDS.length)], variant = Math.floor(draw(ev) * 6);
  ev.active = { kind, t0: t, dur: EVENTS[kind].dur, world: 0, variant };
  ev.nextAt = t + gap(ev);
}

export const endCatchup = game => { game.ev.caught = false };

// Put tray gift `giftIdx` on spot `spotIdx` of island n (open and empty; spot 4 is gift-only).
export function placeGift(game, w, n, giftIdx, spotIdx) {
  const g = game.gifts[giftIdx];
  if (!g || !SPOTS[spotIdx] || !spotOpen(n, spotIdx) || n.spots[spotIdx]) return false;
  game.gifts.splice(giftIdx, 1);
  n.spots[spotIdx] = { gift: g };
  n.gifts.push(g);
  return true;
}

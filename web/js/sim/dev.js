// Dev helpers (tests, ?skip=1, shots and developer mode's buttons, ui/devpanel.js). Not part of normal play.
// Each dev* function is one button: small, pure on the game it is given, and it returns whether it did anything.
import { dist, isl, canTie, tie, spine, bandOf } from './world.js';
import { SPOTS } from './picks.js';
import { offers, choose, grow } from './grow.js';
import { stepAll } from './system.js';
import { growTown, townCost, CABLE_COST } from './town.js';
import { cost } from './flow.js';
import { EVENTS, KINDS, TRAY_MAX, draw, giftOf } from './events.js';
import { GOODS } from '../core/palette.js';

const closest = (w, ok) => {
  let best = null, bd = Infinity;
  for (const a of w.S.nodes) for (const b of w.S.nodes) {
    if (a.id === b.id || !ok(a, b) || !canTie(w, a, b).ok) continue;
    const d = dist(a, b);
    if (d < bd) { bd = d; best = [a, b] }
  }
  return best;
};

// The layout's spine first (town to the near islands, then outward island by island), then greedy: tie the
// nearest unconnected island to the connected set, then up to 4 extra ropes for redundancy.
export function autoNet(w) {
  const sorted = isl(w).slice().sort((a, b) => a.x - b.x).map(n => ({ id: n.id, x: n.x, y: n.y, band: bandOf(n.y) }));
  for (const [p, q] of spine(sorted)) { const a = w.S.nodes.find(n => n.id === p.id), b = w.S.nodes.find(n => n.id === q.id); if (canTie(w, a, b).ok) tie(w, a, b) }
  const on = new Set([w.hub.id]);
  for (const r of w.S.ropes) { on.add(r.a); on.add(r.b) }
  for (let p; (p = closest(w, (a, b) => on.has(a.id) && !on.has(b.id)));) { tie(w, p[0], p[1]); on.add(p[1].id) }
  for (let i = 0, p; i < 4 && (p = closest(w, () => true)); i++) tie(w, p[0], p[1]);
}

// Chooses the first offer at every open, unused spot (not spot 4), skipping `sends` picks.
export function autoPick(w) {
  for (const n of isl(w)) for (let i = 0; i < SPOTS.length; i++) {
    if (i === 4 || n.stage < SPOTS[i].opensAt || n.spots[i]) continue;
    const o = offers(w, n, i).find(p => !p.sends);
    if (o) choose(w, n, i, o.id);
  }
}

// World 0 networked, islands at stage 3 and picked, the cable paid, then 30 s of play.
export function skip(game) {
  const w = game.worlds[0];
  autoNet(w);
  isl(w).forEach(n => { n.stage = Math.max(n.stage, 3) });
  autoPick(w);
  w.hub.stage = 4;
  for (const k of Object.keys(w.hub.paid)) w.hub.paid[k] = CABLE_COST;
  growTown(game, w);
  for (let i = 0; i < 300; i++) stepAll(game, .1);
  return game;
}

// Fill: pays island n's current stage cost into n.paid, so the next sim step grows it the normal way.
export function devFill(w, n) {
  if (!n || n.kind !== 'island' || n.stage >= 4) return false;
  const c = cost(w, n);
  if (!GOODS.some(k => c[k] > 0)) return false;
  for (const k of GOODS) if (c[k] > 0) n.paid[k] = Math.max(n.paid[k], c[k]);
  return true;
}

// Grow: fill, then the real grow(), so n goes up one stage, its spots open and its "grew" line is posted.
export function devGrow(w, n) {
  if (!devFill(w, n)) return false;
  const was = n.stage;
  grow(w);
  return n.stage === was + 1;
}

// Whale / Traveller / Aurora: that visitor arrives now (drawn by draw/events.js) and leaves its gift when it goes,
// through stepEvents, so a full tray loses the gift exactly as in play. One visitor at a time.
export function devEvent(game, kind) {
  const ev = game.ev;
  if (!Object.hasOwn(EVENTS, kind) || ev.active) return false;
  ev.active = { kind, t0: game.worlds[0].S.time, dur: EVENTS[kind].dur, world: 0, variant: Math.floor(draw(ev) * 6) };
  return true;
}

// Gift: one random visitor's gift straight into the tray, never past TRAY_MAX.
export function devGift(game) {
  if (game.gifts.length >= TRAY_MAX) return false;
  const ev = game.ev, kind = KINDS[Math.floor(draw(ev) * KINDS.length)];
  game.gifts.push(giftOf(ev, kind, Math.floor(draw(ev) * 6)));
  return true;
}

// Town: world w's town goes up one stage (to 4 at most) through growTown.
export function devTown(game, w) {
  const hub = w.hub;
  if (hub.stage >= 4) return false;
  const c = townCost(w), was = hub.stage;
  for (const k of GOODS) hub.paid[k] = Math.max(hub.paid[k], c[k]);
  growTown(game, w);
  return hub.stage === was + 1;
}

// Cable: every island to stage 3 or more, the town to 4, the cable paid, then growTown builds it and starts the
// next world. Only once, and only where there is a next world.
export function devCable(game, w) {
  if (!w.def.next || w.S.cable || game.worlds.findIndex(x => x.def.key === w.def.next) < 0) return false;
  isl(w).forEach(n => { n.stage = Math.max(n.stage, 3) });
  w.hub.stage = 4;
  for (const k of GOODS) w.hub.paid[k] = CABLE_COST;
  growTown(game, w);
  return !!w.S.cable;
}

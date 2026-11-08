// Goods flow: islands make on demand, walkers carry goods toward the nearest need, chains take their share first.
import { GOODS } from '../core/palette.js';
import { CARRY, OUTBOX, RATE, SPEED, STAGE_COST } from './content.js';
import { node, isl, dist, makes } from './world.js';
import { allPairs, hops, nextHop } from './graph.js';
import { townCost } from './town.js';

const zero = () => Object.fromEntries(GOODS.map(k => [k, 0]));

// What n's current stage still needs in total (paid goods included).
export function cost(w, n) {
  if (n.kind === 'planet') return townCost(w);
  const c = zero(), m = makes(w, n), each = n.stage >= 1 && n.stage <= 3 ? STAGE_COST[n.stage] : 0;
  for (const k of GOODS) if (!m.includes(k) && !n.satisfied.includes(k)) c[k] = each;
  return c;
}

// Goods bound for `id`: on a rope, or waiting in a relay queue.
export function inbound(w, id, k) {
  let c = 0;
  for (const r of w.S.ropes) for (const x of r.load) if (x.d === id && x.k === k) c++;
  for (const n of w.S.nodes) for (const x of n.relay) if (x.d === id && x.k === k) c++;
  return c;
}

const rawNeed = (w, n, k) => cost(w, n)[k] - n.paid[k] - inbound(w, n.id, k);
export const need = (w, n, k) => Math.max(0, rawNeed(w, n, k));

// The nearest node `from` can reach that still needs k (by hops, then distance). Makers of k never ask for it.
export function demandFor(w, from, k) {
  const f = typeof from === 'string' ? node(w, from) : from;
  let best = null, bh = Infinity, bd = Infinity;
  for (const n of w.S.nodes) {
    if (n.id === f.id || makes(w, n).includes(k)) continue;
    const h = hops(w, f.id, n.id);
    if (h === Infinity || h > bh) continue;
    const d = dist(f, n);
    if (h === bh && d >= bd) continue;
    if (need(w, n, k) <= 0) continue;
    best = n.id; bh = h; bd = d;
  }
  return best;
}

// Islands that need a good no maker of it can reach: the guide names these so a layout never stalls silently.
export function stalls(w) {
  allPairs(w);
  const out = [];
  for (const n of isl(w)) for (const k of GOODS) {
    if (need(w, n, k) <= 0) continue;
    if (!isl(w).some(m => makes(w, m).includes(k) && hops(w, m.id, n.id) < Infinity)) out.push({ id: n.id, k });
  }
  return out;
}

// Task 5 multiplies in the coral perk.
export const walkSpeed = (w, r) => 1;

// Re-target X's relay queue; items no one needs any more are dropped (the good is lost).
function retarget(w, X) {
  for (const x of X.relay) x.d = null; // drop every reservation first, so no item counts against itself
  for (const x of X.relay) x.d = demandFor(w, X, x.k);
  X.relay = X.relay.filter(x => x.d !== null);
}

// Take up to `max` items at X that travel over to O next. take=false only looks.
function gather(w, r, X, O, max, take) {
  const got = [];
  retarget(w, X);
  for (let i = 0; i < X.relay.length && got.length < max;) {
    const x = X.relay[i];
    if (nextHop(w, X.id, x.d) === O.id) { got.push(x); if (take) { X.relay.splice(i, 1); r.load.push(x); continue } }
    i++;
  }
  if (!X.out) return got;
  for (let j = 0; j < GOODS.length && got.length < max; j++) {
    const k = GOODS[(r.next + j) % GOODS.length];
    while (got.length < max && X.out[k] >= 1) {
      const d = demandFor(w, X, k);
      if (d === null || nextHop(w, X.id, d) !== O.id) break;
      const x = { k, d };
      got.push(x);
      if (!take) break;
      X.out[k]--; r.load.push(x); r.next = (r.next + j + 1) % GOODS.length;
    }
  }
  return got;
}

// Goods arrive at Y: Y takes what it still needs (chains first), the rest waits in Y's relay and re-targets.
function arrive(w, r, Y) {
  while (r.load.length) {
    const x = r.load.shift(); // x no longer counts as inbound, so its own reservation is dropped
    if (rawNeed(w, Y, x.k) > 0) { Y.paid[x.k]++; continue }
    x.d = null; Y.relay.push(x); x.d = demandFor(w, Y, x.k);
    if (x.d === null) Y.relay.pop();
  }
}

export function step(w, dt) {
  const S = w.S;
  S.time += dt; allPairs(w);
  // Making: only while someone reachable needs the good.
  for (const n of isl(w)) for (const k of makes(w, n)) {
    if (n.out[k] >= OUTBOX || demandFor(w, n, k) === null) continue;
    n.out[k] = Math.min(OUTBOX, n.out[k] + RATE * dt);
  }
  for (const r of S.ropes) {
    const A = node(w, r.a), B = node(w, r.b), L = Math.max(8, dist(A, B) - 24);
    if (r.dir !== 0) {
      r.u += r.dir * dt * SPEED * walkSpeed(w, r) / L;
      if (r.u <= 0 || r.u >= 1) { r.u = r.u <= 0 ? 0 : 1; r.dir = 0; arrive(w, r, r.u === 0 ? A : B) }
      continue;
    }
    const X = r.u === 0 ? A : B, O = r.u === 0 ? B : A, toward = r.u === 0 ? 1 : -1;
    const fwd = r.way === 0 || r.way === toward, back = r.way === 0 || r.way === -toward;
    if (fwd && gather(w, r, X, O, CARRY, true).length) { r.dir = toward; continue }
    // Nothing to carry here: walk over empty if goods wait at the other end for this bridge.
    if (back && gather(w, r, O, X, 1, false).length) r.dir = toward;
  }
}

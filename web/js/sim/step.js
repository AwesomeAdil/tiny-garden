import { RES, NAME } from '../core/palette.js';
import { CARRY, CAPP, SPEED } from './content.js';
import { node, isl, dist } from './world.js';
import { tangled, allPairs, hops, nextHop } from './graph.js';
import { upkeep, surplus, destFor, met, rateOf, ropeSpeed } from './economy.js';

const say = (w, msg, warn) => w.events.push({ msg, warn: !!warn });

export function step(w, dt) {
  const S = w.S, hub = w.hub, ISL = w.def.isl;
  S.time += dt; w.TANG = tangled(w); allPairs(w);
  isl(w).forEach(n => {
    if (!S.found.has(n.id) && hops(w, n.id, 'planet') < Infinity) {
      S.found.add(n.id);
      say(w, 'You found ' + ISL[n.id].name + '! It makes ' + NAME[ISL[n.id].makes] + ' and needs ' + ISL[n.id].needs.map(k => NAME[k]).join(' and ') + '.');
    }
  });
  isl(w).forEach(n => {
    if (!S.found.has(n.id)) return;
    const s = ISL[n.id];
    if (n.stock[s.makes] < CAPP) { n.acc += rateOf(w, n) * dt; while (n.acc >= 1 && n.stock[s.makes] < CAPP) { n.acc--; n.stock[s.makes]++ } } else n.acc = Math.min(n.acc, 1);
    if (met(w, n)) {
      n.use += dt * .1;
      while (n.use >= 1) { s.needs.forEach(k => n.stock[k]--); n.use-- }
      if (n.level < 3) { n.grow += dt / 45; if (n.grow >= 1) { n.grow = 0; n.level++; say(w, s.name + ' grew to level ' + n.level + '.') } }
    }
  });
  S.ropes.forEach(r => {
    if (w.TANG.has(r.id)) return;
    const A = node(w, r.a), B = node(w, r.b), L = Math.max(8, dist(A, B) - 24);
    if (r.dir !== 0) {
      r.u += r.dir * dt * SPEED * ropeSpeed(w, r) / L;
      if (r.u <= 0 || r.u >= 1) {
        r.u = r.u <= 0 ? 0 : 1;
        const at = r.u === 0 ? A : B;
        r.load.forEach(x => { at.stock[x.k]++; if (at === hub) S.inLog.push([S.time, x.k]) });
        r.load = []; r.dir = 0;
      }
      return;
    }
    const at = r.u === 0 ? A : B, other = r.u === 0 ? B : A, toward = r.u === 0 ? 1 : -1;
    const pick = (X, O) => {
      for (let j = 0; j < RES.length; j++) {
        const k = RES[(r.next + j) % RES.length];
        if (surplus(w, X, k) < 1) continue;
        const d = destFor(w, X, k);
        if (!d || d === X.id) continue;
        if (nextHop(w, X.id, d) !== O.id) continue;
        r.next = (r.next + j + 1) % RES.length;
        return [k, d];
      }
      return null;
    };
    for (let i = 0; i < CARRY; i++) { const p = pick(at, other); if (!p) break; at.stock[p[0]]--; r.load.push({ k: p[0], d: p[1] }) }
    if (r.load.length) { r.dir = toward; return }
    if (pick(other, at)) r.dir = toward;
  });
  if (S.inLog.length > 400) S.inLog = S.inLog.filter(e => S.time - e[0] <= 60);
  S.upAcc += upkeep(w).all / 60 * dt;
  while (S.upAcc >= 1) {
    if (hub.stock.rock < 1) {
      if (!S.unpaid) { S.unpaid = true; say(w, 'The town square is out of Rock for upkeep. Bridges are fraying, so walkers go at half speed.', true) }
      S.upAcc = 1; break;
    }
    hub.stock.rock--; S.upAcc--;
    if (S.unpaid) { S.unpaid = false; say(w, 'Upkeep paid again. The bridges hold.') }
  }
  if (S.cable) S.cableT += dt;
}

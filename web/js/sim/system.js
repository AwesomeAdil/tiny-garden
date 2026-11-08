import { clamp } from '../core/pixel.js';
import { RES } from '../core/palette.js';
import { SYS_EXTRA } from './content.js';
import { isl } from './world.js';
import { wants } from './economy.js';
import { step } from './flow.js';
import { grow } from './grow.js';

const SC = [160, 100], EVENT_CAP = 50;

// Worlds first (in WORLD_DEFS order), then the stars that stay unreachable in v1.
export const sysPlanets = game => [
  ...game.worlds.map(w => ({ w, name: w.def.name, full: w.def.full, surfKey: w.def.surfKey, ...w.def.sys })),
  ...SYS_EXTRA.map(p => ({ w: null, ...p })),
];

export const sysPos = (p, t) => { const a = p.a + t * p.v; return [SC[0] + Math.cos(a) * p.R, SC[1] + Math.sin(a) * p.R * .5] };

export const nearStarS = (A, B) => {
  const dx = B[0] - A[0], dy = B[1] - A[1], s = clamp(((SC[0] - A[0]) * dx + (SC[1] - A[1]) * dy) / (dx * dx + dy * dy));
  return Math.hypot(A[0] + dx * s - SC[0], A[1] + dy * s - SC[1]);
};

const orbitTime = game => game.worlds[0].S.time;

// cb = {a: worldIndex, b: worldIndex, ...}; planets 0..n-1 are the worlds.
export function cableGeom(game, cb) {
  const ps = sysPlanets(game), t = orbitTime(game);
  const A = sysPos(ps[cb.a], t), B = sysPos(ps[cb.b], t), L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  return { A, B, L, blocked: nearStarS(A, B) < 15 };
}

export function wantsFrom(game, wi, k) {
  const O = game.worlds[wi];
  if (isl(O).some(n => O.S.found.has(n.id) && O.def.isl[n.id].makes === k)) return false;
  return isl(O).some(n => wants(O, n, k)) || (O.def.goal[k] || 0) > O.hub.stock[k];
}

export function stepCables(game, dt) {
  (game.cables || []).forEach(cb => {
    const g = cableGeom(game, cb);
    cb.blocked = g.blocked;
    if (g.blocked) return;
    if (cb.dir !== 0) {
      cb.u += cb.dir * dt * 7 / Math.max(10, g.L);
      if (cb.u <= 0 || cb.u >= 1) {
        cb.u = cb.u <= 0 ? 0 : 1;
        const at = game.worlds[cb.u === 0 ? cb.a : cb.b];
        cb.load.forEach(k => at.hub.stock[k]++);
        cb.load = []; cb.dir = 0;
      }
      return;
    }
    const xi = cb.u === 0 ? cb.a : cb.b, oi = cb.u === 0 ? cb.b : cb.a, toward = cb.u === 0 ? 1 : -1;
    const pick = (X, O) => {
      const ks = RES.filter(k => game.worlds[X].hub.stock[k] > 0 && wantsFrom(game, O, k));
      return game.ui.pri !== 'auto' && ks.includes(game.ui.pri) ? [game.ui.pri] : ks;
    };
    const ks = pick(xi, oi);
    if (ks.length) {
      const X = game.worlds[xi];
      for (let i = 0; i < 4; i++) { const k = ks[i % ks.length]; if (X.hub.stock[k] > 0) { X.hub.stock[k]--; cb.load.push(k) } }
      cb.dir = toward; return;
    }
    if (pick(oi, xi).length) cb.dir = toward;
  });
}

export function stepAll(game, dt) {
  game.worlds.forEach(w => {
    if (!w.started) return;
    step(w, dt);
    grow(w);
    if (w.events.length > EVENT_CAP) w.events.splice(0, w.events.length - EVENT_CAP);
  });
  stepCables(game, dt);
}

// The solar system (320x200): orbits, planets, their islands as moons, and the cables. Ported from page 38.
// Orbit time is world 0's S.time; t is wall-clock animation time. Never writes to the game.
import { TAU, P, mix } from '../core/pixel.js';
import { COL, SURF } from '../core/palette.js';
import { W, H } from '../sim/content.js';
import { isl } from '../sim/world.js';
import { sysPlanets, sysPos, cableGeom } from '../sim/system.js';
import { bg, star, planet } from './scene.js';

const SC = [160, 100], GT = game => game.worlds[0].S.time;

// A glass tube from A to B (wall + bore), drawn up to fraction `upto`.
export function tube(c, A, B, wall, bore, upto = 1) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 1) return; const ux = dx / L, uy = dy / L, px = -uy, py = ux, M = L * upto;
  for (let k = 0; k <= M; k += .5) { const x = A[0] + ux * k, y = A[1] + uy * k; for (const o of [-1.5, -1, -.5, 0, .5, 1, 1.5]) P(c, bore, x + px * o, y + py * o); for (const o of [-2.5, 2.5]) P(c, wall, x + px * o, y + py * o) }
}

// The cargo pod in a tube at s; bright when it carries something.
export function orb(c, A, B, s, col, full) { const x = Math.round(A[0] + (B[0] - A[0]) * s), y = Math.round(A[1] + (B[1] - A[1]) * s); if (full) { P(c, col, x - 1, y - 1, 3, 3); P(c, '#ffffff', x - 1, y - 1) } else { P(c, mix(col, '#14151f', .45), x - 1, y - 1, 3, 3); P(c, '#14151f', x, y) } }

// sel is the selected planet's name (game.ui.sysSel) or null.
export function drawSystem(ctx, game, t, sel) {
  const mc = ctx, T = GT(game), SYSP = sysPlanets(game); bg(mc, W, H, t, 90);
  SYSP.forEach(p => { for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; P(mc, '#2b2e42', SC[0] + Math.cos(a) * p.R, SC[1] + Math.sin(a) * p.R * .5) } });
  const back = p => Math.sin(p.a + T * p.v) < 0, drawP = p => {
    const q = sysPos(p, T), on = p.w && p.w.started; mc.globalAlpha = on ? 1 : .4; planet(mc, SURF[p.surfKey], q[0], q[1], p.r, t, (SC[0] - q[0]) / 120, (SC[1] - q[1]) / 60, .6); mc.globalAlpha = 1;
    if (on) { const w = p.w, f = isl(w).filter(n => w.S.found.has(n.id)); f.forEach((n, i) => { const a = i / Math.max(1, f.length) * TAU + t * .05, R = p.r + 5, x = q[0] + Math.cos(a) * R, y = q[1] + Math.sin(a) * R * .7; P(mc, '#6e5a55', (x + q[0]) / 2, (y + q[1]) / 2); P(mc, w.def.isl[n.id].col, x - 1, y - 1, 2, 2); if (n.level >= 2) P(mc, '#eed49f', x, y - 2) }) }
    if (sel === p.name) { for (let i = 0; i < 24; i++) { if ((i + Math.floor(t * 4)) % 4 === 0) continue; const a = i / 24 * TAU; P(mc, '#c6a0f6', q[0] + Math.cos(a) * (p.r + 9), q[1] + Math.sin(a) * (p.r + 7)) } }
  };
  // Planets on the far side of their orbit go behind the star.
  SYSP.filter(back).forEach(drawP); star(mc, SC[0], SC[1], { r: 9, core: '#fffbf0', mid: '#eed49f', edge: '#f5a97f' });
  (game.cables || []).forEach(cb => { const g = cableGeom(game, cb); tube(mc, g.A, g.B, g.blocked ? '#ed8796' : '#8aadf4', g.blocked ? '#3a2430' : '#1a1c2b'); if (!g.blocked) orb(mc, g.A, g.B, cb.u, cb.load.length ? COL[cb.load[0]] : '#8aadf4', cb.load.length > 0) });
  SYSP.filter(p => !back(p)).forEach(drawP);
}

// The planet (a sysPlanets entry) under map point p, or null.
export const sysAt = (game, p) => { let best = null, bd = 1e9; sysPlanets(game).forEach(q0 => { const q = sysPos(q0, GT(game)), d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < q0.r + 10 && d < bd) { bd = d; best = q0 } }); return best };

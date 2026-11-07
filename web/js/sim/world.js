import { TAU, rngf } from '../core/pixel.js';
import { RES } from '../core/palette.js';
import { W, H, MAXR } from './content.js';

const inv0 = () => Object.fromEntries(RES.map(k => [k, 0]));

export function layout(seed, ids, start) {
  const r = rngf(seed), C0 = [160, 100];
  for (let tries = 0; tries < 500; tries++) {
    const pos = {}; let ok = true;
    for (const k of ids) {
      let placed = false;
      for (let n = 0; n < 200 && !placed; n++) {
        const a = r() * TAU, d = k === start ? 52 + r() * 18 : 58 + r() * 85, x = C0[0] + Math.cos(a) * d, y = C0[1] + Math.sin(a) * d * .78;
        if (x < 22 || x > W - 22 || y < 26 || y > H - 18) continue;
        if (Object.values(pos).some(p => Math.hypot(p[0] - x, p[1] - y) < 46)) continue;
        pos[k] = [Math.round(x), Math.round(y)]; placed = true;
      }
      if (!placed) { ok = false; break }
    }
    if (!ok) continue;
    const all = [['planet', C0], ...Object.entries(pos)], seen = new Set(['planet']), q = ['planet'];
    while (q.length) {
      const c = q.shift(), cp = all.find(e => e[0] === c)[1];
      all.forEach(([k, p]) => { if (!seen.has(k) && Math.hypot(p[0] - cp[0], p[1] - cp[1]) <= MAXR - 8) { seen.add(k); q.push(k) } });
    }
    if (seen.size === ids.length + 1) return pos;
  }
  const pos = {};
  ids.forEach((k, i) => { const a = i / ids.length * TAU; pos[k] = [Math.round(160 + Math.cos(a) * 70), Math.round(100 + Math.sin(a) * 55)] });
  return pos;
}

export function makeWorld(def, seed) {
  const pos = layout(seed, Object.keys(def.isl), def.start);
  const w = { def, POS: pos, TANG: new Set(), HOP: {}, started: false, events: [] };
  w.S = { time: 0, nodes: [], ropes: [], tool: 'move', sel: { t: 'node', id: 'planet' }, cable: false, cableT: 0, found: new Set(['planet', def.start]), inLog: [], upAcc: 0, unpaid: false, patch: 0, survey: false, nextId: 1 };
  w.hub = { id: 'planet', kind: 'planet', x: 160, y: 100, r: 16, stock: inv0() };
  w.hub.stock.rock = 10;
  w.S.nodes.push(w.hub);
  Object.keys(pos).forEach(k => w.S.nodes.push({ id: k, kind: 'island', x: pos[k][0], y: pos[k][1], r: 12, level: 1, grow: 0, use: 0, acc: 0, stock: inv0(), seed: k.length }));
  return w;
}

export const node = (w, id) => w.S.nodes.find(n => n.id === id);
export const isl = w => w.S.nodes.filter(n => n.kind === 'island');
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function tie(w, a, b) {
  const r = { id: w.S.nextId++, a: a.id, b: b.id, len: Math.min(MAXR, dist(a, b) + 12), u: 0, dir: 0, load: [], next: 0 };
  w.S.ropes.push(r);
  return r;
}

// The system, galaxy and close-up views rendered in node (no browser), for checking the art while the app can't boot.
// Usage: node scripts/view-shots.mjs <out-dir> [seed=3] [WxH=1146x480]
// Writes system-*.png (cable, and the two worlds opposite the sun), galaxy-pan0/panN.png, close-island-home4.png, close-town.png.
// Also prints per-frame draw times and the cable's closest approach to the sun over a full orbit.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const { newGame } = await import('../web/js/sim/game.js');
const { skip } = await import('../web/js/sim/dev.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { drawSystem, sysView, sysXY, arcPath } = await import('../web/js/draw/system.js');
const { drawGalaxy, galInvalidate, discScale, NEIGHBOURS } = await import('../web/js/draw/galaxy.js');
const { islandView, planetView } = await import('../web/js/draw/closeup.js');
const { sysPlanets } = await import('../web/js/sim/system.js');
const { isl, node } = await import('../web/js/sim/world.js');
const { autoPick } = await import('../web/js/sim/dev.js');

const args = process.argv.slice(2), out = resolve(args[0] || 'shots/views'), seed = +(args[1] || 3), [W, H] = (args[2] || '1146x480').split('x').map(Number);
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 };
const chunk = (type, data) => { const len = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]) };
function png(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}


mkdirSync(out, { recursive: true });
const save = (name, c) => { const f = join(out, name + '.png'); writeFileSync(f, png(c.width, c.height, new Uint8ClampedArray(c.d.buffer, c.d.byteOffset, c.d.length))); console.log(f) };
const ms = (fn, n = 20) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(i); return Number(process.hrtime.bigint() - t0) / 1e6 / n };

const game = skip(newGame(seed)); game.cables.push({ a: 0, b: 1 });
const w0 = game.worlds[0], ps = sysPlanets(game), v = sysView(W, H);
// A moving walker on TIDE, so the glint runs.
if (!w0.S.ropes.length) w0.S.ropes.push({ id: 'x', a: 'planet', b: 'home', dir: 1, u: .5, load: [] }); else w0.S.ropes[0].dir = 1;
const T0 = w0.S.time, [p0, p1] = ps, dv = p1.v - p0.v;
const zoom = (name, c, x0, y0, w, h, z = 2) => { const o = new PixCtx(w * z, h * z); for (let y = 0; y < h * z; y++) for (let x = 0; x < w * z; x++) o.px[y * w * z + x] = c.px[(y0 + (y / z | 0)) * W + x0 + (x / z | 0)]; save(name, o) };
const sys = (name, T, t = 3) => { w0.S.time = T; const c = new PixCtx(W, H); drawSystem(c, game, t, null, W, H); save(name, c); zoom(name + '-zoom', c, Math.round(W / 2 - 250), Math.round(H / 2 - 110), 500, 220); return c };
sys('system-now', T0);
// opposite sides of the sun: angle difference = pi (mod 2pi), and the tilted-plane screen positions on either side
let To = (Math.PI - (p1.a - p0.a)) / dv; while (To < T0) To += 2 * Math.PI / Math.abs(dv);
sys('system-opposite', To);
// the closest the cable gets to the sun over one full relative orbit
let worst = 1e9; const sr = Math.max(4, Math.round(10 * v.k / 1.6));
for (let i = 0; i < 400; i++) { const T = T0 + i / 400 * 2 * Math.PI / Math.abs(dv), A = sysXY(v, p0, T), B = sysXY(v, p1, T); worst = Math.min(worst, Math.min(...arcPath(A, B, [v.cx, v.cy], sr).map(q => Math.hypot(q[0] - v.cx, q[1] - v.cy)))) }
console.log(`closest the cable gets to the sun over a full orbit: ${worst.toFixed(1)} px (sun radius ${sr}, need >= ${sr + 6})`);

// galaxy
const g0 = new PixCtx(W, H), sc = discScale(W, H), ring = NEIGHBOURS.find(n => n.kind === 'ring');
galInvalidate(g0); drawGalaxy(g0, 3, null, 3, W, H, { x: 0, y: 0 }); save('galaxy-pan0', g0);
const g1 = new PixCtx(W, H); drawGalaxy(g1, 3, null, 3, W, H, { x: -ring.dx * sc * .6, y: -ring.dy * sc * .6 }); save('galaxy-panned', g1);
const g2 = new PixCtx(W, H); drawGalaxy(g2, 3, null, 3, W, H, { x: -ring.dx * sc, y: -ring.dy * sc }); save('galaxy-ring-centred', g2);

// close-ups
const home = node(w0, 'home'); isl(w0).forEach(n => { n.stage = 4 }); autoPick(w0);
const ci = new PixCtx(W, H); islandView(ci, w0, home, 5, W, H); save('close-island-home4', ci);
const cp = new PixCtx(W, H); planetView(cp, game, w0, 5, W, H); save('close-town', cp);

// per-frame times (node, ms): warm caches first
w0.S.time = T0;
drawSystem(new PixCtx(W, H), game, 0, null, W, H); const sp = new PixCtx(W, H);
console.log('drawSystem ms/frame', ms(i => drawSystem(sp, game, i * .1, null, W, H), 60).toFixed(2));
const gp = new PixCtx(W, H);
console.log('drawGalaxy ms/frame (disc turning)', ms(i => { galInvalidate(gp); drawGalaxy(gp, i, null, i, W, H, null) }, 20).toFixed(2));
console.log('drawGalaxy ms/frame (same disc)', ms(i => { galInvalidate(gp); drawGalaxy(gp, 20, null, 20, W, H, null) }, 40).toFixed(2));
console.log('drawGalaxy ms/frame (panning)', ms(i => { drawGalaxy(gp, 20 + i, null, 20, W, H, { x: i * 5, y: 0 }) }, 40).toFixed(2));
const ip = new PixCtx(W, H); console.log('islandView ms/frame', ms(i => islandView(ip, w0, home, i * .1, W, H), 60).toFixed(2));
console.log('planetView ms/frame', ms(i => planetView(ip, game, w0, i * .1, W, H), 60).toFixed(2));

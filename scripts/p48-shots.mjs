// The fix-round renders (system, galaxy wallpaper/panned, close-ups in both styles, island depth before/after).
// Usage: node scripts/p48-shots.mjs <out-dir> [seed=3]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const { newGame } = await import('../web/js/sim/game.js');
const { skip, autoPick } = await import('../web/js/sim/dev.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { worldView } = await import('../web/js/core/pixel.js');
const { drawSystem, sysXY, sysView } = await import('../web/js/draw/system.js');
const { drawGalaxy, galPanFor, discScale, NEIGHBOURS } = await import('../web/js/draw/galaxy.js');
const { islandView, planetView, CLOSE } = await import('../web/js/draw/closeup.js');
const { islandSpec, islandSprite, skyLayer, drawSky } = await import('../web/js/draw/kit.js');
const { sysPlanets } = await import('../web/js/sim/system.js');
const { isl, node } = await import('../web/js/sim/world.js');
const out = resolve(process.argv[2] || 'shots/p48'), seed = +(process.argv[3] || 3), W = 1146, H = 480;
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
const game = skip(newGame(seed)); game.cables.push({ a: 0, b: 1 }); const w0 = game.worlds[0];
isl(w0).forEach(n => { n.stage = 4 }); autoPick(w0);
const home = node(w0, 'home');
// system, with the two worlds on opposite sides of the sun
if (!w0.S.ropes.length) w0.S.ropes.push({ id: 'x', a: 'planet', b: 'home', dir: 1, u: .5, load: [] }); else w0.S.ropes[0].dir = 1;
const [p0, p1] = sysPlanets(game); let To = (Math.PI - (p1.a - p0.a)) / (p1.v - p0.v); const T0 = w0.S.time; while (To < T0) To += 2 * Math.PI / Math.abs(p1.v - p0.v);
const T1 = w0.S.time; w0.S.time = To + .4; const sc = new PixCtx(W, H); drawSystem(sc, game, 3, null, W, H); save('system', sc); w0.S.time = T1;
// galaxy
const gw = new PixCtx(W, H); drawGalaxy(gw, 3, null, 3, W, H, galPanFor('wallpaper', game)); save('galaxy-wall', gw);
const ring = NEIGHBOURS.find(n => n.kind === 'ring'), s0 = discScale(W, H), gp = new PixCtx(W, H); drawGalaxy(gp, 3, null, 3, W, H, { x: -ring.dx * s0 * .6, y: -ring.dy * s0 * .6 }); save('galaxy-panned', gp);
// close-ups
for (const [name, style] of [['A', 'low'], ['B', 'behind']]) { CLOSE.style = style; const c = new PixCtx(W, H); islandView(c, w0, home, 5, W, H); save('close-' + name, c) }
CLOSE.style = 'low';
const ct = new PixCtx(W, H); planetView(ct, game, w0, 5, W, H); save('close-town', ct);
// island depth before / after: a near, a mid and a far island side by side at the city scale
const k = worldView(W, H).k, ids = isl(w0).slice(0, 3);
for (const [name, after] of [['before', false], ['after', true]]) {
  const c = new PixCtx(W, 260); c.putImageData(skyLayer(W, 260, 9).img, 0, 0); let x = 40;
  ['near', 'mid', 'far'].forEach((band, i) => { const sp = islandSpec(w0, ids[i], band, k), I = islandSprite(after ? sp : { ...sp, depth: Math.round(sp.hw * .85) }); x += I.w / 2; c.blit(I.px, Math.round(x - I.ox), 40 - I.oy + 36); x += I.w / 2 + 30; console.log(name, band, 'hw', sp.hw, 'depth', after ? sp.depth : Math.round(sp.hw * .85)) });
  save('islands-' + name, c);
}

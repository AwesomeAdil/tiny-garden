// The city view rendered in node (no browser), for checking the art by eye while the app can't boot.
// Usage: node scripts/city-shot.mjs <out-dir> [seed=3] [WxH,...=1146x480,756x472] [--event=whale|traveller|aurora]
//        [--t=12] [--zoom=1] [--crop=x,y,w,h] [--noskip] [--world=0] [--play] [--at=.5 (event progress)] [--stage4]
// Writes <out-dir>/city-<W>x<H>[-<event>].png, the canvas at its true size (or zoomed by whole pixels).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const { newGame } = await import('../web/js/sim/game.js');
const { skip } = await import('../web/js/sim/dev.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { worldOffset } = await import('../web/js/core/pixel.js');
const { drawCity } = await import('../web/js/draw/city.js');
const { EVENTS } = await import('../web/js/sim/events.js');
const { autoPick } = await import('../web/js/sim/dev.js');
const { isl } = await import('../web/js/sim/world.js');

const args = process.argv.slice(2), flag = k => { const a = args.find(x => x.startsWith(`--${k}`)); return a ? (a.split('=')[1] ?? true) : null }, pos = args.filter(a => !a.startsWith('--'));
const out = resolve(pos[0] || 'shots/city'), seed = +(pos[1] || 3), sizes = (pos[2] || '1146x480,756x472').split(',').map(s => s.split('x').map(Number));
const ev = flag('event'), t = +(flag('t') || 12), zoom = +(flag('zoom') || 1), wi = +(flag('world') || 0);

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
const game = flag('noskip') ? newGame(seed) : skip(newGame(seed)), w = game.worlds[wi];
if (flag('stage4')) { isl(w).forEach(n => { n.stage = 4 }); autoPick(w) }
if (ev) { const T = game.worlds[0].S.time, dur = EVENTS[ev].dur; game.ev.active = { kind: ev, t0: T - dur * +(flag('at') || .5), dur, world: 0, variant: 1 }; game.ev.caught = false } else game.ev.active = null;
for (const [W, H] of sizes) {
  const c = new PixCtx(W, H);
  drawCity(c, game, w, t, { w: W, h: H, ...worldOffset(W, H) }, flag('play') ? { drag: null, pointer: null, tool: 'move' } : null);
  const [cx, cy, cw, ch] = flag('crop') ? flag('crop').split(',').map(Number) : [0, 0, W, H];
  const OW = cw * zoom, OH = ch * zoom, img = new Uint8ClampedArray(OW * OH * 4), s32 = new Uint32Array(c.d.buffer), d32 = new Uint32Array(img.buffer);
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) d32[y * OW + x] = s32[(cy + ((y / zoom) | 0)) * W + cx + ((x / zoom) | 0)];
  const f = join(out, `city-${W}x${H}${ev ? '-' + ev : ''}${wi ? '-w' + wi : ''}${zoom > 1 ? '-z' + zoom : ''}${flag('crop') ? '-crop' : ''}.png`);
  writeFileSync(f, png(OW, OH, img)); console.log(f);
}

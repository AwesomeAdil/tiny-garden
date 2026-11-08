import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const fakeCtx = () => ({ fillStyle: '', globalAlpha: 1, fillRect() {}, putImageData() {}, drawImage() {}, translate() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) });
globalThis.document ??= { createElement: () => ({ getContext: () => fakeCtx(), toDataURL: () => 'data:' }) };

const { newGame } = await import('../web/js/sim/game.js');
const { skip } = await import('../web/js/sim/dev.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');
const { worldView } = await import('../web/js/core/pixel.js');
const { drawCity } = await import('../web/js/draw/city.js');
const { twinkle } = await import('../web/js/draw/kit.js');
const { STARS, GROUPS, PERIODS, visibleStars, starDiff, groupOf } = await import('../web/js/core/stars.js');
const { WALL_MS } = await import('../web/js/core/cadence.js');
const { dirtyBox } = await import('../web/js/core/present.js');

const W = 1146, H = 480, view = { w: W, h: H, ...worldView(W, H) };
const frame = (game, t, on) => { const c = new PixCtx(W, H); STARS.on = on; STARS.list.length = 0; try { drawCity(c, game, game.worlds[0], t, view, null) } finally { STARS.on = false } return c };

test('the wallpaper draws 6 frames a second', () => {
  assert.equal(WALL_MS, 167);
  assert.ok(1000 / WALL_MS >= 5.98);
});

test('with the stars layer on, the canvas sky no longer twinkles', () => {
  const game = skip(newGame(3));
  const a = frame(game, 10, true), list = STARS.list.slice(), b = frame(game, 11.3, true);
  assert.ok(list.length / 3 > 500, 'the city sky records its twinkling stars (' + list.length / 3 + ')');
  let drawn = 0; for (let i = 0; i < list.length; i += 3) { const s = list[i], k = s.y * W + s.x; if (a.px[k] === list[i + 1] && b.px[k] !== a.px[k]) drawn++ }
  // A star pixel changes only where something in front moved over it (a walker, a bobbing island edge).
  assert.ok(drawn <= list.length / 3 * .01, `star pixels don't twinkle in the canvas (${drawn} of ${list.length / 3} changed)`);
  // What WebKit repaints is the box around the changed pixels (core/present.js): one wallpaper frame (1/6 s) apart.
  const box = (x, y) => { const r = dirtyBox(x.px, y.px, W, H); return r ? r[2] * r[3] : 0 };
  const on = box(frame(game, 10, true), frame(game, 10 + 1 / 6, true)), off = box(frame(game, 10, false), frame(game, 10 + 1 / 6, false));
  assert.ok(on < off * .6, `a much smaller repaint per frame (${on} px with the layer, ${off} without)`);
});

test('twinkle records each star with the pixel under it and draws nothing', () => {
  const c = new PixCtx(8, 8); c.fillStyle = '#101119'; c.fillRect(0, 0, 8, 8);
  const before = c.px.slice();
  STARS.on = true; STARS.list.length = 0;
  try { twinkle(c, [{ x: 3, y: 3, f: 1, p: 1.6, big: true }, { x: 9, y: 1, f: 1, p: 0, big: false }], 0) } finally { STARS.on = false }
  assert.deepEqual(c.px, before);
  assert.equal(STARS.list.length, 3, 'the star off the canvas is skipped');
  assert.equal(STARS.list[1], before[3 * 8 + 3]);
  assert.deepEqual(STARS.list[2], [before[26], before[28], before[19], before[35]]);
});

test('covered stars are left out of the layer; a big star loses its arms when one is covered', () => {
  const w = 10, px = new Uint32Array(w * 10).fill(5);
  const big = { x: 4, y: 4, big: true }, small = { x: 7, y: 2, big: false };
  const list = [big, 5, [5, 5, 5, 5], small, 5, null];
  let v = visibleStars(list, px, w);
  assert.deepEqual([...v.keys()], [44, 27]);
  assert.equal(v.get(44).arms, true);
  px[45] = 9; v = visibleStars(list, px, w);
  assert.equal(v.get(44).arms, false, 'an island edge over the right arm');
  px[27] = 9; v = visibleStars(list, px, w);
  assert.equal(v.has(27), false, 'a walker over the small star');
  const d = starDiff(visibleStars(list, new Uint32Array(w * 10).fill(5), w), v);
  assert.deepEqual(d.del.map(s => s.x + ',' + s.y).sort(), ['4,4', '7,2']);
  assert.deepEqual(d.add.map(s => s.x + ',' + s.y + ',' + s.arms), ['4,4,false']);
});

test('stars spread over every group, and each group has a period', () => {
  const seen = new Set(); for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) seen.add(groupOf({ x, y }));
  assert.equal(seen.size, GROUPS);
  assert.equal(PERIODS.length, GROUPS);
});

test('the page has the stars container between the map and the names, and a CSS twinkle animation', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8'), css = readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="map"') < html.indexOf('id="stars"') && html.indexOf('id="stars"') < html.indexOf('id="names"'));
  assert.match(css, /@keyframes twinkle/);
  assert.match(css, /#stars canvas \{[^}]*animation-name:twinkle/);
  assert.match(css, /body:not\(\.wallpaper\) #stars \{ display:none; \}/);
});

// main.js can't be imported in node, so this checks the wiring in its source: pause() sets body.paused, resume()
// clears it, and the CSS stops the star layers' animations under it (nothing animates while the wallpaper sleeps).
test('pausing the garden pauses the star layers', () => {
  const css = readFileSync(new URL('../web/style.css', import.meta.url), 'utf8'), js = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
  assert.match(css, /body\.paused #stars canvas \{ animation-play-state:paused; \}/);
  const body = name => { const i = js.indexOf(`  ${name}() {`); assert.ok(i > 0, name); return js.slice(i, js.indexOf('\n', i)) };
  assert.match(body('pause'), /classList\.add\('paused'\)/);
  assert.match(body('resume'), /classList\.remove\('paused'\)/);
});

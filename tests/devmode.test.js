// Developer mode's sandbox (web/js/devmode.js): which messages say dev:true, and that leaving dev (or going to the
// wallpaper) gives back the real game exactly as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
const { devSession, tagDev } = await import('../web/js/devmode.js');
const { newGame, frame } = await import('../web/js/sim/game.js');
const { serialize } = await import('../web/js/sim/save.js');
const { trialLoad, prepare } = await import('../web/js/boot.js');
const { startClock, clockSavedAt } = await import('../web/js/sim/clock.js');
const { skip, devGrow, devCable } = await import('../web/js/sim/dev.js');
const { isl } = await import('../web/js/sim/world.js');
const { PixCtx } = await import('../web/js/core/pixctx.js');

const trip = o => JSON.parse(JSON.stringify(o));

// A stand-in for main.js: one live game and clock, booted the way garden.boot boots (trialLoad, prepare, a clock
// from the save's savedAt), with every message the page would send kept in `sent`.
function page({ native, game, now = 1e12 }) {
  const p = { sent: [], now, game, clock: startClock(now, now), boots: [] };
  p.snapshot = () => serialize(p.game, clockSavedAt(p.clock));
  p.dev = devSession({
    native,
    post: m => p.sent.push(trip(m)),
    snapshot: p.snapshot,
    boot: (obj, mode, opts) => p.boot(obj, mode, opts),
  });
  p.boot = (obj, mode, opts = {}) => {
    p.boots.push({ obj: obj && trip(obj), mode, opts });
    p.dev.booted(!!opts.dev);
    let g = obj != null ? trialLoad(obj, () => new PixCtx(688, 288))?.game : null;
    if (!g) { g = newGame(99); g.savedAt = p.now }
    if (opts.dev) g.savedAt = p.now; // a sandbox has no catch-up
    prepare(g, p.now); p.game = g; p.clock = startClock(p.now, g.savedAt || p.now);
    p.dev.send({ type: 'save', save: p.snapshot() }); // start() -> setMode() saves at once
  };
  p.save = () => p.dev.send({ type: 'save', save: p.snapshot() });
  return p;
}
const realGame = () => { const g = skip(newGame(7)); prepare(g, 1e12); g.savedAt = 1e12; return g };

test('tagDev marks a message only in dev mode', () => {
  assert.deepEqual(tagDev({ type: 'save', save: 1 }, false), { type: 'save', save: 1 });
  assert.deepEqual(tagDev({ type: 'save', save: 1 }, true), { type: 'save', save: 1, dev: true });
});

test('normal mode: saves and every other message carry no dev flag', () => {
  const p = page({ native: true, game: realGame() });
  p.save(); p.dev.send({ type: 'new-map' }); p.dev.send({ type: 'bad-save' }); p.dev.send({ type: 'old-save' });
  assert.equal(p.sent.length, 4);
  assert.ok(p.sent.every(m => !('dev' in m)));
});

test('entering dev (app): the real game is saved untagged, then Swift is asked; dev saves carry dev:true', () => {
  const p = page({ native: true, game: realGame() }), real = p.snapshot();
  assert.equal(p.dev.enter(), true);
  assert.deepEqual(p.sent, [{ type: 'save', save: trip(real) }, { type: 'dev', on: true }]);
  assert.equal(p.dev.on, false, 'not on until Swift boots the sandbox');
  assert.equal(p.dev.enter(), false, 'one request at a time');
  p.save(); assert.equal(p.sent.at(-1).dev, undefined, 'still the real game until the sandbox boots');
  p.boot(null, 'play', { dev: true }); // Swift: garden.boot(<save.dev.json or null>, 'play', now, {dev:true})
  assert.equal(p.dev.on, true);
  const n = p.sent.length;
  p.save(); p.dev.send({ type: 'new-map' }); p.dev.send({ type: 'bad-save' }); p.dev.send({ type: 'old-save' });
  assert.ok(p.sent.slice(n - 1).every(m => m.dev === true), 'the boot save and everything after it say dev:true');
});

test('leaving dev: the sandbox is saved with dev:true, Swift is told, then the real game boots and saves untagged', () => {
  const p = page({ native: true, game: realGame() });
  p.dev.enter(); p.boot(null, 'play', { dev: true });
  p.sent.length = 0;
  assert.equal(p.dev.leave('play'), true);
  assert.equal(p.sent[0].type, 'save'); assert.equal(p.sent[0].dev, true);
  assert.deepEqual(p.sent[1], { type: 'dev', on: false });
  assert.equal(p.sent[2].type, 'save'); assert.equal('dev' in p.sent[2], false, 'the restored real game saves to save.json');
  assert.equal(p.dev.on, false);
  p.save(); assert.equal('dev' in p.sent.at(-1), false);
  assert.equal(p.dev.leave('play'), false, 'not in dev: nothing to leave');
});

test('the real game comes back byte-identical, whatever the sandbox did; catch-up then runs its elapsed time', () => {
  const p = page({ native: false, game: realGame() });
  const before = JSON.stringify(p.snapshot());
  p.dev.enter();
  assert.equal(p.dev.on, true);
  const w = p.game.worlds[0];
  devGrow(w, isl(w)[0]); devCable(p.game, w); p.game.ui.speed = 600; // the sandbox does its worst
  p.now += 90_000; // 90 s in dev
  p.dev.leave('wallpaper');
  assert.equal(p.boots.at(-1).mode, 'wallpaper');
  assert.equal(JSON.stringify(p.snapshot()), before, 'serialized real game unchanged');
  assert.equal(p.clock.behind, 90, 'the 90 s away are caught up like any gap');
  const t0 = p.game.worlds[0].S.time;
  for (let ms = p.now; p.clock.behind > 0;) frame(p.game, p.clock, ms += 166, 'wallpaper');
  assert.ok(p.game.worlds[0].S.time - t0 >= 90, 'catch-up ran');
});

test('standalone (?dev=1): the sandbox lives in memory and comes back on the next enter', () => {
  const p = page({ native: false, game: realGame() });
  p.dev.enter();
  assert.deepEqual(p.boots.at(-1), { obj: null, mode: 'play', opts: { dev: true } }, 'first sandbox is a fresh game');
  const w = p.game.worlds[0]; devGrow(w, isl(w)[0]);
  const sand = JSON.stringify(p.snapshot());
  p.dev.leave('play');
  p.dev.enter();
  assert.equal(JSON.stringify(p.boots.at(-1).obj), sand);
  assert.equal(isl(p.game.worlds[0])[0].stage, 2);
});

test('going to the wallpaper before Swift answers cancels the request', () => {
  const p = page({ native: true, game: realGame() });
  p.dev.enter(); p.dev.cancel();
  assert.equal(p.dev.pending, false);
  assert.equal(p.dev.enter(), true, 'can ask again');
});

test('a boot without dev (a page reload, Swift booting the real game) ends dev mode', () => {
  const p = page({ native: true, game: realGame() });
  p.dev.enter(); p.boot(null, 'play', { dev: true });
  p.boot(null, 'wallpaper', {});
  assert.equal(p.dev.on, false);
  assert.equal(p.dev.leave('play'), false);
});

test('main.js sends every message through the dev session, so none can skip the tag', () => {
  const src = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.equal((src.match(/postMessage\(/g) || []).length, 1, 'one raw postMessage');
  assert.match(src, /const post = msg => dev\.send\(msg\)/);
  assert.equal((src.match(/\braw\b/g) || []).length, 2, 'the raw bridge is defined once and only handed to the dev session');
  assert.match(src, /devSession\(\{ native, post: raw,/);
});

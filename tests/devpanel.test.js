// The dev panel (web/js/ui/devpanel.js): the guard lives here, in the UI layer. devAction refuses everything unless
// developer mode is on and the page is in play mode; the sim's dev* helpers stay plain functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:,' }) };
const { devAction, DEV_SPEEDS, DEV_ACTS } = await import('../web/js/ui/devpanel.js');
const { newGame } = await import('../web/js/sim/game.js');
const { serialize } = await import('../web/js/sim/save.js');
const { isl } = await import('../web/js/sim/world.js');
const { TRAY_MAX } = await import('../web/js/sim/events.js');

const mkApp = ({ on = true, mode = 'play' } = {}) => {
  const game = newGame(3);
  return { game, mode, dev: { on }, get w() { return this.game.worlds[this.game.ui.world] } };
};
const pick = (app, i = 0) => { const n = isl(app.w)[i]; app.w.S.sel = { t: 'node', id: n.id }; return n };
const state = app => JSON.stringify(serialize(app.game, 0));

test('every action refuses, and changes nothing, when dev mode is off', () => {
  const app = mkApp({ on: false }); pick(app);
  const before = state(app);
  for (const a of DEV_ACTS) {
    const r = devAction(app, a, 600);
    assert.equal(r.ok, false, a);
    assert.match(r.msg, /developer mode is off/i);
  }
  assert.equal(state(app), before);
  assert.equal(app.game.ui.speed, 1);
});

test('every action refuses in wallpaper mode, even with dev on', () => {
  const app = mkApp({ mode: 'wallpaper' }); pick(app);
  const before = state(app);
  for (const a of DEV_ACTS) assert.equal(devAction(app, a, 60).ok, false, a);
  assert.equal(state(app), before);
});

test('no app.dev at all counts as off', () => {
  const app = mkApp(); delete app.dev; pick(app);
  assert.equal(devAction(app, 'grow').ok, false);
});

test('speed takes only x1, x60 and x600', () => {
  const app = mkApp();
  assert.deepEqual(DEV_SPEEDS, [1, 60, 600]);
  for (const s of DEV_SPEEDS) { assert.equal(devAction(app, 'speed', s).ok, true); assert.equal(app.game.ui.speed, s) }
  assert.equal(devAction(app, 'speed', 5000).ok, false);
  assert.equal(app.game.ui.speed, 600);
});

test('grow and fill act on the selected island, and need one', () => {
  const app = mkApp();
  assert.equal(devAction(app, 'grow').ok, false, 'the town is selected');
  const n = pick(app, 1);
  const r = devAction(app, 'grow');
  assert.equal(r.ok, true); assert.equal(n.stage, 2);
  assert.equal(devAction(app, 'fill').ok, true);
  assert.ok(Object.values(n.paid).some(v => v > 0));
});

test('visitors, gift, town, cable, jump and new go through', () => {
  const app = mkApp();
  assert.equal(devAction(app, 'whale').ok, true); assert.equal(app.game.ev.active.kind, 'whale');
  assert.equal(devAction(app, 'aurora').ok, false, 'one visitor at a time');
  for (let i = 0; i < TRAY_MAX; i++) assert.equal(devAction(app, 'gift').ok, true);
  const full = devAction(app, 'gift'); assert.equal(full.ok, false); assert.match(full.msg, /tray is full/i);
  assert.equal(devAction(app, 'town').ok, true); assert.equal(app.w.hub.stage, 2);
  assert.equal(devAction(app, 'cable').ok, true); assert.equal(app.game.worlds[1].started, true);
  assert.equal(devAction(app, 'jump').ok, true);
  const nw = devAction(app, 'new'); assert.equal(nw.ok, true); assert.equal(nw.ask, true, 'New sandbox asks first');
});

test('index.html has a button for every action, a DEV tag, and the strip starts hidden', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="devbar"[^>]* hidden/);
  assert.match(html, /<span id="devtag"[^>]* hidden[^>]*>DEV<\/span>/);
  for (const a of DEV_ACTS.filter(a => a !== 'speed')) assert.match(html, new RegExp(`data-dev="${a}"`), a);
  for (const s of DEV_SPEEDS) assert.match(html, new RegExp(`data-dev="speed" data-v="${s}"`));
  const css = readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
  assert.match(css, /body\.wallpaper #devtag/, 'the tag never shows on the wallpaper');
});

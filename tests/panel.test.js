import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { tie } from '../web/js/sim/world.js';
import { cost } from '../web/js/sim/flow.js';
import { CABLE_COST } from '../web/js/sim/town.js';

globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:,' }) };
const { panelHTML, commitRename } = await import('../web/js/ui/panel.js');
const { guideText, eventLine, drainEvents } = await import('../web/js/ui/guide.js');
const { wirePanel } = await import('../web/js/ui/panel.js');
const { onEsc } = await import('../web/js/ui/dock.js');
const { serialize, deserialize } = await import('../web/js/sim/save.js');
const { escAction } = await import('../web/js/ui/esc.js');

const mkApp = () => {
  const game = newGame(3);
  return { game, mode: 'play', els: { panel: { innerHTML: '' }, hint: { dataset: {}, classList: { toggle() {}, remove() {} } } }, hintUntil: 0, renaming: null, get w() { return this.game.worlds[this.game.ui.world] } };
};
const islands = w => w.S.nodes.filter(n => n.kind === 'island');
const text = h => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('island panel shows progress, not stock', () => {
  const app = mkApp(), w = app.w, n = islands(w)[0];
  const k = Object.keys(cost(w, n)).find(g => cost(w, n)[g] > 0);
  n.paid[k] = 3; n.out = { water: 9, light: 9, stone: 9 }; n.relay = [{ k, d: null }, { k, d: null }];
  w.S.sel = { t: 'node', id: n.id };
  const h = panelHTML(app);
  assert.equal(typeof h, 'string');
  assert.match(text(h), new RegExp(`3 of ${cost(w, n)[k]}`));
  assert.match(text(h), /stage 1 of 4/);
  assert.doesNotMatch(h, /\bout\b|relay/i);
  assert.doesNotMatch(text(h), /\b9\b/);
});

test('island panel lists piers used and spots to choose', () => {
  const app = mkApp(), w = app.w, n = islands(w)[0];
  w.S.sel = { t: 'node', id: n.id };
  assert.match(text(panelHTML(app)), /piers 0\/2/);
  n.stage = 3; tie(w, w.hub, n);
  const t = text(panelHTML(app));
  assert.match(t, /piers 1\/4/);
  assert.match(t, /3 spots to choose/);
});

test('rename through the panel uses cleanName', () => {
  const app = mkApp(), w = app.w, n = islands(w)[0];
  w.S.sel = { t: 'node', id: n.id }; app.renaming = n.id;
  assert.match(panelHTML(app), /<input[^>]*maxlength="10"/);
  assert.equal(commitRename(app, 'pip pin!'), true);
  assert.equal(n.name, 'PIP PIN'); assert.equal(app.renaming, null);
  assert.match(panelHTML(app), /PIP PIN/);
  app.renaming = n.id;
  assert.equal(commitRename(app, '!!!'), false);
  assert.equal(commitRename(app, 'WAY TOO LONG NAME'), false);
  assert.equal(n.name, 'PIP PIN'); assert.equal(app.renaming, n.id, 'a bad name keeps the field open');
});

test('Esc cancels an open rename field first', () => {
  assert.equal(escAction({ drag: null, card: false, sel: null, renaming: true }), 'cancel-rename');
  assert.equal(escAction({ drag: {}, card: false, sel: null, renaming: true }), 'cancel-rename');
});

test('bridge panel shows its two ends and its way', () => {
  const app = mkApp(), w = app.w, n = islands(w)[0], r = tie(w, w.hub, n);
  w.S.sel = { t: 'rope', id: r.id };
  const h = panelHTML(app);
  assert.match(text(h), /tap the bridge to change/);
  assert.match(h, /data-act="untie"/);
  const arrows = html => [...html.matchAll(/<img class="ar( l)?"/g)].map(m => m[1] ? 'L' : 'R').join('');
  assert.equal(arrows(h), 'LR', 'both ways: a left and a right arrow');
  const tI = h.search(/<b>The town<\/b>/), arI = h.search(/class="ar/), isI = h.search(new RegExp('<b>' + w.def.isl[n.id].name + '</b>'));
  assert.ok(tI >= 0 && arI >= 0 && isI >= 0 && tI < arI && arI < isI, 'town (a), arrows, island (b)');
  r.way = 1; assert.equal(arrows(panelHTML(app)), 'R', 'a to b: points right');
  r.way = -1; assert.equal(arrows(panelHTML(app)), 'L', 'b to a: points left');
  // the other way round: the bridge was tied from the island to the town, so a is the island and b the town.
  // The arrow follows the sender (a) to the receiver (b), not the layout: this test pins island first, town second.
  const g2 = newGame(3), w3 = g2.worlds[0], i3 = islands(w3)[0], r3 = tie(w3, i3, w3.hub); r3.way = 1;
  const app3 = mkApp(); app3.game = g2; w3.S.sel = { t: 'rope', id: r3.id };
  const h3 = panelHTML(app3), at = (re) => h3.search(re);
  assert.equal(arrows(h3), 'R');
  const iIdx = at(new RegExp('<b>' + w3.def.isl[i3.id].name + '</b>')), aIdx = at(/class="ar"/), tIdx = at(/<b>The town<\/b>/);
  assert.ok(iIdx >= 0 && aIdx >= 0 && tIdx >= 0, 'island, arrow and town all appear');
  assert.ok(iIdx < aIdx && aIdx < tIdx, 'island, arrow, town');
  r3.way = -1; const h4 = panelHTML(app3);
  assert.equal(arrows(h4), 'L');
});

test('town panel shows the cable only once it is open', () => {
  const app = mkApp(), w = app.w;
  w.S.sel = { t: 'node', id: 'planet' };
  assert.match(text(panelHTML(app)), /town stage 1 of 4/);
  assert.doesNotMatch(text(panelHTML(app)), /long cable/);
  w.hub.stage = 4; islands(w).forEach(n => { n.stage = 3 });
  w.hub.paid = { water: 12, light: 0, stone: 0 };
  const t = text(panelHTML(app));
  assert.match(t, /town stage 4 of 4/);
  assert.match(t, /the long cable to [A-Z]+/);
  assert.match(t, new RegExp(`12 of ${CABLE_COST}`));
});

test('guide teaches tying first, then names a stall', () => {
  const app = mkApp(), w = app.w, hub = w.hub;
  assert.match(guideText(app), /Drag from .* to an island to tie a bridge\./);
  const [a, b] = islands(w); tie(w, hub, a);
  assert.match(guideText(app), /Water, light and stone travel to islands that need them\./);
  a.paid.water = 1;
  a.stage = 2;
  assert.match(guideText(app), /grew! Click a glowing spot to choose what grows there\./);
  a.spots[1] = { pick: 'x' };
  assert.match(guideText(app), /Tap a bridge to make it one-way\./);
  app.game.ui.lessons.oneWay = true;
  b.stage = 1; // b is not tied to anything: whatever it needs and cannot reach is named
  const g = guideText(app);
  assert.match(g, /needs (water|light|stone), but nothing it can reach makes it\./);
});

test('event arrivals have a line each', () => {
  assert.equal(eventLine('whale'), 'A space whale is passing!');
  assert.match(eventLine('traveller'), /traveller/);
  assert.match(eventLine('aurora'), /aurora/i);
  assert.doesNotMatch(eventLine('comet'), /undefined/);
});

// A fake panel element that keeps its listeners, to drive the rename field's key handling.
const keyApp = () => {
  const app = mkApp(), h = {}; app.els.panel = { innerHTML: '', addEventListener: (t, f) => { h[t] = f }, querySelector: () => null };
  wirePanel(app);
  const w = app.w, n = islands(w)[0]; w.S.sel = { t: 'node', id: n.id }; app.renaming = n.id; app.tool = 'move';
  const key = (k, value = '') => { const e = { key: k, target: { id: 'rn', value }, stopped: false, stopPropagation() { this.stopped = true }, preventDefault() {} }; h.keydown(e); return e };
  return { app, n, key };
};

test('rename keystroke isolation: shortcut keys never reach the game, Enter saves, Esc cancels', () => {
  const { app, n, key } = keyApp();
  for (const k of ['m', 'r', 'c', 'n', '1', '2', '3', '4', 'Tab']) assert.equal(key(k).stopped, true, k + ' stays in the field');
  assert.equal(app.game.ui.view, 'planet'); assert.equal(app.tool, 'move'); assert.equal(app.renaming, n.id);
  assert.equal(key('Escape').stopped, false, 'Esc is left for the Esc chain');
  onEsc(app); assert.equal(app.renaming, null, 'Esc cancels'); assert.ok(!n.name);
  app.renaming = n.id;
  assert.equal(key('Enter', 'ivy 2').stopped, true);
  assert.equal(n.name, 'IVY 2'); assert.equal(app.renaming, null);
});

test('drainEvents posts a visit exactly once across many frames', () => {
  const app = mkApp(); let said = 0;
  Object.defineProperty(app.els.hint, 'innerHTML', { set() { said++ } });
  app.game.ev.active = { kind: 'whale', t0: 100, dur: 150, world: 0, variant: 0 };
  for (let i = 0; i < 200; i++) drainEvents(app);
  assert.equal(said, 1);
  app.game.ev.active = null; drainEvents(app); app.game.ev.active = { kind: 'aurora', t0: 900, dur: 180, world: 0, variant: 1 }; drainEvents(app);
  assert.equal(said, 2, 'the next visit speaks again');
});

test('the away line waits for play mode and the end of catch-up, shows once, then clears', () => {
  const app = mkApp(); let shown = [];
  Object.defineProperty(app.els.hint, 'innerHTML', { set(v) { shown.push(v) } });
  const line = 'A space whale passed by while you were away.';
  app.game.ui.away = line; app.mode = 'wallpaper';
  drainEvents(app);
  assert.equal(shown.length, 0, 'nobody reads the wallpaper'); assert.equal(app.game.ui.away, line, 'kept for later');
  app.mode = 'play'; app.catching = true; drainEvents(app);
  assert.equal(shown.length, 0, 'not while still catching up');
  app.catching = false; drainEvents(app); drainEvents(app);
  assert.equal(shown.length, 1); assert.match(shown[0], /space whale passed by while you were away/);
  assert.equal(app.game.ui.away, undefined, 'cleared once shown');
});

test('lesson 4 completes on a stage-3 island and on a one-way bridge, and survives a save', () => {
  const lesson = 'Tap a bridge to make it one-way.';
  const base = () => { const app = mkApp(), w = app.w, [a] = islands(w); const r = tie(w, w.hub, a); a.paid.water = 1; return { app, w, a, r } };
  const open = base(); assert.match(guideText(open.app), new RegExp(lesson));
  const s3 = base(); s3.a.stage = 3; s3.a.spots[0] = s3.a.spots[1] = s3.a.spots[2] = { pick: 'x' };
  assert.doesNotMatch(guideText(s3.app), new RegExp(lesson));
  assert.doesNotMatch(guideText(s3.app), /grew!/, 'every open spot is filled, so the lesson is skipped for the right reason');
  assert.match(guideText(s3.app), /needs (water|light|stone), but nothing it can reach makes it\.|^Tie bridges/, 'the line after lesson 4');
  const ow = base(); ow.r.way = 1; assert.doesNotMatch(guideText(ow.app), new RegExp(lesson));
  // done once stays done: undo the cause, round-trip a save, and it does not come back
  ow.r.way = 0;
  const back = deserialize(JSON.parse(JSON.stringify(serialize(ow.app.game, 1))));
  const app2 = mkApp(); app2.game = back;
  assert.doesNotMatch(guideText(app2), new RegExp(lesson));
  // an older save with no lessons loads with a default
  const old = JSON.parse(JSON.stringify(serialize(newGame(3), 1))); delete old.ui.lessons;
  assert.deepEqual(deserialize(old).ui.lessons, {});
});

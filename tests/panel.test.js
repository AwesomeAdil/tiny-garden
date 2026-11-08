import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { tie } from '../web/js/sim/world.js';
import { cost } from '../web/js/sim/flow.js';
import { CABLE_COST } from '../web/js/sim/town.js';

globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:,' }) };
const { panelHTML, commitRename } = await import('../web/js/ui/panel.js');
const { guideText, eventLine } = await import('../web/js/ui/guide.js');
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
  const both = h; r.way = 1; const one = panelHTML(app);
  assert.notEqual(both, one);
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
  app.tapped = true;
  b.stage = 1; // b is not tied to anything: whatever it needs and cannot reach is named
  const g = guideText(app);
  assert.match(g, /needs (water|light|stone), but nothing it can reach makes it\./);
});

test('event arrivals have a line each', () => {
  assert.equal(eventLine('whale'), 'A space whale is passing!');
  assert.match(eventLine('traveller'), /traveller/);
  assert.match(eventLine('aurora'), /aurora/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:,' }) };
const { askNewMap, confirmNewMap } = await import('../web/js/ui/dock.js');

const mkApp = () => {
  const app = { asking: false, made: 0, newMap() { this.made++ }, els: { ask: { hidden: true, querySelector: () => ({ focus() {} }) }, newbtn: { setAttribute() {} } } };
  return app;
};

test('one New-map prompt makes at most one new map, however it is confirmed', () => {
  const app = mkApp();
  askNewMap(app, true);
  confirmNewMap(app); confirmNewMap(app); // Enter's keydown, then the focused button's click
  assert.equal(app.made, 1);
  assert.equal(app.asking, false);
  assert.equal(app.els.ask.hidden, true);
});

test('a confirm with no prompt open does nothing; a new prompt arms it again', () => {
  const app = mkApp();
  confirmNewMap(app); assert.equal(app.made, 0);
  askNewMap(app, true); askNewMap(app, false); confirmNewMap(app); assert.equal(app.made, 0, 'closed prompt');
  askNewMap(app, true); confirmNewMap(app); assert.equal(app.made, 1);
});

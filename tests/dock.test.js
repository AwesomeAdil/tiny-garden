import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:,' }) };
const dock = await import('../web/js/ui/dock.js'), { askNewMap, confirmNewMap } = dock;
const { readFileSync, existsSync } = await import('node:fs');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

test('dock has no shop button', () => {
  assert.equal(dock.setShop, undefined, 'no setShop');
  assert.doesNotMatch(html, /id="shopbtn"|data-ui="shop"|>Shop</, 'no shop button in index.html');
  assert.doesNotMatch(html, /id="price"/, 'no price tag');
  assert.equal(existsSync(new URL('../web/js/ui/price.js', import.meta.url)), false, 'price.js is gone');
});

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

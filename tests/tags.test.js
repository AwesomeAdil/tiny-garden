import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';

// tags.js builds <img> icons through a canvas; a tiny stub is enough in node.
globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:,' }) };
const { renderTags, renderNames, invalidateTags } = await import('../web/js/ui/tags.js');

// A fake names canvas: records clears and its display style.
const namesCanvas = () => {
  const cv = { width: 100, height: 40, style: { display: '' }, clears: 0 };
  cv.getContext = () => ({ clearRect() { cv.clears++ }, fillRect() {}, set fillStyle(v) {} });
  return cv;
};
const mkApp = (mode = 'play') => {
  const game = newGame(3);
  const app = { game, mode, els: { tags: { dataset: {}, innerHTML: '' }, names: namesCanvas(), where: null }, art: null, nameU: 2, namesKey: '', get w() { return this.game.worlds[this.game.ui.world] } };
  return app;
};

test('leaving the city clears its tags, even after a view change invalidates the cache', () => {
  for (const v of ['galaxy', 'system', 'close']) {
    const app = mkApp();
    app.game.ui.view = 'planet'; renderTags(app);
    assert.ok(app.els.tags.innerHTML.length > 0, 'the city has tags');
    app.game.ui.view = v; invalidateTags(app); renderTags(app);
    assert.equal(app.els.tags.innerHTML, '', v + ' has no tags');
  }
});

test('city -> galaxy -> wallpaper: #tags stays empty', () => {
  const app = mkApp();
  app.game.ui.view = 'planet'; renderTags(app);
  app.game.ui.view = 'galaxy'; invalidateTags(app); renderTags(app);
  app.mode = 'wallpaper'; invalidateTags(app); renderTags(app);
  assert.equal(app.els.tags.innerHTML, '');
  // and back to the city brings them back
  app.mode = 'play'; app.game.ui.view = 'planet'; invalidateTags(app); renderTags(app);
  assert.ok(app.els.tags.innerHTML.length > 0);
});

test('a stale cache from the old empty-string invalidation still clears', () => {
  const app = mkApp();
  app.game.ui.view = 'planet'; renderTags(app);
  app.game.ui.view = 'galaxy'; app.els.tags.dataset.last = ''; renderTags(app);
  assert.equal(app.els.tags.innerHTML, '');
});

test('the names canvas is hidden and cleared in wallpaper and outside galaxy/system, whatever the cache says', () => {
  const app = mkApp('wallpaper');
  app.game.ui.view = 'galaxy';
  const cv = app.els.names; cv.style.display = ''; // as if left showing by an earlier play frame
  app.namesKey = '[]100x40'; renderNames(app); // the key an empty frame produces: caching alone would skip it
  assert.equal(cv.style.display, 'none');
  assert.ok(cv.clears > 0, 'cleared');
  for (const v of ['planet', 'close']) {
    const a = mkApp('play'); a.game.ui.view = v; a.els.names.style.display = ''; renderNames(a);
    assert.equal(a.els.names.style.display, 'none', v);
  }
});

test('city tags name every island and the town, with no bridge-slot pips', () => {
  const app = mkApp(); app.game.ui.view = 'planet';
  const w = app.w; w.S.nodes.find(n => n.kind === 'island').stage = 3;
  renderTags(app);
  const h = app.els.tags.innerHTML;
  for (const n of w.S.nodes) if (n.kind === 'island') assert.ok(h.includes(w.def.isl[n.id].name), n.id);
  assert.ok(h.includes('TOWN'));
  assert.doesNotMatch(h, /pips/);
});

test('city tags are play-mode only and follow the N toggle', () => {
  const wall = mkApp('wallpaper'); wall.game.ui.view = 'planet'; renderTags(wall);
  assert.equal(wall.els.tags.innerHTML, '', 'no tags in wallpaper mode');
  const off = mkApp('play'); off.game.ui.view = 'planet'; off.game.ui.names = false; renderTags(off);
  assert.equal(off.els.tags.innerHTML, '', 'N hides them');
  off.game.ui.names = true; invalidateTags(off); renderTags(off);
  assert.ok(off.els.tags.innerHTML.length > 0, 'and N shows them again');
});

test('one name and one gift helper: towns, renamed islands and named huts', async () => {
  const { nameOf, giftName } = await import('../web/js/ui/util.js');
  const w = newGame(3).worlds[0], n = w.S.nodes.find(q => q.kind === 'island');
  assert.equal(nameOf(w, w.hub), 'The town');
  assert.equal(nameOf(w, n), w.def.isl[n.id].name);
  n.name = 'PIPPIN'; assert.equal(nameOf(w, n), 'PIPPIN');
  assert.equal(giftName({ kind: 'hut', name: 'MIRA' }), "MIRA's hut");
  assert.equal(giftName({ kind: 'coral' }), 'Coral');
});

test('a renamed island shows its new name on its tag', () => {
  const app = mkApp(); app.game.ui.view = 'planet';
  const n = app.w.S.nodes.find(q => q.kind === 'island'); n.name = 'PIPPIN';
  renderTags(app);
  assert.ok(app.els.tags.innerHTML.includes('PIPPIN'));
});

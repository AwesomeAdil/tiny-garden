import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { skip } from '../web/js/sim/dev.js';
import { serialize } from '../web/js/sim/save.js';
import { isl } from '../web/js/sim/world.js';
import { drawMap } from '../web/js/draw/map.js';
import { drawSystem, sysAt, sysSpots } from '../web/js/draw/system.js';
import { drawGalaxy, galAt, GSYS } from '../web/js/draw/galaxy.js';
import { planetView, islandView } from '../web/js/draw/closeup.js';

// A canvas that records nothing: enough for the draw code to run in node.
const fakeCtx = () => ({ fillStyle: '', globalAlpha: 1, fills: 0, fillRect() { this.fills++ }, putImageData() { this.fills++ }, drawImage() {}, translate() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) });
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
globalThis.document ??= { createElement: () => ({ getContext: () => fakeCtx(), toDataURL: () => 'data:' }) };

test('every view draws without changing the game', () => {
  const game = skip(newGame(7)), before = JSON.stringify(serialize(game, 0));
  for (const w of game.worlds.filter(w => w.started)) {
    const c = fakeCtx();
    drawMap(c, game, w, 12, { drag: { kind: 'rope', id: 'planet' }, pointer: { x: 200, y: 60 }, tool: 'rope' });
    planetView(c, game, w, 12);
    isl(w).filter(n => w.S.found.has(n.id)).forEach(n => islandView(c, w, n, 12));
    // The close-up view, at its native size and widened.
    planetView(c, game, w, 12, 344, 144); planetView(c, game, w, 12, 378, 236);
    isl(w).filter(n => w.S.found.has(n.id)).forEach(n => { islandView(c, w, n, 12, 344, 144, 8); islandView(c, w, n, 12, 378, 236, 8) });
    assert.ok(c.fills > 0);
  }
  drawSystem(fakeCtx(), game, 12, 'TIDE'); drawSystem(fakeCtx(), game, 12, null, 504, 314);
  drawGalaxy(fakeCtx(), 12, GSYS[0].name); drawGalaxy(fakeCtx(), 12, null, 12, 688, 288);
  assert.equal(JSON.stringify(serialize(game, 0)), before);
});

test('hit tests find the planet and the home system', () => {
  const game = newGame(7);
  for (const [W, H] of [[688, 288], [504, 314]]) {
    const tide = sysSpots(game, W, H).find(s => s.p.name === 'TIDE');
    assert.equal(sysAt(game, { x: tide.x + 2, y: tide.y - 1 }, W, H).name, 'TIDE');
    assert.equal(sysAt(game, { x: 0, y: 0 }, W, H), null);
  }
  drawGalaxy(fakeCtx(), 0, null, 0, 688, 288);
  const g = GSYS[0], hit = [...Array(688 * 288).keys()].map(i => ({ x: i % 688, y: Math.floor(i / 688) })).find(p => galAt(p, 0) === g);
  assert.ok(hit, 'our system is clickable somewhere');
});

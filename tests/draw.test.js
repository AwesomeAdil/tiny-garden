import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../web/js/sim/game.js';
import { skip } from '../web/js/sim/dev.js';
import { serialize } from '../web/js/sim/save.js';
import { isl } from '../web/js/sim/world.js';
import { drawMap } from '../web/js/draw/map.js';
import { drawSystem, sysAt } from '../web/js/draw/system.js';
import { drawGalaxy, galAt, GSYS } from '../web/js/draw/galaxy.js';
import { planetView, islandView } from '../web/js/draw/closeup.js';

// A canvas that records nothing: enough for the draw code to run in node.
const fakeCtx = () => ({ fillStyle: '', globalAlpha: 1, fills: 0, fillRect() { this.fills++ }, putImageData() { this.fills++ }, drawImage() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) });
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };
globalThis.document ??= { createElement: () => ({ getContext: () => fakeCtx(), toDataURL: () => 'data:' }) };

test('every view draws without changing the game', () => {
  const game = skip(newGame(7)), before = JSON.stringify(serialize(game, 0));
  for (const w of game.worlds.filter(w => w.started)) {
    const c = fakeCtx();
    drawMap(c, game, w, 12, { drag: { kind: 'rope', id: 'planet' }, pointer: { x: 200, y: 60 }, tool: 'rope' });
    planetView(c, game, w, 12);
    isl(w).filter(n => w.S.found.has(n.id)).forEach(n => islandView(c, w, n, 12));
    assert.ok(c.fills > 0);
  }
  drawSystem(fakeCtx(), game, 12, 'TIDE');
  drawGalaxy(fakeCtx(), 12, GSYS[0].name);
  assert.equal(JSON.stringify(serialize(game, 0)), before);
});

test('hit tests find the planet and the home system', () => {
  const game = newGame(7);
  assert.equal(sysAt(game, { x: 160 + Math.cos(1.2) * 66, y: 100 + Math.sin(1.2) * 33 }).name, 'TIDE');
  assert.equal(sysAt(game, { x: 0, y: 0 }), null);
  const g = GSYS[0], hit = [...Array(320 * 200).keys()].map(i => ({ x: i % 320, y: Math.floor(i / 320) })).find(p => galAt(p, 0) === g);
  assert.ok(hit, 'our system is clickable somewhere');
});

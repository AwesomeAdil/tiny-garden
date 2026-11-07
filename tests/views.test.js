import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, closeSize, viewSize } from '../web/js/core/pixel.js';
import { VIEWS, nextView } from '../web/js/ui/esc.js';

test('galaxy and system fit the stage at an integer scale chosen from its height', () => {
  assert.deepEqual(fitSize(3440, 1440), { s: 5, w: 688, h: 288 });
  assert.deepEqual(fitSize(1512, 944), { s: 3, w: 504, h: 314 });
  assert.deepEqual(fitSize(2592, 1100), { s: 3, w: 864, h: 366 });
  assert.deepEqual(fitSize(600, 200), { s: 1, w: 600, h: 200 });
  assert.deepEqual(viewSize('galaxy', 3440, 1440), fitSize(3440, 1440));
  assert.deepEqual(viewSize('system', 3440, 1440), fitSize(3440, 1440));
});

test('the city keeps 320x200 at the largest whole scale', () => {
  assert.deepEqual(viewSize('planet', 3440, 1440), { s: 7, w: 320, h: 200 });
  assert.deepEqual(viewSize('planet', 1512, 944), { s: 4, w: 320, h: 200 });
  assert.deepEqual(viewSize('planet', 100, 100), { s: 1, w: 320, h: 200 });
});

test('the close-up is 344x144 at the largest whole scale, widened to cover any margin', () => {
  assert.deepEqual(closeSize(3440, 1440), { s: 10, w: 344, h: 144 });
  assert.deepEqual(closeSize(1512, 944), { s: 4, w: 378, h: 236 });
  assert.deepEqual(viewSize('close', 3440, 1440), closeSize(3440, 1440));
  const c = closeSize(200, 100);
  assert.equal(c.s, 1); assert.ok(c.w >= 344 && c.h >= 144);
});

test('Tab cycles city, system, galaxy, close and back', () => {
  assert.deepEqual(VIEWS, ['planet', 'system', 'galaxy', 'close']);
  assert.equal(nextView('planet'), 'system');
  assert.equal(nextView('system'), 'galaxy');
  assert.equal(nextView('galaxy'), 'close');
  assert.equal(nextView('close'), 'planet');
  assert.equal(nextView('nonsense'), 'planet');
});

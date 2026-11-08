// Developer mode's x60 and x600: a play frame runs at most MAX_STEPS sub-steps, and what it couldn't run is carried
// to the next frames (bounded), so x600 stays responsive however long a frame takes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, frame, MAX_STEPS, STEP } from '../web/js/sim/game.js';
import { startClock } from '../web/js/sim/clock.js';

const T = g => g.worlds[0].S.time;
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('x600 at 60 fps runs 9.6 s of sim a 16 ms frame, within the step cap', () => {
  const g = newGame(3); g.ui.speed = 600;
  const c = startClock(1e12, 1e12);
  frame(g, c, 1e12 + 16, 'play');
  assert.ok(near(T(g), 9.6), `ran ${T(g)}`);
  assert.ok(10 / STEP <= MAX_STEPS);
  assert.equal(c.carry || 0, 0);
});

test('a slow frame at x600 runs MAX_STEPS sub-steps and carries a bounded remainder', () => {
  const g = newGame(3); g.ui.speed = 600;
  const c = startClock(1e12, 1e12), cap = MAX_STEPS * STEP;
  frame(g, c, 1e12 + 500, 'play'); // wants 300 s of sim
  assert.ok(near(T(g), cap), `first frame ran ${T(g)}`);
  assert.ok(c.carry > 0 && c.carry <= cap + 1e-9, `carry ${c.carry}`);
  const before = T(g), carry = c.carry;
  frame(g, c, 1e12 + 500 + 1, 'play'); // a 1 ms frame: 0.6 s live plus the carry
  assert.ok(near(T(g) - before, Math.min(cap, carry + .6)), 'the carry runs next');
});

test('the carry never builds up past one frame of steps', () => {
  const g = newGame(3); g.ui.speed = 600;
  const c = startClock(1e12, 1e12);
  let ms = 1e12;
  for (let i = 0; i < 50; i++) { ms += 900; frame(g, c, ms, 'play') }
  assert.ok(c.carry <= MAX_STEPS * STEP + 1e-9);
  assert.ok(near(T(g), 50 * MAX_STEPS * STEP));
});

test('wallpaper drops any carry and ignores speed', () => {
  const g = newGame(3); g.ui.speed = 600;
  const c = startClock(1e12, 1e12);
  frame(g, c, 1e12 + 500, 'play');
  const t = T(g);
  frame(g, c, 1e12 + 600, 'wallpaper');
  assert.ok(near(T(g) - t, .1), 'only the live 0.1 s');
  assert.equal(c.carry, 0);
});

test('x1 play is unchanged', () => {
  const g = newGame(3);
  const c = startClock(1e12, 1e12);
  frame(g, c, 1e12 + 700, 'play');
  assert.ok(near(T(g), .7));
});

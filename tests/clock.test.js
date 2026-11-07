import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_GAP, CHUNK, startClock, clockStep, clockSavedAt } from '../web/js/sim/clock.js';

const H = 3600e3;

test('a short frame advances live; the save is current as of the last tick', () => {
  const c = startClock(1000, 1000);
  assert.equal(c.behind, 0);
  assert.deepEqual(clockStep(c, 1250), { live: .25, chunk: 0 });
  assert.equal(clockSavedAt(c), 1250);
});

test('a save while paused claims only the time the sim has run, not now', () => {
  const c = startClock(0, 0);
  clockStep(c, 500);
  // paused: no ticks run for an hour, then the app quits and saves
  assert.equal(clockSavedAt(c), 500);
  // the next launch (or resume) sees the whole hour as a gap
  const back = startClock(500 + H, clockSavedAt(c));
  assert.equal(back.behind, 3600);
});

test('resuming after a pause turns the gap into catch-up, in chunks of at most 1800 s', () => {
  const c = startClock(0, 0);
  clockStep(c, 2 * H);
  let r = { chunk: 0 }, total = 0, frames = 0;
  // first frame after the gap already took one chunk
  total += CHUNK; frames++;
  assert.equal(c.behind, 7200 - CHUNK);
  assert.equal(clockSavedAt(c), 2 * H - c.behind * 1000);
  let t = 2 * H;
  while (c.behind > 0) { t += 100; r = clockStep(c, t); assert.ok(r.chunk <= CHUNK); total += r.chunk; frames++ }
  assert.equal(frames, 4);
  assert.ok(Math.abs(total - 7200) < 1e-6);
  assert.equal(clockSavedAt(c), t);
});

test('any gap is capped at 12 h, on boot and while running', () => {
  assert.equal(startClock(5 * 24 * H, 0).behind, MAX_GAP);
  const c = startClock(0, 0);
  clockStep(c, 30 * H);
  assert.equal(c.behind + CHUNK, MAX_GAP);
  assert.ok(clockSavedAt(c) >= 30 * H - MAX_GAP * 1000);
});

test('a backwards clock counts as no time, never negative', () => {
  assert.equal(startClock(1000, 5000).behind, 0);
  const c = startClock(10000, 10000);
  assert.deepEqual(clockStep(c, 4000), { live: 0, chunk: 0 });
  assert.equal(c.behind, 0);
  assert.deepEqual(clockStep(c, 4500), { live: .5, chunk: 0 });
});

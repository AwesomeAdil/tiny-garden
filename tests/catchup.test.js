// The app's catch-up path, driven frame by frame exactly as main.js tick() drives it (startClock + frame).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, advance, frame } from '../web/js/sim/game.js';
import { startClock, MAX_GAP } from '../web/js/sim/clock.js';
import { stepEvents, TRAY_MAX } from '../web/js/sim/events.js';
import { serialize, deserialize } from '../web/js/sim/save.js';

const W0 = g => g.worlds[0];
const FRAME = 166; // the wallpaper's 6 fps
const AWAY = /while you were away\.( The tray was full\.)?$/;

// Boot a game saved `gapS` ago and run frames until the clock has caught up. Returns the frames it took.
function wake(g, gapS, mode = 'wallpaper') {
  const now0 = 1e12; g.savedAt = now0;
  const c = startClock(now0 + gapS * 1000, now0);
  let ms = c.lastMs, frames = 0;
  while (c.behind > 0) { ms += FRAME; frame(g, c, ms, mode); frames++ }
  return { c, ms, frames };
}

test('a 12 h gap caught up frame by frame leaves at most one gift and stores the away line', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const g = newGame(seed); g.ev.nextAt = 100; // an event is due at once, and more fall due inside the 12 h
    const { c, ms, frames } = wake(g, 12 * 3600);
    assert.ok(frames > 1, 'the catch-up spans several frames');
    assert.ok(Math.abs(W0(g).S.time - MAX_GAP - frames * FRAME / 1000) < 1e-3, `seed ${seed}: caught up 12 h (plus the frames it took)`);
    assert.equal(g.gifts.length, 1, `seed ${seed}: one gift`);
    assert.match(g.ui.away, AWAY, `seed ${seed}: away line stored`);
    assert.doesNotMatch(g.ui.away, /tray was full/);
    assert.equal(g.ev.caught, false, 'catch-up ended');
    // Normal events resume: the next one plays out live and leaves its gift.
    g.ev.nextAt = W0(g).S.time + 1;
    let t = ms;
    for (let i = 0; i < 2000 && g.gifts.length < 2; i++) { t += FRAME; frame(g, c, t, 'wallpaper'); }
    assert.equal(g.gifts.length, 2, `seed ${seed}: the next live visit leaves a gift`);
  }
});

test('catch-up with a full tray says so instead of implying a gift', () => {
  const g = newGame(4); g.ev.nextAt = 100;
  for (let i = 0; i < TRAY_MAX; i++) g.gifts.push({ id: 100 + i, kind: 'coral', variant: 0 });
  wake(g, 3600);
  assert.equal(g.gifts.length, TRAY_MAX);
  assert.match(g.ui.away, /while you were away\. The tray was full\.$/);
});

test('an event left active by a mid-event save is the one catch-up event', () => {
  const g = newGame(5), w = W0(g);
  w.S.time = g.ev.nextAt; stepEvents(g, .1);
  assert.ok(g.ev.active);
  g.ev.nextAt = w.S.time + 10;
  const back = deserialize(JSON.parse(JSON.stringify(serialize(g, 1))));
  wake(back, 12 * 3600);
  assert.equal(back.gifts.length, 1);
  assert.equal(back.ev.active, null);
  assert.match(back.ui.away, AWAY);
});

test('a catch-up cut short by a save and resumed after a relaunch still gives one gift', () => {
  const g = newGame(6); g.ev.nextAt = 100;
  const now0 = 1e12; g.savedAt = now0;
  const c = startClock(now0 + 12 * 3600e3, now0);
  let ms = c.lastMs;
  for (let i = 0; i < 4; i++) { ms += FRAME; frame(g, c, ms, 'wallpaper') }
  assert.ok(c.behind > 0 && g.gifts.length === 1);
  const back = deserialize(JSON.parse(JSON.stringify(serialize(g, ms - c.behind * 1000))));
  const c2 = startClock(ms, back.savedAt);
  while (c2.behind > 0) { ms += FRAME; frame(back, c2, ms, 'wallpaper') }
  assert.equal(back.gifts.length, 1);
  assert.equal(back.ev.caught, false);
});

test('a save left mid-catch-up with no gap to run still ends the catch-up', () => {
  const g = newGame(7); g.ev.caught = true;
  const c = startClock(1e12, 1e12);
  frame(g, c, 1e12 + FRAME, 'wallpaper');
  assert.equal(g.ev.caught, false);
});

test('the away line survives a save; junk is dropped on load', () => {
  const g = newGame(3); g.ui.away = 'A traveller passed by while you were away.';
  const o = JSON.parse(JSON.stringify(serialize(g, 1)));
  assert.equal(deserialize(o).ui.away, g.ui.away);
  o.ui.away = 7;
  assert.equal(deserialize(o).ui.away, undefined);
});

test('live play during a catch-up does not start a visit of its own', () => {
  const g = newGame(8);
  const now0 = 1e12; g.savedAt = now0;
  const c = startClock(now0 + 3600e3, now0);
  let ms = c.lastMs; g.ev.caught = true; g.ev.nextAt = 1e9;
  // a play frame mid-catch-up whose live step crosses nextAt
  ms += FRAME; frame(g, c, ms, 'play');
  g.ev.nextAt = W0(g).S.time + .01; ms += FRAME; frame(g, c, ms, 'play');
  assert.equal(g.ev.active, null);
});

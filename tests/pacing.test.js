import test from 'node:test';
import assert from 'node:assert/strict';
import { isl } from '../web/js/sim/world.js';
import { stepAll } from '../web/js/sim/system.js';
import { autoNet, autoPick } from '../web/js/sim/dev.js';
import { freshGame } from './helpers.js';

// 16 h of sim time a day: 3 days = 172 800 s, 5 days = 288 000 s.
const CABLE_MIN = 172800, CABLE_MAX = 288000, FIRST_MAX = 300;

for (const seed of [1, 2, 3]) {
  test(`pacing: seed ${seed} stages up fast and lays the cable in 3-5 days`, () => {
    const t0 = Date.now();
    const g = freshGame(seed), w = g.worlds[0];
    autoNet(w);
    let first = null;
    const before = w.S.time;
    stepAll(g, 1);
    assert.equal(w.S.time - before, 1, 'S.time advances by exactly 1 per stepAll(g, 1)');
    for (let s = 1; s <= CABLE_MAX + 1000 && !w.S.cable; s++) {
      if (s % 60 === 0) autoPick(w);
      stepAll(g, 1);
      if (first === null && isl(w).some(n => n.stage >= 2)) first = w.S.time;
    }
    console.log(`seed ${seed}: first stage-up ${first} s, cable ${w.S.cable ? w.S.time : 'never'} s, ${Date.now() - t0} ms wall`);
    assert.ok(Date.now() - t0 < 60000, `took ${Date.now() - t0} ms`);
    assert.ok(first !== null && first <= FIRST_MAX, `first stage-up at ${first}`);
    assert.ok(w.S.cable, 'cable never laid');
    assert.ok(w.S.time >= CABLE_MIN && w.S.time <= CABLE_MAX, `cable at ${w.S.time}`);
  });
}

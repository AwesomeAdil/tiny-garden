import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4) } };

const { PixCtx } = await import('../web/js/core/pixctx.js');
const { STY, PROPS, islandSprite, islandKey, getSprite, drawIsland, skyLayer, SPRITES, homeProp, typeStyle } = await import('../web/js/draw/kit.js');
const { ISL_LAVA } = await import('../web/js/sim/content.js');
const { DEF_OCEAN } = await import('../web/js/sim/content.js');
const { PIER_PICKS, MID_PICKS, GIFTS } = await import('../web/js/sim/picks.js');
const { makeWorld, node, tie } = await import('../web/js/sim/world.js');

const hash = px => createHash('sha1').update(px.d).digest('hex');
const spec = (o = {}) => ({ type: 'home', seed: 3, stage: 4, picks: [{ spot: 0, prop: 'pond' }, { spot: 1, prop: 'house' }, { spot: 2, prop: 'lamp' }, { spot: 3, prop: 'tree' }], gifts: [{ spot: 4, kind: 'coral', variant: 1 }], falls: [-1], ...o });

test('the same spec draws the same pixels', () => {
  const a = islandSprite(spec()), b = islandSprite(spec());
  assert.ok(a.px instanceof PixCtx);
  assert.equal(a.w, a.px.width); assert.equal(a.h, a.px.height);
  assert.ok(Buffer.from(a.px.d).equals(Buffer.from(b.px.d)));
  const c1 = new PixCtx(120, 90), c2 = new PixCtx(120, 90);
  drawIsland(c1, a, 60, 40, 2.5); drawIsland(c2, b, 60, 40, 2.5);
  assert.equal(hash(c1), hash(c2));
});

test('different seeds or picks give different islands', () => {
  const seen = new Set();
  for (let s = 1; s <= 20; s++) seen.add(hash(islandSprite(spec({ seed: s })).px));
  assert.equal(seen.size, 20);
  const base = hash(islandSprite(spec()).px);
  assert.notEqual(hash(islandSprite(spec({ picks: [{ spot: 1, prop: 'pine' }] })).px), base);
});

test('islandKey ignores time and walkers, changes with picks', () => {
  const w = makeWorld(DEF_OCEAN, 5), home = node(w, 'home'), frost = node(w, 'frost');
  const r = tie(w, frost, home);
  const k0 = islandKey(w, home, 'near');
  w.S.time = 999; r.u = .5; r.dir = 1; r.load = [{ k: 'water' }];
  assert.equal(islandKey(w, home, 'near'), k0);
  home.spots[1] = { pick: 'cottage' };
  const k1 = islandKey(w, home, 'near');
  assert.notEqual(k1, k0);
  assert.notEqual(islandKey(w, home, 'far'), k1);
  home.stage = 2;
  assert.notEqual(islandKey(w, home, 'near'), k1);
});

test('a stage-1 sprite has no grass colours', () => {
  const B = STY.book, greens = new Set([B.top, B.topL, B.topD, B.root, ...B.leaf].map(h => h.toLowerCase()));
  for (const type of Object.keys(DEF_OCEAN.isl)) {
    const { px } = islandSprite({ type, seed: 7, stage: 1, picks: [], gifts: [], falls: [] });
    for (let i = 0; i < px.d.length; i += 4) {
      if (!px.d[i + 3]) continue;
      const h = '#' + [0, 1, 2].map(k => px.d[i + k].toString(16).padStart(2, '0')).join('');
      assert.ok(!greens.has(h), `${type} stage 1 has grass colour ${h}`);
    }
  }
  // stage 2 does grow grass
  const { px } = islandSprite({ type: 'home', seed: 7, stage: 2, picks: [], gifts: [], falls: [] });
  let g = 0; for (let i = 0; i < px.d.length; i += 4) if (px.d[i + 3] && px.d[i] === 0xa6 && px.d[i + 1] === 0xda && px.d[i + 2] === 0x95) g++;
  assert.ok(g > 10);
});

test('sprite cache holds at most 64', () => {
  const w = makeWorld(DEF_OCEAN, 5), home = node(w, 'home');
  for (let s = 1; s <= 100; s++) { home.seed = s; getSprite(w, home, 'near') }
  assert.ok(SPRITES.size <= 64);
  home.seed = 100;
  assert.equal(getSprite(w, home, 'near'), getSprite(w, home, 'near'));
});

test('every pick prop and gift kind has a drawable', () => {
  const props = [...Object.values(PIER_PICKS), ...Object.values(MID_PICKS)].flat().map(p => p.prop);
  for (const k of [...props, ...Object.keys(GIFTS)]) assert.ok(PROPS[k] && (PROPS[k].s || PROPS[k].a), k);
  for (const k of Object.keys(PROPS)) {
    const s = islandSprite({ type: 'home', seed: 2, stage: 3, picks: [{ spot: 1, prop: k }], gifts: [], falls: [] });
    const c = new PixCtx(s.w, s.h, { transparent: true }), bare = new PixCtx(s.w, s.h, { transparent: true });
    drawIsland(c, s, s.ox, s.oy, 1.3); drawIsland(bare, islandSprite({ type: 'home', seed: 2, stage: 3, picks: [], gifts: [], falls: [] }), s.ox, s.oy, 1.3);
    assert.notEqual(hash(c), hash(bare), k);
  }
});

test('a waterfall pick or water arriving at a pier adds a fall on that side', () => {
  const w = makeWorld(DEF_OCEAN, 5), home = node(w, 'home'), frost = node(w, 'frost');
  home.stage = 3;
  const k0 = islandKey(w, home, 'near');
  tie(w, frost, home); // frost makes water and sends it into home
  assert.notEqual(islandKey(w, home, 'near'), k0);
  assert.match(islandKey(w, home, 'near'), /falls:-?1/);
});

test('PixCtx: transparent start, proper over, and blit', () => {
  const t = new PixCtx(4, 4, { transparent: true });
  assert.ok(t.d.every(v => v === 0));
  t.globalAlpha = .5; t.fillStyle = '#ff0000'; t.fillRect(0, 0, 1, 1); t.globalAlpha = 1;
  assert.deepEqual([...t.d.slice(0, 4)], [255, 0, 0, 128]);
  t.fillStyle = '#00ff00'; t.fillRect(1, 0, 1, 1);
  const o = new PixCtx(4, 4); o.fillStyle = '#0000ff'; o.fillRect(0, 0, 4, 4);
  o.blit(t, 0, 0);
  assert.deepEqual([...o.d.slice(0, 4)], [128, 0, 127, 255]); // half red over blue
  assert.deepEqual([...o.d.slice(4, 8)], [0, 255, 0, 255]);
  assert.deepEqual([...o.d.slice(8, 12)], [0, 0, 255, 255]); // transparent skipped
});

test('skyLayer is cached and has soft stardust', () => {
  const a = skyLayer(160, 90, 7), b = skyLayer(160, 90, 7);
  assert.equal(a, b);
  assert.ok(a.img && a.tw.length > 0);
  const c = new PixCtx(160, 90); c.putImageData(a.img, 0, 0);
  assert.equal(c.d[3], 255);
  // the gradient has 4 colours and the fixed stars 2; stardust adds faint tints, none far from the sky's own colours
  const base = ['#101119', '#141622', '#181a2a', '#1c1f33', '#2a2d42', '#3b3f55'].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const cols = new Set();
  for (let i = 0; i < a.img.data.length; i += 4) {
    const p = [a.img.data[i], a.img.data[i + 1], a.img.data[i + 2]]; cols.add(p.join());
    assert.ok(base.some(b => b.every((v, k) => Math.abs(v - p[k]) <= 16)), `pixel ${p} is not a soft tint`);
  }
  assert.ok(cols.size > 6, `only ${cols.size} sky colours: no stardust`);
});

// The centrepiece region: the columns around the home prop, above the top's tufts (rows < oy - 3).
const centre = (sp, type, seed) => { const p = homeProp(type, seed, sp.hw), x0 = sp.ox + p.x - 9, h = createHash('sha1');
  for (let y = 0; y < sp.oy - 3; y++) h.update(sp.px.d.subarray((y * sp.w + x0) * 4, (y * sp.w + x0 + 19) * 4)); return h.digest('hex') };
const TYPES = { ...DEF_OCEAN.isl, ...ISL_LAVA };

test('same type and stage, different seeds: the centrepiece itself differs', () => {
  for (const type of Object.keys(TYPES)) {
    const seen = new Set();
    for (let s = 1; s <= 6; s++) seen.add(centre(islandSprite({ type, seed: s, stage: 3, picks: [], gifts: [], falls: [] }), type, s));
    assert.ok(seen.size >= 3, `${type}: only ${seen.size} centrepieces in 6 seeds`);
  }
  // and the types' centrepieces are different drawables
  const k = t => homeProp(t, 1, 22).k;
  assert.deepEqual([k('home'), k('anvil'), k('kiln'), k('ember'), k('cinder'), k('verdant'), k('frost'), k('amethyst')], ['house', 'forge', 'forge', 'emberTree', 'emberTree', 'grove', 'pine', 'crystal']);
});

test('nothing paints over the home prop at stage 3 or 4, even with picks and a gift beside it', () => {
  for (const type of Object.keys(TYPES)) for (const seed of [1, 2, 3]) for (const stage of [3, 4]) {
    const sp = islandSprite({ type, seed, stage, picks: [{ spot: 1, prop: 'tree' }, { spot: 3, prop: 'house' }], gifts: stage === 4 ? [{ spot: 4, kind: 'hut', variant: 0 }] : [], falls: [] }), p = homeProp(type, seed, sp.hw);
    const alone = new PixCtx(sp.w, sp.h, { transparent: true });
    PROPS[p.k].s(alone, sp.ox + p.x, sp.oy - 1, typeStyle(type), p);
    let n = 0;
    for (let i = 0; i < alone.d.length; i += 4) if (alone.d[i + 3]) { n++; assert.deepEqual([...sp.px.d.subarray(i, i + 4)], [...alone.d.subarray(i, i + 4)], `${type} seed ${seed} stage ${stage}`) }
    assert.ok(n > 10);
  }
});

test('getSprite skips the spec rebuild when nothing about the island changed', async () => {
  const { SPEC_STATS } = await import('../web/js/draw/kit.js');
  const w = makeWorld(DEF_OCEAN, 5), home = node(w, 'home'), frost = node(w, 'frost');
  home.stage = 3; tie(w, frost, home);
  const s0 = getSprite(w, home, 'near'), b0 = SPEC_STATS.builds;
  for (let i = 0; i < 50; i++) { w.S.time += .1; w.S.ropes[0].u = i / 50; assert.equal(getSprite(w, home, 'near'), s0) }
  assert.equal(SPEC_STATS.builds, b0, 'a frame with no change rebuilt the spec');
  // each thing the key depends on still re-keys it
  const bump = (f, why) => { const b = SPEC_STATS.builds; f(); const s = getSprite(w, home, 'near'); assert.equal(SPEC_STATS.builds, b + 1, why); assert.equal(islandKey(w, home, 'near'), [...SPRITES.entries()].find(e => e[1] === s)[0], why) };
  bump(() => { home.spots[1] = { pick: 'cottage' } }, 'pick');
  bump(() => { home.stage = 4 }, 'stage');
  bump(() => { home.gifts.push({ id: 1, kind: 'coral', variant: 0 }); home.spots[4] = { gift: home.gifts[0] } }, 'gift');
  bump(() => { w.S.ropes[0].way = 1 }, 'rope way');
  bump(() => { frost.x = home.x + (frost.x < home.x ? 60 : -60) }, 'the far end moved across');
  bump(() => { home.x += 3 }, 'moved');
  bump(() => { frost.sends = 'light' }, 'far end sends more');
  const b = SPEC_STATS.builds; getSprite(w, home, 'far'); getSprite(w, home, 'near'); getSprite(w, home, 'far');
  assert.equal(SPEC_STATS.builds, b + 1, 'each band keeps its own memo');
});

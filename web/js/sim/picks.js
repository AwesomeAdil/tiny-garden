// Spots on an island and what can grow on them. DOM-free content.
// opensAt: the stage at which the spot opens. side: -1 left rim, 0 middle, +1 right rim. Spot 4 is gift-only.
export const SPOTS = [
  { i: 0, side: -1, opensAt: 3 },
  { i: 1, side: 0, opensAt: 2 },
  { i: 2, side: 1, opensAt: 3 },
  { i: 3, side: 0, opensAt: 4 },
  { i: 4, side: 0, opensAt: 4 },
];

// A pick with `sends` makes the island send that good as well (at most one per island).
export const PIER_PICKS = {
  water: [
    { id: 'pond', name: 'POND', prop: 'pond' },
    { id: 'reeds', name: 'REEDS', prop: 'reeds' },
    { id: 'waterfall', name: 'WATERFALL', prop: 'waterfall', sends: 'water' },
  ],
  light: [
    { id: 'lanterns', name: 'LANTERNS', prop: 'lamp' },
    { id: 'crystal', name: 'CRYSTAL', prop: 'crystal' },
    { id: 'lanternGrove', name: 'LANTERN GROVE', prop: 'lamp', sends: 'light' },
  ],
  stone: [
    { id: 'stair', name: 'STAIR', prop: 'stair' },
    { id: 'cairn', name: 'CAIRN', prop: 'cairn' },
    { id: 'quarry', name: 'QUARRY', prop: 'quarry', sends: 'stone' },
  ],
};

const p = (id, name, prop) => ({ id, name, prop });
export const MID_PICKS = {
  home: [p('cottage', 'COTTAGE', 'house'), p('appleTree', 'APPLE TREE', 'tree'), p('vegPatch', 'VEG PATCH', 'tuft'), p('orchard', 'ORCHARD', 'tree'), p('fence', 'FENCE', 'fence')],
  ember: [p('emberTree', 'EMBER TREE', 'tree'), p('sparkVent', 'SPARK VENT', 'spire'), p('glowStones', 'GLOW STONES', 'stone'), p('campfire', 'CAMPFIRE', 'lamp'), p('cinderHut', 'CINDER HUT', 'hut')],
  frost: [p('pineStand', 'PINE STAND', 'pine'), p('iceHut', 'ICE HUT', 'hut'), p('snowGarden', 'SNOW GARDEN', 'tuft'), p('frostWillow', 'FROST WILLOW', 'willow'), p('iceSpire', 'ICE SPIRE', 'spire')],
  amethyst: [p('geode', 'GEODE', 'crystal'), p('crystalSpire', 'CRYSTAL SPIRE', 'spire'), p('violetBloom', 'VIOLET BLOOM', 'flowers'), p('shardGarden', 'SHARD GARDEN', 'crystal'), p('gemHut', 'GEM HUT', 'hut')],
  verdant: [p('meadowFlowers', 'MEADOW FLOWERS', 'flowers'), p('willow', 'WILLOW', 'willow'), p('grove', 'GROVE', 'tree'), p('hayHut', 'HAY HUT', 'hut'), p('tallGrass', 'TALL GRASS', 'tuft')],
  anvil: [p('forge', 'FORGE', 'hut'), p('anvilBlock', 'ANVIL BLOCK', 'stone'), p('chimney', 'CHIMNEY', 'spire'), p('woodPile', 'WOOD PILE', 'fence'), p('banner', 'BANNER', 'banner')],
  ash: [p('ashHouse', 'ASH HOUSE', 'house'), p('deadTree', 'DEAD TREE', 'tree'), p('ashTuft', 'ASH TUFT', 'tuft'), p('grayFence', 'GRAY FENCE', 'fence'), p('ashCairn', 'ASH CAIRN', 'cairn')],
  cinder: [p('cinderTree', 'CINDER TREE', 'tree'), p('fireVent', 'FIRE VENT', 'spire'), p('emberPatch', 'EMBER PATCH', 'tuft'), p('lavaLamp', 'LAVA LAMP', 'lamp'), p('scorchBanner', 'SCORCH BANNER', 'banner')],
  geyser: [p('steamVent', 'STEAM VENT', 'spire'), p('hotPool', 'HOT POOL', 'pond'), p('mistReeds', 'MIST REEDS', 'reeds'), p('teaHut', 'TEA HUT', 'hut'), p('mineralTuft', 'MINERAL TUFT', 'tuft')],
  obsidian: [p('glassShard', 'GLASS SHARD', 'crystal'), p('blackSpire', 'BLACK SPIRE', 'spire'), p('nightFlowers', 'NIGHT FLOWERS', 'flowers'), p('obsHut', 'OBSIDIAN HUT', 'hut'), p('darkBanner', 'DARK BANNER', 'banner')],
  kiln: [p('kilnHut', 'KILN HUT', 'hut'), p('clayStack', 'CLAY STACK', 'stone'), p('smokeStack', 'SMOKE STACK', 'spire'), p('brickFence', 'BRICK FENCE', 'fence'), p('coalLamp', 'COAL LAMP', 'lamp')],
};

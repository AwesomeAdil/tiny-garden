// Game content as data. DOM-free. Add planets, islands, goals and stars here.
export const W = 640, H = 300;
export const CARRY = 3, MAXR = 170, SPEED = 24, OUTBOX = 6, MOVEPX = 12;
export const TOWN = { x: 320, y: 240, r: 22 }; // the planet's top: the bottom fifth of the world is TIDE
// The horizon layout (page 45 lay-h): islands float in three depth bands above the town. y ranges per band,
// and each band's island half-width in world units (at full stage; the city scales it by the view).
export const BAND_Y = { far: [40, 80], mid: [95, 135], near: [150, 185] };
export const ISLAND_HW = { far: 26, mid: 34, near: 50 };
export const RATE = 1 / 25; // goods per second, per good an island makes
export const STAGE_COST = [0, 4, 300, 1500]; // per needed good, stage i -> i+1 (Task 7 tunes)

// makes: the one good the type produces (stone | light | water). flavour is descriptive; rock is the 3-colour rock body.
export const ISL_OCEAN={
 home:{name:'HOME',makes:'stone',flavour:'garden',col:'#a6da95',top:'#5f9a68',leaf:['#a6da95','#6f9e6a','#3f6a48'],rock:['#a98a7c','#7f6a62','#54464a'],deco:'house',treeDx:-3},
 ember:{name:'EMBER',makes:'light',flavour:'ember',col:'#f5a97f',top:'#8a5a4a',leaf:['#f5a97f','#d9754a','#a8473f'],rock:['#a8473f','#7a3a3a','#4d2a33'],deco:'sparks'},
 frost:{name:'FROST',makes:'water',flavour:'frost',col:'#91d7e3',top:'#c9dafb',leaf:['#e6f4fb','#91d7e3','#4a8fb0'],rock:['#91d7e3','#4a8fb0','#35607a'],deco:'snow',pine:true},
 amethyst:{name:'AMETHYST',makes:'light',flavour:'crystal',col:'#c6a0f6',top:'#7350a0',leaf:['#e4d3fb','#c6a0f6','#7350a0'],rock:['#c6a0f6','#7350a0','#4a3470'],deco:'crystal'},
 verdant:{name:'VERDANT',makes:'water',flavour:'meadow',col:'#a6da95',top:'#4f8a55',leaf:['#c3ecb2','#a6da95','#5f9a68'],rock:['#a98a7c','#6f9e6a','#3f6a48'],deco:'flowers',treeH:9,grove:true},
 anvil:{name:'ANVIL',makes:'stone',flavour:'forge',col:'#eed49f',top:'#6e738d',leaf:['#a5adcb','#7f849c','#494d64'],rock:['#a5adcb','#7f849c','#494d64'],deco:'forge'},
};
export const ISL_LAVA={
 ash:{name:'ASH',makes:'stone',flavour:'ash',col:'#a5adcb',top:'#494d64',leaf:['#a5adcb','#7f849c','#494d64'],rock:['#7f849c','#494d64','#363a4f'],deco:'house'},
 cinder:{name:'EMBERFALL',makes:'light',flavour:'ember',col:'#ed8796',top:'#8a4a4a',leaf:['#f0a0a8','#ed8796','#a8473f'],rock:['#a8473f','#7a3a3a','#4d2a33'],deco:'sparks'},
 geyser:{name:'GEYSER',makes:'water',flavour:'frost',col:'#8bd5ca',top:'#4a8f8a',leaf:['#c5efe7','#8bd5ca','#357a78'],rock:['#8bd5ca','#4a8f8a','#357a78'],deco:'snow'},
 obsidian:{name:'OBSIDIAN',makes:'light',flavour:'crystal',col:'#b7bdf8',top:'#363a4f',leaf:['#e3eafc','#b7bdf8','#5b6079'],rock:['#5b6079','#363a4f','#24273a'],deco:'crystal'},
 kiln:{name:'KILN',makes:'stone',flavour:'forge',col:'#f5a97f',top:'#6e5a55',leaf:['#a5adcb','#7f849c','#494d64'],rock:['#a5adcb','#7f849c','#494d64'],deco:'forge'},
};

// surfKey names a surface routine in palette.js SURF; squareKey names a town-square close-up in draw/closeup.js SQUARE.
// Island art fields (draw/scene.js island): deco, treeDx (tree offset), treeH (tree height), grove (two extra leaf blobs), pine (frosted top and a pine).
export const DEF_OCEAN = { key: 'ocean', name: 'TIDE', full: 'ocean world', surfKey: 'ocean', squareKey: 'garden', isl: ISL_OCEAN, sys: { R: 66, v: .012, a: 1.2, r: 8, col: '#8aadf4', rim: '#c9dafb' }, seedOffset: 0, next: 'lava' };
export const DEF_LAVA = { key: 'lava', name: 'CINDER', full: 'lava world', surfKey: 'lava', squareKey: 'ember', isl: ISL_LAVA, sys: { R: 38, v: .02, a: 3.4, r: 6, col: '#ed8796', lift: .4 }, seedOffset: 7, next: null };
export const WORLD_DEFS = [DEF_OCEAN, DEF_LAVA];

// Each sys entry: orbit radius R, speed v, start angle a, radius r, and its art: col (trail colour), optional
// rim (a lit 1-px edge) and lift (how much its far-side night is brightened so a dark world stays visible).
// Stars that stay visible but unreachable in v1.
export const SYS_EXTRA = [
  { name: 'RIME', full: 'ice world', surfKey: 'rocky', R: 96, v: .008, a: 5.0, r: 6, col: '#91d7e3' },
  { name: 'TEMPEST', full: 'gas giant', surfKey: 'gas', R: 130, v: .005, a: 2.4, r: 11, col: '#f5a97f' },
];
export const GSYS_NAMES = [['Quiet Sun', .6], ['Twin Embers', .85], ["Giant's Ring", .35], ['The Maw', .72], ['The Nursery', .5], ['Glass Spiral', .95]];

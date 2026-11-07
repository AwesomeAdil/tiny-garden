// Game content as data. DOM-free. Add planets, islands, goals and stars here.
export const W = 320, H = 200;
export const CARRY = 3, KEEP = 4, CAPP = 20, MAXR = 112, SPEED = 24, LVM = [1, 1.5, 2], MOVEPX = 12;

export const ISL_OCEAN={
 home:{name:'HOME',col:'#a6da95',top:'#5f9a68',leaf:['#a6da95','#6f9e6a','#3f6a48'],deco:'house',treeDx:-3,makes:'rock',needs:['water'],rate:.5,quirk:'Where you start.'},
 ember:{name:'EMBER',col:'#f5a97f',top:'#8a5a4a',leaf:['#f5a97f','#d9754a','#a8473f'],deco:'sparks',makes:'heat',needs:['water'],rate:.45,quirk:'Dries out and slows without Water.'},
 frost:{name:'FROST',col:'#91d7e3',top:'#c9dafb',leaf:['#e6f4fb','#91d7e3','#4a8fb0'],deco:'snow',pine:true,makes:'water',needs:['heat'],rate:.45,quirk:'Mostly frozen until Heat thaws it.'},
 amethyst:{name:'AMETHYST',col:'#c6a0f6',top:'#7350a0',leaf:['#e4d3fb','#c6a0f6','#7350a0'],deco:'crystal',makes:'light',needs:['rock'],rate:.45,bonus:true,quirk:'Its glow makes every island one bridge away work faster.'},
 verdant:{name:'VERDANT',col:'#a6da95',top:'#4f8a55',leaf:['#c3ecb2','#a6da95','#5f9a68'],deco:'flowers',treeH:9,grove:true,makes:'growth',needs:['water','light'],rate:.3,quirk:'The garden. It grows what eventually seeds the next star.'},
 anvil:{name:'ANVIL',col:'#eed49f',top:'#6e738d',leaf:['#a5adcb','#7f849c','#494d64'],deco:'forge',makes:'tools',needs:['rock','heat'],rate:.3,bonus:true,quirk:'Its Tools make every island one bridge away work faster.'},
};
export const ISL_LAVA={
 ash:{name:'ASH',col:'#a5adcb',top:'#494d64',leaf:['#a5adcb','#7f849c','#494d64'],deco:'house',makes:'rock',needs:['water'],rate:.5,quirk:'Where you land on Cinder. A soot-grey shelter.'},
 cinder:{name:'EMBERFALL',col:'#ed8796',top:'#8a4a4a',leaf:['#f0a0a8','#ed8796','#a8473f'],deco:'sparks',makes:'heat',needs:['rock'],rate:.5,quirk:'Glowing ash-trees. It burns Rock to make Heat.'},
 geyser:{name:'GEYSER',col:'#8bd5ca',top:'#4a8f8a',leaf:['#c5efe7','#8bd5ca','#357a78'],deco:'snow',makes:'water',needs:['heat'],rate:.4,quirk:'Steam vents. With Heat, it boils up Water.'},
 obsidian:{name:'OBSIDIAN',col:'#b7bdf8',top:'#363a4f',leaf:['#e3eafc','#b7bdf8','#5b6079'],deco:'crystal',makes:'light',needs:['heat'],rate:.45,bonus:true,quirk:'Black glass that catches the light. It speeds up its neighbours.'},
 kiln:{name:'KILN',col:'#f5a97f',top:'#6e5a55',leaf:['#a5adcb','#7f849c','#494d64'],deco:'forge',makes:'tools',needs:['rock','heat'],rate:.35,bonus:true,quirk:'A furnace island. Its Tools speed up its neighbours.'},
};

// surfKey names a surface routine in palette.js SURF; squareKey names a town-square close-up in draw/closeup.js SQUARE.
// Island art fields (draw/scene.js island): deco, treeDx (tree offset), treeH (tree height), grove (two extra leaf blobs), pine (frosted top and a pine).
export const DEF_OCEAN = { key: 'ocean', name: 'TIDE', full: 'ocean world', surfKey: 'ocean', squareKey: 'garden', isl: ISL_OCEAN, start: 'home', goal: { tools: 8, growth: 8, light: 10, heat: 10 }, bonusKind: 'water', sys: { R: 66, v: .012, a: 1.2, r: 8, col: '#8aadf4', rim: '#c9dafb' }, seedOffset: 0, next: 'lava' };
export const DEF_LAVA = { key: 'lava', name: 'CINDER', full: 'lava world', surfKey: 'lava', squareKey: 'ember', isl: ISL_LAVA, start: 'ash', goal: { tools: 10, heat: 20, growth: 6 }, bonusKind: 'heat', sys: { R: 38, v: .02, a: 3.4, r: 6, col: '#ed8796', lift: .4 }, seedOffset: 7, next: null };
export const WORLD_DEFS = [DEF_OCEAN, DEF_LAVA];

// Each sys entry: orbit radius R, speed v, start angle a, radius r, and its art: col (trail colour), optional
// rim (a lit 1-px edge) and lift (how much its far-side night is brightened so a dark world stays visible).
// Stars that stay visible but unreachable in v1.
export const SYS_EXTRA = [
  { name: 'RIME', full: 'ice world', surfKey: 'rocky', R: 96, v: .008, a: 5.0, r: 6, col: '#91d7e3' },
  { name: 'TEMPEST', full: 'gas giant', surfKey: 'gas', R: 130, v: .005, a: 2.4, r: 11, col: '#f5a97f' },
];
export const GSYS_NAMES = [['Quiet Sun', .6], ['Twin Embers', .85], ["Giant's Ring", .35], ['The Maw', .72], ['The Nursery', .5], ['Glass Spiral', .95]];

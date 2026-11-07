import { TAU, ramp, mix } from './pixel.js';
export const LIGHT = '#eed49f', HEAT = '#f5a97f', ROCK = '#a5adcb', WATER = '#8aadf4';
export const RES = ['rock', 'heat', 'water', 'light', 'growth', 'tools'];
export const COL = { rock: ROCK, heat: HEAT, water: WATER, light: LIGHT, growth: '#a6da95', tools: '#b7bdf8' };
export const NAME = { rock: 'Rock', heat: 'Heat', water: 'Water', light: 'Light', growth: 'Growth', tools: 'Tools' };
export const PAL = {e:'#a6da95',E:'#5f9a68',m:'#a98a7c',v:'#b7bdf8',V:'#7f85c8',c:'#7dc4e4',C:'#4a8fb0',p:'#f0c6c6',P:'#c99a9a',y:'#eed49f',Y:'#fff4d6',o:'#f5a97f',r:'#ed8796',d:'#a8473f',g:'#7f849c',G:'#a5adcb',k:'#494d64',b:'#8aadf4',B:'#c9dafb',n:'#3f5fa8',w:'#ffffff'};
export const UPAL = { ...PAL, h: '#6e5a55', H: '#c9a58e', s: '#24273a' };
export const KD = { crust: '#14151f', blue: '#8aadf4', mauve: '#c6a0f6', peach: '#f5a97f', yellow: '#eed49f', teal: '#8bd5ca', text: '#cad3f5', flamingo: '#f0c6c6' };
// Scene colours (page 38 C).
export const C = { leaf: '#a6da95', leaf2: '#8bd5ca', water: '#8aadf4', warm: '#f5a97f', flower: '#f5bde6', glow: '#eed49f', bark: '#a98a7c', crust: '#181926', base: '#24273a', surface: '#363a4f', sub: '#a5adcb', text: '#cad3f5' };
C.leafD = mix(C.leaf, C.crust, .55); C.leafM = mix(C.leaf, C.crust, .22); C.barkD = mix(C.bark, C.crust, .45); C.moss = mix(C.leaf, C.crust, .42); C.soil = mix(C.bark, C.crust, .72); C.rock = mix(C.sub, C.crust, .5);
export const R_ARM = ramp([KD.crust, '#1b1d33', '#25294d', '#343b6e', '#4a5596', '#6a7dc4', KD.blue, '#b4c8f7', '#e3eafc']);
export const R_IN = ramp([KD.crust, '#221c38', '#352754', '#4f3876', '#7350a0', '#9a72c9', KD.mauve, '#e0caf9', '#f6eefe']);
export const R_CORE = ramp([KD.crust, '#2c1f2c', '#4d2f33', '#7c4a3c', '#b36f4e', KD.peach, KD.yellow, '#f9eccb', '#fffbf0']);
export const R_TEAL = ramp([KD.crust, '#16242e', '#1d3a44', '#27565c', '#357a78', '#58a89e', KD.teal, '#c5efe7', '#eefbf8']);
export const R_PINK = ramp(['#14151f', '#2a1b33', '#472546', '#6e3660', '#a24f83', '#d17caf', '#f5bde6', '#fbe0f3', '#fff6fc']);

const spot = (u, v, s) => { const du = Math.min(Math.abs(u - s[0]), 1 - Math.abs(u - s[0])); return Math.hypot(du * 2, v - s[1]) < s[2] };
const land = [[.22, .36, .15], [.62, .62, .2], [.9, .28, .09]], craters = [[.2, .34, .11], [.5, .6, .16], [.78, .3, .08], [.95, .68, .1], [.34, .76, .07]];
// Surface colour routines, keyed by a def's surfKey.
export const SURF = {
  ocean: (u, v, t) => { if (Math.abs(v - .45 - Math.sin(u * TAU * 2 + t * .1) * .06) < .033) return '#e6eaf8'; return land.some(s => spot(u, v, s)) ? '#a6da95' : '#8aadf4' },
  rocky: (u, v) => craters.some(s => spot(u, v, s)) ? '#5b6079' : '#7f849c',
  gas: (u, v) => { const b = [.2, .34, .52, .66, .84]; let i = 0; for (const x of b) if (v > x) i++; return i % 2 ? '#c9855f' : '#f5a97f' },
  lava: (u, v) => { const w = Math.sin(u * TAU * 3 + Math.sin(v * 11) * 1.5) + Math.sin(v * TAU * 2.4 + Math.sin(u * TAU * 2) * 1.6); return Math.abs(w) < .13 ? '#f5a97f' : '#3a2a33' },
};

// Solar system, "Dusk" (page 43): a dithered teal-blue glow around the sun fading to space, faint orbit dots,
// and the name colours and leaders drawn over the galaxy and system.
export const SAPPHIRE = '#7dc4e4';
export const R_DUSK = ramp(['#14151f', mix('#14151f', KD.blue, .045), mix('#14151f', SAPPHIRE, .08), mix('#14151f', KD.teal, .12)]);
export const ORBIT = { near: '#26283a', far: '#1f2131' };
export const NAMEC = { home: KD.yellow, star: '#8087a2', world: KD.blue, far: '#6e738d', shadow: KD.crust, lead: '#494d64', leadHome: '#6e738d' };

// 12px UI icons and 8px goods as pixel maps in the shared palette (see docs/ART.md).
// Each string is one row; each character is a palette key ('.' or any unknown key is clear).
import { P } from './pixel.js';
import { PAL, UPAL } from './palette.js';

// Resource icons (PAL keys).
export const ICON = {light:['.....y......','.....y......','..y..y..y...','...y.Y.y....','....YYY.....','yyyYYwYYyyy.','....YYY.....','...y.Y.y....','..y..y..y...','.....y......','.....y......'],
heat:['.....o......','....oo......','....ooo.....','...oyoo..o..','..ooyyoo.o..','..oyyyooooo.','.ooyYYyooo..','.ooyYYYyoo..','.royYYYyor..','.rrooyyoorr.','..rrrrrrrr..','...dddddd...'],
rock:['............','....gggg....','..ggGGGgg...','.gGGGggggk..','.gGggggggkk.','ggggggkgggk.','gggkgggggkk.','.gggggggkkk.','.kggggkkkk..','..kkkkkkk...'],
tools:['............','.vv.........','vVv.........','vvvv........','..vvv.......','...vvv......','....vvv.oo..','.....vvooo..','......Vooo..','.......ooo..','........o...','............'],
power:['......cc....','.....cc.....','....cc......','...ccc......','..cccccc....','.....cc.....','....cc......','...CC.......','..CC........','.CC.........','............','............'],
panels:['............','.PPPPPPPPPP.','.PppppPpppP.','.PpwppPpwpP.','.PppppPpppP.','.PPPPPPPPPP.','.PppppPpppP.','.PpwppPpwpP.','.PppppPpppP.','.PPPPPPPPPP.','.....PP.....','....PPPP....'],
growth:['............','.....ee.....','..eee.ee.ee.','.eEeee.eeEe.','..eeEe.eEe..','.....e.e....','......e.....','......E.....','......E.....','...mmmmmm...','....mmmm....','............'],
stone:['............','....gggg....','..ggGGGgg...','.gGGGGggggk.','.gGGggggggk.','gGgggggkgggk','gggkgggggggk','gggggggggkkk','.gggggggkkk.','.kggggkkkk..','..kkkkkkk...','............'],
water:['.....b......','.....b......','....bbb.....','....bBb.....','...bBBbb....','..bbBbbbb...','..bBbbbbb...','..bbbbbbn...','..bbbbbnn...','...bbnnn....','....nnn.....']};

// Tool and view icons (UPAL keys: PAL plus h/H wood and s base).
export const UICON = {
move:['.....w......','....wGw.....','...wGGGw....','.....G......','.w...G...w..','wGGGGwGGGGw.','.w...G...w..','.....G......','...wGGGw....','....wGw.....','.....w......','............'],
rope:['............','...hhhhh....','..hHHHHHh...','.hHhhhhhHh..','.hHh...hHh..','.hHh.hhhHh..','.hHh.hHHh...','.hHh..hh....','.hHhhhhhhh..','..hHHHHHHHh.','...hhhhhhhh.','............'],
cut:['.G.......G..','.GG.....GG..','..GG...GG...','...GG.GG....','....GwG.....','.....k......','....r.r.....','...r...r....','..rr...rr...','.r..r.r..r..','.r..r.r..r..','..rr...rr...'],
system:['............','.........yy.','....bbb.yy..','...bBbbyb...','..bBbbybb...','..bbbybbb...','..bbybbbn...','..ybbbbnn...','.yy.bnnn....','yy..........','............','............'],
play:['............','..e.........','..ee........','..eee.......','..eeEe......','..eeeEE.....','..eeeEE.....','..eeEe......','..eee.......','..ee........','..e.........','............'],
fast:['............','............','.e....e.....','.ee...ee....','.eEe..eEe...','.eEEe.eEEe..','.eEEe.eEEe..','.eEe..eEe...','.ee...ee....','.e....e.....','............','............'],
skip:['............','............','.c....c..c..','.cc...cc.c..','.cCc..cCcc..','.cCCc.cCCc..','.cCCc.cCCc..','.cCc..cCcc..','.cc...cc.c..','.c....c..c..','............','............'],
city:['............','.....ee.....','....eEEe....','.....mm.yy..','.....m.hhhh.','..eeeeehHHh.','.EEEEEEEEEE.','..GGGGGGGG..','...gggggg...','....kkkk....','.....kk.....','............'],
galaxy:['............','.....c......','.....c......','....bbb.....','.bbvvyvvbb..','bvvyYwYyvvb.','.bbvvyvvbb..','....bbb.....','.....c......','.....c......','............','............'],
dice:['............','.wwwwwwwwG..','.wBBBBBBBG..','.wBkBBBkBG..','.wBBBBBBBG..','.wBBBkBBBG..','.wBBBBBBBG..','.wBkBBBkBG..','.wBBBBBBBG..','.GGGGGGGGG..','............','............'],
cable:['............','bb.......bb.','bBb.....bBb.','bbb..g..bbb.','bBbggGggbBb.','bbb..G..bbb.','bBb..G..bBb.','bb...g...bb.','.....y......','....y.y.....','...y...y....','............'],
dock:['.....GG.....','....G..G....','.....GG.....','..GGGGGGGG..','.....GG.....','.....GG.....','.....GG.....','.G...GG...G.','.GG..GG..GG.','..GG.GG.GG..','...GGGGGG...','............'],
walker:['.......pp...','.......pp...','.....bbbb...','....b.bb.b..','.....bbb....','.c...bbb....','.....h.h....','.cc.h...h...','...h.....h..','..h.......h.','............','............'],
arrow:['............','.......G....','.......GG...','.GGGGGGGGG..','.GGGGGGGGGG.','.GGGGGGGGG..','.......GG...','.......G....','............','............','............','............'],
star:['............','.....y......','.....y......','....yYy.....','yyyyYwYyyyy.','.yyYYYYYyy..','..yYYYYYy...','..yYy.yYy...','.yy.....yy..','.y.......y..','............','............'],
close:['...GGGG.....','..GcBccg....','.GcBcccCg...','.GceeccCg...','.GEEEEcCg...','.GcgkcCCg...','..gCkCCg....','...ggggh....','.......hh...','........hH..','.........hh.','............'],
patch:['.......GG.G.','......GG..G.','......GG.GG.','.....GGGGG..','....GGG.....','...GGG......','..GGG.......','.GGG........','GGG.........','GG..........','............','............']};

// A 5x7 pixel font for the galaxy and system names: each glyph is 7 rows of 5, '#' set. Advance is 6.
export const FONT = Object.fromEntries(Object.entries({
  A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.', C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.', E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#', I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..', K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# #...# ##..# #.#.# #..## #...# #...#', O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....', Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..', W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.', 2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '####. ....# ....# .###. ....# ....# ####.', 4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
  6: '..##. .#... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...', 8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ...#. .##..', "'": '..#.. ..#.. .#... ..... ..... ..... .....', '-': '..... ..... ..... .###. ..... ..... .....',
  '.': '..... ..... ..... ..... ..... .##.. .##..', ' ': '..... ..... ..... ..... ..... ..... .....',
}).map(([k, v]) => [k, v.split(' ')]));
export const textW = s => s.length * 6 - 1;
// Pixel text at (x, y) in whole pixels of c, one font pixel per canvas pixel. Unknown characters are blank.
export function pixText(c, s, x, y, col) { c.fillStyle = col; [...s.toUpperCase()].forEach((ch, k) => (FONT[ch] || FONT[' ']).forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') c.fillRect(x + k * 6 + i, y + j, 1, 1) })) }

// 8x8 goods that stack on the ground in the close-ups (UPAL keys).
export const GOODS = {rock:['........','........','...gG...','..gGGg..','.gGggGk.','gGgggkgk','gggkggkk','.kkkkkk.'],
 water:['..hhhh..','.hbBbbh.','.HhhhhH.','.hbbbbh.','.hbBbbh.','.HhhhhH.','.hbbnbh.','..hhhh..'],
 heat:['...y....','..yoy...','..oyo...','.ooYoo..','.roooor.','.kkkkkk.','..k..k..','.kk..kk.'],
 light:['..kkkk..','...kk...','..kYYk..','.kYwwYk.','.kYwwYk.','.kyYYyk.','..kyyk..','...kk...'],
 growth:['...e.e..','....E...','..mmmm..','.mHmmHm.','.mmmmmm.','mmHmmmmm','mmmmmHmm','.mmmmmm.'],
 tools:['.vV.....','..vV.oo.','...vVoo.','hhhhVhhh','hHHHHHHh','hHhhhhHh','hHHHHHHh','hhhhhhhh']};

const paint = (rows, pal, size) => {
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const c = cv.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) P(c, pal[ch], i, j) }));
  return cv;
};
const cache = {};
const memo = (key, make) => cache[key] || (cache[key] = make());

export const iconURL = k => memo('i:' + k, () => paint(ICON[k], PAL, 12).toDataURL());
export const uiconURL = k => memo('u:' + k, () => paint(UICON[k], UPAL, 12).toDataURL());
export const goodsCanvas = k => memo('g:' + k, () => paint(GOODS[k], UPAL, 8));

// HTML snippets for the UI (page 38 ico, uico).
export const ico = k => `<img src="${iconURL(k)}" alt="">`;
export const uico = k => `<img src="${uiconURL(k)}" alt="">`;

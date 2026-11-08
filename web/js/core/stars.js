// The wallpaper's twinkling stars, off the per-frame canvas.
//
// At 3440x1440 a twinkle frame changes a few hundred stars spread over the whole sky, and WebKit repaints the box
// around every changed pixel, so twinkling in the canvas made almost every wallpaper frame a full-canvas repaint
// (docs/TIMINGS.md). In wallpaper mode twinkle() (draw/kit.js) draws nothing and only records each star here,
// with the pixel under it. main.js then draws the visible stars once into GROUPS small layers (canvases over the
// map, same pixel grid) whose opacity main.js steps through the twinkle on the wallpaper's own frames
// (starOpacity). An opacity change on a composited layer is a layer property, not a repaint, and riding the frame
// the map already commits adds no rendering update of its own. A layer's pixels are touched only when a star is
// covered or uncovered (an island bobs over it, a walker passes).
// (A step-end CSS animation did the same with no JS, but WebKit doesn't run stepped animations on the compositor:
// every step was its own rendering update, about 6% of a core for 6 groups. A linear one runs on the compositor,
// but WindowServer then recomposites the screen 60 times a second: +20%. docs/TIMINGS.md.)
//
// Each group steps through sin's twinkle thresholds (twinkle(): bright above .6, dim above -.2, off below) over
// its own period, so neighbouring stars twinkle out of step.

export const GROUPS = 6;
// The period of each group's twinkle, in seconds (twinkle()'s f runs .6..2 rad/s: periods 3..10 s).
export const PERIODS = [3.3, 4.1, 4.8, 5.7, 6.9, 8.3];

// Group g's opacity at time t (seconds): sin's twinkle over the group's period, offset by g/GROUPS of a turn.
// Rising from 0: dim until sin passes .6, bright until it falls back under .6, dim until -.2, off until it climbs
// back over -.2 (the phase fractions are asin(.6)/2pi and (pi + asin(.2))/2pi).
export function starOpacity(t, g) {
  const ph = ((t / PERIODS[g] + g / GROUPS) % 1 + 1) % 1;
  return ph < .1024 ? .5 : ph < .3976 ? 1 : ph < .5321 ? .5 : ph < .9679 ? 0 : .5;
}

// While on, twinkle() records instead of drawing: list holds star, bg, then for big stars the 4 arm pixels'
// bg (left, right, up, down; -1 off the canvas).
export const STARS = { on: false, list: [] };

export function recordStars(c, tw) {
  const px = c.px, W = c.width, H = c.height, L = STARS.list, at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? -1 : px[y * W + x];
  for (const s of tw) { if (s.x < 0 || s.y < 0 || s.x >= W || s.y >= H) continue; L.push(s, at(s.x, s.y), s.big ? [at(s.x - 1, s.y), at(s.x + 1, s.y), at(s.x, s.y - 1), at(s.x, s.y + 1)] : null) }
}

export const groupOf = s => (((s.x * 73856093) ^ (s.y * 19349663)) >>> 0) % GROUPS;

// The recorded stars still showing in the finished frame px (w wide): the pixel under the star is still the one
// that was there when it was recorded (nothing was drawn over it). A big star keeps its arms only if all four are
// uncovered. Returns a Map from y*w+x to {x, y, g, arms}.
export function visibleStars(list, px, w) {
  const out = new Map();
  for (let i = 0; i < list.length; i += 3) {
    const s = list[i], k = s.y * w + s.x;
    if (px[k] !== list[i + 1]) continue;
    const nb = list[i + 2];
    const arms = !!nb && nb[0] >= 0 && px[k - 1] === nb[0] && nb[1] >= 0 && px[k + 1] === nb[1] && nb[2] >= 0 && px[k - w] === nb[2] && nb[3] >= 0 && px[k + w] === nb[3];
    out.set(k, { x: s.x, y: s.y, g: groupOf(s), arms });
  }
  return out;
}

// What changed between two visibleStars maps: stars to add and to remove (a star whose arms changed is both).
export function starDiff(prev, next) {
  const add = [], del = [];
  for (const [k, s] of next) { const p = prev.get(k); if (!p) add.push(s); else if (p.arms !== s.arms) { del.push(p); add.push(s) } }
  for (const [k, p] of prev) if (!next.has(k)) del.push(p);
  return { add, del };
}

// Draws star s into a group layer's 2D context (bright core; the arms at .7 alpha of the dim colour, as twinkle()).
export function drawStar(ctx, s) {
  ctx.fillStyle = '#e3eafc'; ctx.fillRect(s.x, s.y, 1, 1);
  if (s.arms) { ctx.globalAlpha = .7; ctx.fillStyle = '#8087a2'; ctx.fillRect(s.x - 1, s.y, 1, 1); ctx.fillRect(s.x + 1, s.y, 1, 1); ctx.fillRect(s.x, s.y - 1, 1, 1); ctx.fillRect(s.x, s.y + 1, 1, 1); ctx.globalAlpha = 1 }
}
export function clearStar(ctx, s) { if (s.arms) { ctx.clearRect(s.x - 1, s.y, 3, 1); ctx.clearRect(s.x, s.y - 1, 1, 3) } else ctx.clearRect(s.x, s.y, 1, 1) }

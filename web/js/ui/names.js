// Where the galaxy and system names go (pure, DOM-free). Page 43's A3: each name sits in clear space on its
// side of the disc or plane, joined to its star or planet by a 1-pixel leader that never crosses art, and
// the names on one side share a row wherever that stays clear. Coordinates are native canvas pixels.

// From a drawn frame (ABGR words, as in ImageData) build two masks:
//   art:  dense bright pixels (max channel over thr, and at least 3 bright in its 5x5 window), so lone
//         stars don't count. Leaders may not cross it.
//   busy: art padded by dil pixels. Names may not cover it.
export function artMask(px, w, h, thr, dil) {
  const n = w * h, bright = new Uint8Array(n), art = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const v = px[i]; bright[i] = Math.max(v & 255, (v >>> 8) & 255, (v >>> 16) & 255) > thr ? 1 : 0 }
  const I = sat(bright, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (bright[i] && sum(I, w, x - 2, y - 2, x + 3, y + 3, h) >= 3) art[i] = 1 }
  const A = sat(art, w, h), busy = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sum(A, w, x - dil, y - dil, x + dil + 1, y + dil + 1, h) > 0) busy[y * w + x] = 1;
  return { w, h, art, busy, B: sat(busy, w, h) };
}

// Summed-area table ((w+1) x (h+1)) and the count inside [x0,x1) x [y0,y1), clipped to the frame.
function sat(a, w, h) {
  const W1 = w + 1, I = new Int32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += a[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row } }
  return I;
}
function sum(I, w, x0, y0, x1, y1, h) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1); if (x0 >= x1 || y0 >= y1) return 0;
  const W1 = w + 1; return I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
}

const DX = [0, .35, -.35, .7, -.7, 1.1, -1.1], SPACE = 2;

// Names are a play-mode aid: the wallpaper never shows them, and in play the N key (game.ui.names) hides them.
export const namesOn = (mode, ui) => mode === 'play' && ui.names !== false;

// items: [{id, ax, ay, w, h, up}] where (ax, ay) is the star or planet and up says which side the name goes.
// Returns one entry per item, in order: {id, x, y, w, h, line: [[x, y], ...]} or null when no clear spot exists.
// opt: margin (kept clear at the frame edge), gap (shortest leader), block (extra rects names must avoid),
// prev (the last result): a name keeps its slot while that stays clear and its leader can still reach it from
// the anchor's new spot, so names hold still and only the leader follows; it moves only once art covers it.
export function placeNames(items, m, { margin = 4, gap = 3, block = [], prev = null } = {}) {
  const { w: W, h: H, art, B } = m, used = new Uint8Array(W * H), out = items.map(() => null);
  const overlaps = (a, b, s = 0) => a.x < b.x + b.w + s && b.x < a.x + a.w + s && a.y < b.y + b.h + s && b.y < a.y + a.h + s;
  const boxClear = (b, self) => b.x >= margin && b.y >= margin && b.x + b.w <= W - margin && b.y + b.h <= H - margin
    && sum(B, W, b.x, b.y, b.x + b.w, b.y + b.h, H) === 0 && !block.some(r => overlaps(b, r))
    && !out.some((o, j) => o && j !== self && (overlaps(b, o, SPACE) || o.line.some(([x, y]) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)));
  const lineClear = (line, self) => line.every(([x, y]) => x >= 0 && y >= 0 && x < W && y < H && !art[y * W + x] && !used[y * W + x]
    && !out.some((o, j) => o && j !== self && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h));
  const mark = (line, v) => line.forEach(([x, y]) => { used[y * W + x] = v });

  // The leader's first clear pixel: walk away from the anchor, in its column, until the art ends for good
  // (no art in the next RUN pixels), so a dark lane inside a disc doesn't count as its edge.
  const RUN = 8, artAt = (x, y) => y >= 0 && y < H && art[y * W + x];
  const start = (it, dir) => { const x = Math.max(0, Math.min(W - 1, Math.round(it.ax))); let y = Math.round(it.ay);
    for (;;) { while (artAt(x, y)) y += dir; let k = 1; while (k <= RUN && !artAt(x, y + dir * k)) k++; if (k > RUN) break; y += dir * k }
    return y >= 0 && y < H ? [x, y] : null };
  // A name whose near edge is next to row `end`: straight down/up to it, or with one elbow two rows short of it.
  const leader = (E, box, end, dir) => {
    const col = (x, a, b) => { const r = []; for (let y = a; dir < 0 ? y >= b : y <= b; y += dir) r.push([x, y]); return r };
    if (E[0] >= box.x && E[0] < box.x + box.w) return col(E[0], E[1], end);
    const bx = Math.max(box.x + 1, Math.min(box.x + box.w - 2, E[0])), ym = end - dir * 2, r = col(E[0], E[1], ym);
    for (let x = E[0] + Math.sign(bx - E[0]); x !== bx; x += Math.sign(bx - E[0])) r.push([x, ym]);
    return r.concat(col(bx, ym, end));
  };
  // The box for a near-edge row `end` and a sideways shift.
  const boxAt = (it, end, dir, dx) => ({ x: Math.round(it.ax - it.w / 2 + dx * it.w), y: dir < 0 ? end - it.h : end + 1, w: it.w, h: it.h });
  const tryRow = (it, i, E, end, dir) => {
    if ((end - E[1]) * dir < gap) return null;
    for (const dx of DX) { const b = boxAt(it, end, dir, dx); if (!boxClear(b, i)) continue; const line = leader(E, b, end, dir); if (lineClear(line, i)) return { id: it.id, ...b, line, dir, E } }
    return null;
  };

  // Keep last time's slots where they still work.
  const was = new Map((prev || []).filter(Boolean).map(o => [o.id, o])), kept = new Set();
  items.forEach((it, i) => {
    const o = was.get(it.id); if (!o || o.w !== it.w || o.h !== it.h) return;
    const dir = o.dir, E = start(it, dir), b = { x: o.x, y: o.y, w: o.w, h: o.h }, end = dir < 0 ? b.y + b.h : b.y - 1;
    if (!E || (end - E[1]) * dir < gap || !boxClear(b, i)) return;
    const line = leader(E, b, end, dir); if (!lineClear(line, i)) return;
    out[i] = { id: it.id, ...b, line, dir, E }; mark(line, 1); kept.add(i);
  });

  items.forEach((it, i) => {
    if (out[i]) return;
    for (const dir of it.up ? [-1, 1] : [1, -1]) {
      const E = start(it, dir); if (!E) continue;
      for (let k = gap; ; k++) { const end = E[1] + dir * k; if (end < margin || end >= H - margin) break; const o = tryRow(it, i, E, end, dir); if (o) { out[i] = o; mark(o.line, 1); break } }
      if (out[i]) break;
    }
  });

  // A3: names on one side share the row furthest out, where the moved box and its leader stay clear.
  for (const dir of [-1, 1]) {
    const grp = out.map((o, i) => o && o.dir === dir ? i : -1).filter(i => i >= 0); if (grp.length < 2) continue;
    const end = dir < 0 ? Math.min(...grp.map(i => out[i].y + out[i].h)) : Math.max(...grp.map(i => out[i].y - 1));
    grp.forEach(i => {
      if (kept.has(i)) return; // a kept name never moves just to line up
      const o = out[i], cur = dir < 0 ? o.y + o.h : o.y - 1; if (cur === end) return;
      mark(o.line, 0); const n = tryRow(items[i], i, o.E, end, dir);
      if (n) out[i] = n; mark(out[i].line, 1);
    });
  }
  return out.map(o => o && { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, dir: o.dir, line: o.line });
}

// Putting a PixCtx frame on screen: only the box around the pixels that changed since the last frame is put, in
// one putImageData, and a frame where nothing changed puts nothing.
//
// What WebKit charges for (3440x1440, 10 fps, docs/TIMINGS.md):
// - the area it repaints: the GPU process cost grows with it (the whole 1146x480 canvas each frame is about 5% of a
//   core; a 16x16 box about 1%). WebKit repaints one box around everything drawn in a frame, so many small puts
//   (or fillRects) cost as much as one put of the box around them;
// - each putImageData call: about 0.2 ms in WebContent whatever its size, so it is one call per frame.

// The box around the pixels of px that differ from prev (both w*h), as [x, y, width, height], or null.
export function dirtyBox(px, prev, w, h) {
  let i = 0; const n = w * h;
  while (i < n && px[i] === prev[i]) i++;
  if (i === n) return null;
  let j = n - 1;
  while (px[j] === prev[j]) j--;
  const y0 = Math.floor(i / w), y1 = Math.floor(j / w);
  let x0 = Math.min(i - y0 * w, j - y1 * w), x1 = Math.max(i - y0 * w, j - y1 * w);
  // Rows y0 and y1 are known up to i and from j; every row in between can only widen the box at its ends.
  for (let y = y0; y <= y1; y++) {
    const row = y * w;
    for (let x = 0; x < x0; x++) if (px[row + x] !== prev[row + x]) { x0 = x; break }
    for (let x = w - 1; x > x1; x--) if (px[row + x] !== prev[row + x]) { x1 = x; break }
  }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

// Puts the changed box of pix into ctx (the whole frame when force) and records it in prev.
// Returns the box put, or null.
export function present(ctx, pix, prev, force) {
  const w = pix.width, h = pix.height, px = pix.px, box = force ? [0, 0, w, h] : dirtyBox(px, prev, w, h);
  if (!box) return null;
  const [x, y, bw, bh] = box;
  for (let r = y; r < y + bh; r++) { const k = r * w + x; prev.set(px.subarray(k, k + bw), k) }
  ctx.putImageData(pix.img, 0, 0, x, y, bw, bh);
  return box;
}

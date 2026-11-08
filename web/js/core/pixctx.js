// A small software stand-in for a 2D canvas context, used to draw the wallpaper map.
// The art routines only fill whole-pixel rects (P), set globalAlpha, put ImageData and draw small icons,
// so this context runs them in plain JS into one pixel buffer. A real canvas would send each of those
// thousands of 1-pixel rects to WebKit's GPU process every frame.
// Blending is source-over onto an opaque buffer, the same as the canvas (give or take 1 in 255 from rounding).
// With {transparent:true} the buffer starts at alpha 0 and blends with proper "over", so it can hold a sprite
// that blit() later draws onto another PixCtx.
const parsed = new Map();
let probe = null;
function rgbaOf(s) {
  let v = parsed.get(s);
  if (v) return v;
  if (/^#[0-9a-f]{6}$/i.test(s)) v = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
  else { // anything else (named, rgb(), #rgb): let a real canvas parse it once
    probe = probe || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = s; probe.fillRect(0, 0, 1, 1); v = [...probe.getImageData(0, 0, 1, 1).data];
  }
  parsed.set(s, v);
  return v;
}
const icons = new WeakMap();
const iconPixels = src => { let d = icons.get(src); if (!d) { d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; icons.set(src, d) } return d };

export class PixCtx {
  constructor(w, h, o = {}) {
    this.width = w; this.height = h; this.img = new ImageData(w, h); this.px = new Uint32Array(this.img.data.buffer); this.d = this.img.data;
    this.transparent = !!o.transparent; this.globalAlpha = 1; this._style = '#000000'; this._rgba = [0, 0, 0, 255]; this.tx = 0; this.ty = 0;
  }
  set fillStyle(s) { if (s !== this._style) { this._style = s; this._rgba = rgbaOf(s) } }
  get fillStyle() { return this._style }

  // Whole-pixel translation, as the canvas's translate (fillRect and drawImage only; putImageData ignores it).
  translate(x, y) { this.tx += x; this.ty += y }
  createImageData(w, h) { return new ImageData(w, h) }

  fillRect(x, y, w, h) {
    x += this.tx; y += this.ty;
    let x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.width, x1); y1 = Math.min(this.height, y1);
    if (x0 >= x1 || y0 >= y1) return;
    const [r, g, b, a8] = this._rgba, a = Math.max(0, Math.min(1, this.globalAlpha)) * a8 / 255, W = this.width;
    if (a <= 0) return;
    if (a >= 1) { const c = (255 << 24 | b << 16 | g << 8 | r) >>> 0; for (let yy = y0; yy < y1; yy++) this.px.fill(c, yy * W + x0, yy * W + x1); return }
    const d = this.d, k = 1 - a, ra = r * a, ga = g * a, ba = b * a;
    if (this.transparent) { for (let yy = y0; yy < y1; yy++) for (let i = (yy * W + x0) * 4, e = (yy * W + x1) * 4; i < e; i += 4) this._over(i, r, g, b, a); return }
    for (let yy = y0; yy < y1; yy++) for (let i = (yy * W + x0) * 4, e = (yy * W + x1) * 4; i < e; i += 4) {
      d[i] = ra + d[i] * k; d[i + 1] = ga + d[i + 1] * k; d[i + 2] = ba + d[i + 2] * k; d[i + 3] = 255;
    }
  }

  // Source-over of (r,g,b) at alpha a (0..1) onto byte i. An opaque buffer stays opaque; a transparent one
  // keeps the colour un-premultiplied with the combined alpha, so nothing is blended with black.
  _over(i, r, g, b, a) {
    const d = this.d, k = 1 - a;
    if (!this.transparent) { d[i] = r * a + d[i] * k; d[i + 1] = g * a + d[i + 1] * k; d[i + 2] = b * a + d[i + 2] * k; d[i + 3] = 255; return }
    const da = d[i + 3] / 255 * k, oa = a + da;
    if (oa <= 0) return;
    d[i] = (r * a + d[i] * da) / oa; d[i + 1] = (g * a + d[i + 1] * da) / oa; d[i + 2] = (b * a + d[i + 2] * da) / oa; d[i + 3] = oa * 255;
  }

  // Another PixCtx's pixels at (x, y), source-over; fully transparent pixels are skipped and opaque ones copied.
  blit(src, x, y) {
    x = Math.round(x + this.tx); y = Math.round(y + this.ty);
    const sw = src.width, W = this.width, sp = src.px, sd = src.d, px = this.px, ga = Math.max(0, Math.min(1, this.globalAlpha));
    if (ga <= 0) return;
    const i0 = Math.max(0, -x), i1 = Math.min(sw, W - x), j0 = Math.max(0, -y), j1 = Math.min(src.height, this.height - y);
    for (let j = j0; j < j1; j++) for (let i = i0, si = j * sw + i0, di = (y + j) * W + x + i0; i < i1; i++, si++, di++) {
      const a8 = sd[si * 4 + 3]; if (!a8) continue;
      if (a8 === 255 && ga >= 1) { px[di] = sp[si]; continue }
      this._over(di * 4, sd[si * 4], sd[si * 4 + 1], sd[si * 4 + 2], a8 / 255 * ga);
    }
  }

  // Another PixCtx's pixels zoomed by the whole number z, nearest-neighbour: each source pixel becomes a z x z block
  // (alpha is kept: opaque blocks are copied, partly transparent ones blended).
  blitZoom(src, x, y, z) {
    x = Math.round(x + this.tx); y = Math.round(y + this.ty);
    const sw = src.width, sh = src.height, W = this.width, H = this.height, sp = src.px, sd = src.d, px = this.px, ga = Math.max(0, Math.min(1, this.globalAlpha));
    if (ga <= 0) return;
    for (let j = 0; j < sh; j++) {
      const y0 = Math.max(0, y + j * z), y1 = Math.min(H, y + (j + 1) * z); if (y0 >= y1) continue;
      for (let i = 0; i < sw; i++) {
        const si = j * sw + i, a8 = sd[si * 4 + 3]; if (!a8) continue;
        const x0 = Math.max(0, x + i * z), x1 = Math.min(W, x + (i + 1) * z); if (x0 >= x1) continue;
        if (a8 === 255 && ga >= 1) { for (let yy = y0; yy < y1; yy++) px.fill(sp[si], yy * W + x0, yy * W + x1) }
        else for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this._over((yy * W + xx) * 4, sd[si * 4], sd[si * 4 + 1], sd[si * 4 + 2], a8 / 255 * ga);
      }
    }
  }

  // Whole-image puts at an offset (what the galaxy does).
  putImageData(img, dx, dy) {
    const W = this.width, sw = img.width, src = new Uint32Array(img.data.buffer, img.data.byteOffset, sw * img.height);
    for (let y = 0; y < img.height; y++) {
      const ty = y + dy; if (ty < 0 || ty >= this.height) continue;
      const sx0 = Math.max(0, -dx), sx1 = Math.min(sw, W - dx); if (sx0 >= sx1) continue;
      this.px.set(src.subarray(y * sw + sx0, y * sw + sx1), ty * W + dx + sx0);
    }
  }

  // Small icon canvases, drawn unscaled at whole pixels.
  drawImage(src, x, y) {
    if (src instanceof PixCtx) return this.blit(src, x, y);
    const s = iconPixels(src), sw = src.width, sh = src.height, W = this.width, ga = Math.max(0, Math.min(1, this.globalAlpha));
    x = Math.round(x + this.tx); y = Math.round(y + this.ty);
    for (let j = 0; j < sh; j++) { const ty = y + j; if (ty < 0 || ty >= this.height) continue;
      for (let i = 0; i < sw; i++) { const tx = x + i; if (tx < 0 || tx >= W) continue;
        const si = (j * sw + i) * 4, a = s[si + 3] / 255 * ga; if (a <= 0) continue;
        this._over((ty * W + tx) * 4, s[si], s[si + 1], s[si + 2], a);
      }
    }
  }
}

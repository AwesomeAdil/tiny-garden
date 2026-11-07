// A small software stand-in for a 2D canvas context, used to draw the wallpaper map.
// The art routines only fill whole-pixel rects (P), set globalAlpha, put ImageData and draw small icons,
// so this context runs them in plain JS into one pixel buffer. A real canvas would send each of those
// thousands of 1-pixel rects to WebKit's GPU process every frame.
// Blending is source-over onto an opaque buffer, the same as the canvas (give or take 1 in 255 from rounding).
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
  constructor(w, h) {
    this.width = w; this.height = h; this.img = new ImageData(w, h); this.px = new Uint32Array(this.img.data.buffer); this.d = this.img.data;
    this.globalAlpha = 1; this._style = '#000000'; this._rgba = [0, 0, 0, 255];
  }
  set fillStyle(s) { if (s !== this._style) { this._style = s; this._rgba = rgbaOf(s) } }
  get fillStyle() { return this._style }

  fillRect(x, y, w, h) {
    let x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.width, x1); y1 = Math.min(this.height, y1);
    if (x0 >= x1 || y0 >= y1) return;
    const [r, g, b, a8] = this._rgba, a = Math.max(0, Math.min(1, this.globalAlpha)) * a8 / 255, W = this.width;
    if (a <= 0) return;
    if (a >= 1) { const c = (255 << 24 | b << 16 | g << 8 | r) >>> 0; for (let yy = y0; yy < y1; yy++) this.px.fill(c, yy * W + x0, yy * W + x1); return }
    const d = this.d, k = 1 - a, ra = r * a, ga = g * a, ba = b * a;
    for (let yy = y0; yy < y1; yy++) for (let i = (yy * W + x0) * 4, e = (yy * W + x1) * 4; i < e; i += 4) {
      d[i] = ra + d[i] * k; d[i + 1] = ga + d[i + 1] * k; d[i + 2] = ba + d[i + 2] * k; d[i + 3] = 255;
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
    const s = iconPixels(src), sw = src.width, sh = src.height, W = this.width, d = this.d, ga = Math.max(0, Math.min(1, this.globalAlpha));
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < sh; j++) { const ty = y + j; if (ty < 0 || ty >= this.height) continue;
      for (let i = 0; i < sw; i++) { const tx = x + i; if (tx < 0 || tx >= W) continue;
        const si = (j * sw + i) * 4, a = s[si + 3] / 255 * ga; if (a <= 0) continue;
        const di = (ty * W + tx) * 4, k = 1 - a;
        d[di] = s[si] * a + d[di] * k; d[di + 1] = s[si + 1] * a + d[di + 1] * k; d[di + 2] = s[si + 2] * a + d[di + 2] * k; d[di + 3] = 255;
      }
    }
  }
}

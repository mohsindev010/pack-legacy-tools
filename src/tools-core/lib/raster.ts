// Rasterise a Drawing's rectangles to RGBA pixels (no canvas needed). Used by the
// decode tests and by the browser's scan check before a logo is drawn on top.
import { parseHex } from "./color";
import type { Drawing } from "./drawing";

export type Raster = { data: Uint8ClampedArray; width: number; height: number };

export function rasterize(d: Drawing, pxPerMm: number): Raster {
  const width = Math.max(1, Math.round(d.widthMm * pxPerMm));
  const height = Math.max(1, Math.round(d.heightMm * pxPerMm));
  const data = new Uint8ClampedArray(width * height * 4);
  const bg = parseHex(d.bg) ?? { r: 255, g: 255, b: 255 };
  const fg = parseHex(d.fg) ?? { r: 0, g: 0, b: 0 };
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg.r;
    data[i * 4 + 1] = bg.g;
    data[i * 4 + 2] = bg.b;
    data[i * 4 + 3] = 255;
  }
  for (const r of d.rects) {
    const x0 = Math.round(r.x * pxPerMm);
    const x1 = Math.round((r.x + r.w) * pxPerMm);
    const y0 = Math.round(r.y * pxPerMm);
    const y1 = Math.round((r.y + r.h) * pxPerMm);
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
        const o = (y * width + x) * 4;
        data[o] = fg.r;
        data[o + 1] = fg.g;
        data[o + 2] = fg.b;
      }
    }
  }
  return { data, width, height };
}

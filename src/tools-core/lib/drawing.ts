// A tiny vector drawing in millimetres, shared by the QR and barcode engines.
// One source renders to SVG (exact mm size), PDF (pdf-lib, exact size) and PNG (canvas).

export type Rect = { x: number; y: number; w: number; h: number };
export type Text = {
  x: number;
  /** Baseline, from the top. */
  y: number;
  size: number;
  text: string;
  anchor: "start" | "middle" | "end";
};
export type Drawing = {
  widthMm: number;
  heightMm: number;
  fg: string;
  bg: string;
  /** Dark rectangles (bars, modules), top-left origin, mm. */
  rects: Rect[];
  texts: Text[];
  /** Optional centred image (QR logo), as a data URL. */
  image?: Rect & { href: string };
};

export const PT_PER_MM = 72 / 25.4;
export const HRI_FONT = "OCR-B, 'OCR B', Helvetica, Arial, sans-serif";

const r4 = (x: number) => Number(x.toFixed(4)).toString();
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pathFor = (rects: Rect[]) =>
  rects.map((r) => `M${r4(r.x)} ${r4(r.y)}h${r4(r.w)}v${r4(r.h)}h${r4(-r.w)}z`).join("");

/** SVG whose width/height are in mm and whose user unit is 1 mm. */
export function toSvg(d: Drawing, opts: { title?: string } = {}): string {
  const w = r4(d.widthMm);
  const h = r4(d.heightMm);
  const label = opts.title ? ` role="img" aria-label="${esc(opts.title)}"` : "";
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"${label}>`,
  ];
  if (opts.title) parts.push(`<title>${esc(opts.title)}</title>`);
  parts.push(`<rect width="${w}" height="${h}" fill="${esc(d.bg)}"/>`);
  if (d.rects.length) parts.push(`<path fill="${esc(d.fg)}" d="${pathFor(d.rects)}"/>`);
  for (const t of d.texts) {
    parts.push(
      `<text x="${r4(t.x)}" y="${r4(t.y)}" font-size="${r4(t.size)}" font-family="${esc(HRI_FONT)}" text-anchor="${t.anchor}" fill="${esc(d.fg)}">${esc(t.text)}</text>`,
    );
  }
  if (d.image) {
    const i = d.image;
    parts.push(
      `<image href="${esc(i.href)}" x="${r4(i.x)}" y="${r4(i.y)}" width="${r4(i.w)}" height="${r4(i.h)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

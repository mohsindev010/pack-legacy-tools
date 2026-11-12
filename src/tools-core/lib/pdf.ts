// Exact-size vector PDF from a Drawing (pdf-lib). Runs in the browser and in Node (API).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { parseHex } from "./color";
import { PT_PER_MM, type Drawing } from "./drawing";

const colour = (hex: string) => {
  const c = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  return rgb(c.r / 255, c.g / 255, c.b / 255);
};

function dataUrlBytes(href: string): { kind: "png" | "jpg"; bytes: Uint8Array } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.*)$/i.exec(href);
  if (!m) return null;
  const bin = atob(m[2]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { kind: m[1]!.toLowerCase() === "png" ? "png" : "jpg", bytes };
}

/** One page exactly the size of the drawing; 1 mm = 72/25.4 pt. */
export async function toPdf(d: Drawing, title = "Code"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator("Pack Legacy tools");
  doc.setProducer("Pack Legacy tools");
  // Fixed dates keep the output deterministic (API ETag, snapshots).
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  const W = d.widthMm * PT_PER_MM;
  const H = d.heightMm * PT_PER_MM;
  const page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: colour(d.bg) });
  const fg = colour(d.fg);
  for (const r of d.rects) {
    page.drawRectangle({
      x: r.x * PT_PER_MM,
      y: H - (r.y + r.h) * PT_PER_MM,
      width: r.w * PT_PER_MM,
      height: r.h * PT_PER_MM,
      color: fg,
    });
  }
  if (d.texts.length) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const t of d.texts) {
      const size = t.size * PT_PER_MM;
      const w = font.widthOfTextAtSize(t.text, size);
      const x = t.x * PT_PER_MM - (t.anchor === "middle" ? w / 2 : t.anchor === "end" ? w : 0);
      page.drawText(t.text, { x, y: H - t.y * PT_PER_MM, size, font, color: fg });
    }
  }
  const img = d.image && dataUrlBytes(d.image.href);
  if (d.image && img) {
    const embedded =
      img.kind === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const i = d.image;
    const s = Math.min((i.w * PT_PER_MM) / embedded.width, (i.h * PT_PER_MM) / embedded.height);
    const w = embedded.width * s;
    const h = embedded.height * s;
    page.drawImage(embedded, {
      x: i.x * PT_PER_MM + (i.w * PT_PER_MM - w) / 2,
      y: H - (i.y + i.h) * PT_PER_MM + (i.h * PT_PER_MM - h) / 2,
      width: w,
      height: h,
    });
  }
  return doc.save({ useObjectStreams: false });
}

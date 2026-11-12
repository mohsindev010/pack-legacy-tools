"use client";

import { useState } from "react";
import type { Drawing } from "@core/lib/drawing";
import { toSvg } from "@core/lib/drawing";
import { HRI_FONT } from "@core/lib/drawing";
import { track } from "./analytics";
import s from "./tools.module.css";

/** Live preview of a QR code or barcode. Rendered as an <img> (no innerHTML). */
export function CodePreview({ drawing, title }: { drawing: Drawing; title: string }) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(drawing, { title }))}`;
  // Show small codes larger on screen, but never wider than the column.
  const scale = Math.min(8, Math.max(2.5, 280 / drawing.widthMm));
  return (
    <figure className={s.codePreview}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not an optimisable asset */}
      <img
        src={src}
        alt={title}
        width={Math.round(drawing.widthMm * scale)}
        height={Math.round(drawing.heightMm * scale)}
      />
      <figcaption>
        Preview (enlarged). Printed size: {drawing.widthMm.toFixed(2)} x{" "}
        {drawing.heightMm.toFixed(2)} mm
      </figcaption>
    </figure>
  );
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(href: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = href;
  });
}

/** Draw a Drawing on a canvas at `pxPerMm` (PNG export and the QR scan check). */
export async function drawToCanvas(d: Drawing, pxPerMm: number): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = Math.round(d.widthMm * pxPerMm);
  c.height = Math.round(d.heightMm * pxPerMm);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = d.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = d.fg;
  for (const r of d.rects) {
    const x0 = Math.round(r.x * pxPerMm);
    const y0 = Math.round(r.y * pxPerMm);
    ctx.fillRect(
      x0,
      y0,
      Math.round((r.x + r.w) * pxPerMm) - x0,
      Math.round((r.y + r.h) * pxPerMm) - y0,
    );
  }
  for (const t of d.texts) {
    ctx.font = `${t.size * pxPerMm}px ${HRI_FONT}`;
    ctx.textAlign = t.anchor === "middle" ? "center" : t.anchor === "end" ? "right" : "left";
    ctx.fillText(t.text, t.x * pxPerMm, t.y * pxPerMm);
  }
  if (d.image) {
    const img = await loadImage(d.image.href);
    const i = d.image;
    const k = Math.min((i.w * pxPerMm) / img.width, (i.h * pxPerMm) / img.height);
    const w = img.width * k;
    const h = img.height * k;
    ctx.drawImage(
      img,
      i.x * pxPerMm + (i.w * pxPerMm - w) / 2,
      i.y * pxPerMm + (i.h * pxPerMm - h) / 2,
      w,
      h,
    );
  }
  return c;
}

/** SVG, exact-size PDF and PNG downloads, generated in the browser. */
export function DownloadButtons({
  drawing,
  title,
  filename,
  slug,
  disabled,
  pxPerMmHint,
}: {
  drawing: Drawing;
  title: string;
  filename: string;
  slug: string;
  /** Reason downloads are blocked (inverted colours, failed scan check), if any. */
  disabled?: string | null;
  /** Called with the dpi; returns a warning when bars will not land on whole pixels. */
  pxPerMmHint?: (dpi: number) => string | null;
}) {
  const [dpi, setDpi] = useState(600);
  const [busy, setBusy] = useState(false);
  const pngNote = pxPerMmHint?.(dpi) ?? null;

  async function run(format: "svg" | "pdf" | "png") {
    setBusy(true);
    try {
      if (format === "svg") {
        save(new Blob([toSvg(drawing, { title })], { type: "image/svg+xml" }), `${filename}.svg`);
      } else if (format === "pdf") {
        const { toPdf } = await import("@core/lib/pdf");
        const bytes = await toPdf(drawing, title);
        save(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${filename}.pdf`);
      } else {
        const c = await drawToCanvas(drawing, dpi / 25.4);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
        if (blob) save(blob, `${filename}-${dpi}dpi.png`);
      }
      track({ name: "file_downloaded", slug, format });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.downloads}>
      {disabled && (
        <p className={s.muted} role="status">
          Downloads are off: {disabled}
        </p>
      )}
      <div className={s.ctaRow}>
        <button
          type="button"
          className={s.button}
          disabled={!!disabled || busy}
          onClick={() => run("svg")}
        >
          Download SVG
        </button>
        <button
          type="button"
          className={s.buttonSecondary}
          disabled={!!disabled || busy}
          onClick={() => run("pdf")}
        >
          Download PDF (exact size)
        </button>
        <button
          type="button"
          className={s.buttonSecondary}
          disabled={!!disabled || busy}
          onClick={() => run("png")}
        >
          Download PNG
        </button>
        <label className={s.dpi}>
          PNG resolution{" "}
          <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            <option value={300}>300 dpi</option>
            <option value={600}>600 dpi</option>
            <option value={1200}>1200 dpi</option>
          </select>
        </label>
      </div>
      {pngNote && <p className={s.muted}>{pngNote}</p>}
    </div>
  );
}

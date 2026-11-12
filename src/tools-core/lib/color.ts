// Colour maths for print contrast checks (QR and barcodes).

export type Rgb = { r: number; g: number; b: number };

/** Parse #rgb or #rrggbb; null when invalid. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** sRGB channel (0-255) to linear light (0-1). */
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance (0-1), a stand-in for reflectance under white light (phone cameras). */
export const luminance = ({ r, g, b }: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** Reflectance under red light, as a laser or red-LED barcode scanner sees it. */
export const redReflectance = ({ r }: Rgb) => lin(r);

/**
 * Symbol contrast estimate = background reflectance - foreground reflectance (0-1),
 * the quantity ISO/IEC 15415/15416 grade. Negative means inverted (light on dark).
 */
export function symbolContrast(fg: Rgb, bg: Rgb, light: "white" | "red"): number {
  const f = light === "red" ? redReflectance : luminance;
  return f(bg) - f(fg);
}

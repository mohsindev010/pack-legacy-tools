// Shapes and orientations.

export type Dims3 = [number, number, number];

/** Sort three dimensions longest first. Does not mutate the input. */
export function sortDesc(dims: readonly number[]): Dims3 {
  if (dims.length !== 3) throw new RangeError("expected exactly 3 dimensions");
  const [a, b, c] = [...dims].sort((x, y) => y - x) as Dims3;
  return [a, b, c];
}

/** All 6 orientations (l, w, h permutations), de-duplicated for repeated sides. */
export function orientations(l: number, w: number, h: number): Dims3[] {
  const all: Dims3[] = [
    [l, w, h],
    [l, h, w],
    [w, l, h],
    [w, h, l],
    [h, l, w],
    [h, w, l],
  ];
  const seen = new Set<string>();
  return all.filter((o) => {
    const k = o.join("x");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Length plus girth = L + 2W + 2H, where L is the longest side. */
export function lengthPlusGirth(dims: readonly number[]): number {
  const [l, w, h] = sortDesc(dims);
  return l + 2 * w + 2 * h;
}

export const volume = (dims: readonly number[]) => dims.reduce((a, b) => a * b, 1);

/**
 * Does `inner` fit inside `outer`?
 * free: any orientation (compare both sorted descending).
 * upright: `inner[2]` must stay vertical; only length and width may swap.
 */
export function fitsInside(inner: Dims3, outer: Dims3, mode: "free" | "upright" = "free"): boolean {
  if (mode === "free") {
    const i = sortDesc(inner);
    const o = sortDesc(outer);
    return i[0] <= o[0] && i[1] <= o[1] && i[2] <= o[2];
  }
  if (inner[2] > outer[2]) return false;
  const [il, iw] = [Math.max(inner[0], inner[1]), Math.min(inner[0], inner[1])];
  const [ol, ow] = [Math.max(outer[0], outer[1]), Math.min(outer[0], outer[1])];
  return il <= ol && iw <= ow;
}

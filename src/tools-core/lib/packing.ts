// Rectangle-in-rectangle layer packing (pure). Used for cartons on a pallet
// layer and pallets on a container floor.

/** A grid of identical rectangles placed from (x, y). */
export type Block = {
  x: number;
  y: number;
  /** Size of one item along the area's length (x) and width (y). */
  w: number;
  d: number;
  nx: number;
  ny: number;
};

export type Layer = { count: number; blocks: Block[] };

const EPS = 1e-9;
const fl = (x: number) => Math.floor(x + EPS);

function grid(x: number, y: number, L: number, W: number, w: number, d: number): Block | null {
  const nx = fl(L / w);
  const ny = fl(W / d);
  return nx > 0 && ny > 0 ? { x, y, w, d, nx, ny } : null;
}

function layer(blocks: (Block | null)[]): Layer {
  const bs = blocks.filter((b): b is Block => b !== null);
  return { count: bs.reduce((s, b) => s + b.nx * b.ny, 0), blocks: bs };
}

/**
 * Most a × b rectangles (either way round) that fit in an L × W area, using a
 * uniform grid or a two-block pattern: one orientation fills a band, the
 * rotated orientation fills the rest (split along the length or the width).
 * Ties keep the simpler pattern (fewer blocks), then the first found.
 */
export function bestLayer(L: number, W: number, a: number, b: number): Layer {
  let best: Layer = { count: 0, blocks: [] };
  const consider = (o: Layer) => {
    if (
      o.count > best.count ||
      (o.count === best.count && o.count > 0 && o.blocks.length < best.blocks.length)
    )
      best = o;
  };
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    consider(layer([grid(0, 0, L, W, p, q)]));
    // Two-block splits only matter for real carton sizes; skip them when a row
    // would hold thousands of items, so tiny inputs cannot loop for ever.
    const cols = fl(L / p);
    const rows = fl(W / q);
    if (cols > MAX_SPLITS || rows > MAX_SPLITS) continue;
    // Split along the length: i columns of (p × q), then the rest rotated.
    for (let i = 1; i <= cols; i++) {
      const x = i * p;
      consider(layer([grid(0, 0, x, W, p, q), grid(x, 0, L - x, W, q, p)]));
    }
    // Split along the width: j rows of (p × q), then the rest rotated.
    for (let j = 1; j <= rows; j++) {
      const y = j * q;
      consider(layer([grid(0, 0, L, y, p, q), grid(0, y, L, W - y, q, p)]));
    }
  }
  return best;
}

/** Most columns or rows for which two-block splits are tried. */
export const MAX_SPLITS = 2000;

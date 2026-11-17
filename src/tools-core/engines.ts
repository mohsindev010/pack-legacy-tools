import type { z } from "zod";
import type { ToolResult } from "./lib/result";
import { calcDim } from "./tools/dim-weight";
import { findBoxes } from "./tools/box-finder";
import {
  boxFinderFromQuery,
  boxFinderInputSchema,
  boxFinderToQuery,
  type BoxFinderInput,
} from "./schemas/box-finder";
import { convertPaperWeight } from "./tools/paper-weight";
import { generateQr } from "./tools/qr";
import { generateBarcode } from "./tools/barcode";
import { qrFromQuery, qrInputSchema, qrToQuery, type QrInput } from "./schemas/qr";
import {
  barcodeFromQuery,
  barcodeInputSchema,
  barcodeToQuery,
  type BarcodeInput,
} from "./schemas/barcode";
import type { Drawing } from "./lib/drawing";
import { calcBoxVolume } from "./tools/box-volume";
import {
  boxVolumeFromQuery,
  boxVolumeInputSchema,
  boxVolumeToQuery,
  type BoxVolumeInput,
} from "./schemas/box-volume";
import {
  paperWeightFromQuery,
  paperWeightInputSchema,
  paperWeightToQuery,
  type PaperWeightInput,
} from "./schemas/paper-weight";
import {
  dimWeightFromQuery,
  dimWeightInputSchema,
  dimWeightToQuery,
  type DimWeightInput,
} from "./schemas/dim-weight";

/**
 * What each tool plugs in. UI, API and tests all go through this, so one zod
 * schema validates every edge (principle 4) and one engine runs everywhere.
 */
export type ToolEngine<I = unknown, O = unknown> = {
  /** Validates and coerces raw input (query strings arrive as strings). */
  schema: z.ZodType<I>;
  /** The default example, rendered into HTML at build time (principle 6). */
  defaultInput: I;
  /** Pure function: same input, same output (principle 2). */
  run: (input: I) => ToolResult<O>;
  /** Input -> URL query for shareable state (principle 8). */
  toQuery: (input: I) => Record<string, string>;
  /** URL query -> raw input for the schema. */
  fromQuery: (query: Record<string, string>) => unknown;
  /** Code tools: the printable drawing and a file name, for ?format=svg|pdf (section 15). */
  drawing?: (value: O) => { drawing: Drawing; title: string; filename: string } | null;
};

const dimWeightEngine: ToolEngine<DimWeightInput, unknown> = {
  schema: dimWeightInputSchema as unknown as z.ZodType<DimWeightInput>,
  defaultInput: dimWeightInputSchema.parse({ l: 12, w: 9, h: 4, unit: "in", weight: 2.5 }),
  run: calcDim,
  toQuery: dimWeightToQuery,
  fromQuery: dimWeightFromQuery,
};

const boxFinderEngine: ToolEngine<BoxFinderInput, unknown> = {
  schema: boxFinderInputSchema as unknown as z.ZodType<BoxFinderInput>,
  defaultInput: boxFinderInputSchema.parse({ l: 9, w: 6, h: 2.5, unit: "in" }),
  run: findBoxes,
  toQuery: boxFinderToQuery,
  fromQuery: boxFinderFromQuery,
};

const paperWeightEngine: ToolEngine<PaperWeightInput, unknown> = {
  schema: paperWeightInputSchema as unknown as z.ZodType<PaperWeightInput>,
  defaultInput: paperWeightInputSchema.parse({ value: 24, from: "pt", stock: "uncoated" }),
  run: convertPaperWeight,
  toQuery: paperWeightToQuery,
  fromQuery: paperWeightFromQuery,
};

type CodeValue = { drawing: Drawing } | null;

const qrEngine: ToolEngine<QrInput, unknown> = {
  schema: qrInputSchema as unknown as z.ZodType<QrInput>,
  defaultInput: qrInputSchema.parse({ type: "url", url: "https://packlegacy.com/" }),
  run: generateQr,
  toQuery: qrToQuery,
  fromQuery: qrFromQuery,
  drawing: (v) => {
    const q = v as CodeValue & { payload?: string };
    const link = q && /^https?:\/\//.test(q.payload ?? "") ? `: ${q.payload}` : "";
    return q ? { drawing: q.drawing, title: `QR code${link}`, filename: "qr-code" } : null;
  },
};

const barcodeEngine: ToolEngine<BarcodeInput, unknown> = {
  schema: barcodeInputSchema as unknown as z.ZodType<BarcodeInput>,
  defaultInput: barcodeInputSchema.parse({ symbology: "upca", data: "03600029145" }),
  run: generateBarcode,
  toQuery: barcodeToQuery,
  fromQuery: barcodeFromQuery,
  drawing: (v) => {
    const b = v as (CodeValue & { label: string; encoded: string; symbology: string }) | null;
    return b
      ? {
          drawing: b.drawing,
          title: `${b.label} ${b.encoded}`,
          filename: `${b.symbology}-${b.encoded.replace(/[^\w-]+/g, "")}`.slice(0, 60),
        }
      : null;
  },
};

const boxVolumeEngine: ToolEngine<BoxVolumeInput, unknown> = {
  schema: boxVolumeInputSchema as unknown as z.ZodType<BoxVolumeInput>,
  defaultInput: boxVolumeInputSchema.parse({ l: 24, w: 18, h: 12, unit: "in" }),
  run: calcBoxVolume,
  toQuery: boxVolumeToQuery,
  fromQuery: boxVolumeFromQuery,
};

// Engines are registered here as each tool passes step D.
const engines: Partial<Record<string, ToolEngine<unknown, unknown>>> = {
  "dimensional-weight-calculator": dimWeightEngine as unknown as ToolEngine<unknown, unknown>,
  "standard-box-sizes": boxFinderEngine as unknown as ToolEngine<unknown, unknown>,
  "paper-weight-converter": paperWeightEngine as unknown as ToolEngine<unknown, unknown>,
  "qr-code-generator": qrEngine as unknown as ToolEngine<unknown, unknown>,
  "barcode-generator": barcodeEngine as unknown as ToolEngine<unknown, unknown>,
  "box-volume-calculator": boxVolumeEngine as unknown as ToolEngine<unknown, unknown>,
};

export function getEngine(slug: string): ToolEngine<unknown, unknown> | undefined {
  return engines[slug];
}

export type ParseOutcome<I> =
  { ok: true; input: I } | { ok: false; errors: { path: string; message: string }[] };

/** Validate raw values (e.g. from URLSearchParams) with the tool's schema. */
export function parseInput<I>(engine: ToolEngine<I, unknown>, raw: unknown): ParseOutcome<I> {
  const r = engine.schema.safeParse(raw);
  if (r.success) return { ok: true, input: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

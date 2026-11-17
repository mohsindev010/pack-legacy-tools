"use client";

import { useEffect, useMemo, useState } from "react";
import { generateBarcode, type BarcodeValue } from "@core/tools/barcode";
import {
  barcodeFromQuery,
  barcodeInputSchema,
  barcodeToQuery,
  type BarcodeInput,
} from "@core/schemas/barcode";
import { barcodeRules, SYMBOLOGY_IDS, type SymbologyId } from "@core/schemas/codes";
import { roundDisplay } from "@core/lib/round";
import type { ToolResult } from "@core/lib/result";
import { NumberField } from "../NumberField";
import { TextField, SelectField, ColorPair } from "../TextField";
import { ToolForm } from "../ToolForm";
import { ResultCard } from "../ResultCard";
import { QuoteCTA } from "../QuoteCTA";
import { HowItWorks } from "../HowItWorks";
import { CodePreview, DownloadButtons } from "../CodePreview";
import { hashInputs, track } from "../analytics";
import { readQuery, writeQuery } from "../urlState";
import type { WidgetProps } from "./index";
import f from "../form.module.css";
import s from "../tools.module.css";

const SLUG = "barcode-generator";
const specs = barcodeRules.symbologies;

/** A valid example per symbology, loaded when the user switches type. */
export const BARCODE_EXAMPLES: Record<SymbologyId, string> = {
  upca: "03600029145",
  upce: "0425261",
  ean13: "400638133393",
  ean8: "9638507",
  itf14: "1540014128876",
  "gs1-128": "(01)09501101530003(17)271231(10)AB12",
  code128: "PACK-LEGACY-01",
  code39: "PACK123",
  gs1datamatrix: "(01)09501101530003(17)271231(10)AB12",
};

type Fields = {
  symbology: SymbologyId;
  data: string;
  magnification: string;
  xMm: string;
  barHeightPct: string;
  hri: boolean;
  bearer: boolean;
  fg: string;
  bg: string;
};
const DEFAULT: Fields = {
  symbology: "upca",
  data: BARCODE_EXAMPLES.upca,
  magnification: "100",
  xMm: "",
  barHeightPct: "100",
  hri: true,
  bearer: true,
  fg: "#000000",
  bg: "#ffffff",
};

function fromInput(i: BarcodeInput): Fields {
  return {
    symbology: i.symbology,
    data: i.data,
    magnification: String(i.magnification),
    xMm: i.xMm === undefined ? "" : String(i.xMm),
    barHeightPct: String(i.barHeightPct),
    hri: i.hri,
    bearer: i.bearer,
    fg: i.fg.toLowerCase(),
    bg: i.bg.toLowerCase(),
  };
}

const mm = (x: number, dp = 2) => `${roundDisplay(x, dp)} mm`;

export function BarcodeWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`BarcodeWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.d) return;
    const parsed = barcodeInputSchema.safeParse(barcodeFromQuery(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (parsed.success) setFields(fromInput(parsed.data));
  }, []);

  const parsed = useMemo(() => barcodeInputSchema.safeParse(fields), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: generateBarcode(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: BarcodeInput;
    result: ToolResult<BarcodeValue | null>;
  } | null>(current);
  if (current && current !== lastGood) setLastGood(current);
  const shown = current ?? lastGood;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    return e;
  }, [parsed]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      writeQuery(barcodeToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  function switchSymbology(next: SymbologyId) {
    setFields((cur) => ({ ...cur, symbology: next, data: BARCODE_EXAMPLES[next], xMm: "" }));
  }

  const spec = specs[fields.symbology];
  const v = shown?.result.value ?? null;
  const flags = shown?.result.flags ?? [];
  const blocking = flags.find((x) => x.level === "error");

  return (
    <div className={f.widget}>
      <ToolForm label="Barcode settings">
        <SelectField
          label="Barcode type"
          value={fields.symbology}
          onChange={switchSymbology}
          options={SYMBOLOGY_IDS.map((id) => ({ value: id, label: specs[id].label }))}
          hint={spec.use}
        />
        <TextField
          label="Data to encode"
          value={fields.data}
          onChange={(x) => set("data", x)}
          error={errors.data}
          inputMode={
            ["upca", "upce", "ean13", "ean8", "itf14"].includes(fields.symbology)
              ? "numeric"
              : "text"
          }
          hint={
            spec.kind === "ean" || fields.symbology === "itf14"
              ? "Leave off the last digit and we add the check digit."
              : fields.symbology.startsWith("gs1")
                ? "GS1 element string: AI in brackets, then its value."
                : undefined
          }
        />
        <div className={f.fieldRow}>
          {spec.kind === "ean" ? (
            <NumberField
              label="Magnification"
              unit="%"
              value={fields.magnification}
              onChange={(x) => set("magnification", x)}
              error={errors.magnification}
              hint={`${spec.magnification.min}–${spec.magnification.max}%; 100% = X ${spec.xNominalMm} mm`}
            />
          ) : (
            <NumberField
              label="X-dimension (narrow bar)"
              unit="mm"
              value={fields.xMm}
              onChange={(x) => set("xMm", x)}
              error={errors.xMm}
              hint={`${spec.x.minMm}–${spec.x.maxMm} mm; empty = ${spec.x.defaultMm} mm`}
            />
          )}
          {spec.kind !== "matrix" && (
            <NumberField
              label="Bar height"
              unit="%"
              value={fields.barHeightPct}
              onChange={(x) => set("barHeightPct", x)}
              error={errors.barHeightPct}
              hint="100% = full height"
            />
          )}
        </div>
        <fieldset className={f.checks}>
          <legend>Options</legend>
          <label>
            <input
              type="checkbox"
              checked={fields.hri}
              onChange={(e) => set("hri", e.target.checked)}
            />
            Human-readable text
          </label>
          {spec.kind === "linear" && spec.bearerBarMm && (
            <label>
              <input
                type="checkbox"
                checked={fields.bearer}
                onChange={(e) => set("bearer", e.target.checked)}
              />
              Bearer bars ({spec.bearerBarMm} mm frame)
            </label>
          )}
        </fieldset>
        <ColorPair
          fg={fields.fg}
          bg={fields.bg}
          onFg={(x) => set("fg", x)}
          onBg={(x) => set("bg", x)}
          fgLabel="Bar colour"
        />
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={current ? "Your barcode" : "Fix the highlighted fields (showing last result)"}
          headline={v ? `${v.label} ${v.encoded}` : "Cannot encode"}
          values={
            v
              ? [
                  { label: "Printed size", value: `${mm(v.widthMm)} x ${mm(v.heightMm)}` },
                  { label: "X-dimension", value: mm(v.xMm, 3) },
                  ...(v.magnification !== null
                    ? [{ label: "Magnification", value: `${roundDisplay(v.magnification, 1)}%` }]
                    : []),
                  {
                    label: "Quiet zones",
                    value: `${v.quietZoneX[0]}X left, ${v.quietZoneX[1]}X right`,
                  },
                ]
              : []
          }
          flags={flags}
        />
        {v && (
          <>
            <CodePreview drawing={v.drawing} title={`${v.label} barcode ${v.encoded}`} />
            <DownloadButtons
              drawing={v.drawing}
              title={`${v.label} ${v.encoded}`}
              filename={`${v.symbology}-${v.encoded.replace(/[^\w-]+/g, "")}`.slice(0, 60)}
              slug={SLUG}
              disabled={blocking ? blocking.message : null}
              pxPerMmHint={(dpi) => {
                const px = (v.xMm * dpi) / 25.4;
                return Math.abs(px - Math.round(px)) > 0.05
                  ? `At ${dpi} dpi one module is ${roundDisplay(px, 2)} px, so PNG bars are rounded. Use the SVG or PDF for print.`
                  : null;
              }}
            />
            <h3>Then quote the box it goes on</h3>
            <div className={s.ctaRow}>
              <QuoteCTA
                label="Quote printed packaging"
                prefill={{
                  tool: SLUG,
                  details: `Print a ${v.label} barcode (${v.encoded}) at ${mm(v.widthMm)} x ${mm(v.heightMm)}, X ${mm(v.xMm, 3)}.`,
                }}
              />
            </div>
          </>
        )}
        {shown && <HowItWorks steps={shown.result.explain} />}
      </div>
    </div>
  );
}

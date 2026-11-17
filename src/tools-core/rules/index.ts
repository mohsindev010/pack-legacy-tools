// Loads every rules file and extracts its citations, so pages can print
// "Rules effective as of ..." and Sources without anything typed by hand.
import barcodeSpecs from "./barcode-specs.json";
import boxSizes from "./box-sizes.json";
import bulkDensity from "./bulk-density.json";
import carriers from "./carriers.json";
import containers from "./containers.json";
import flutes from "./flutes.json";
import mylarPresets from "./mylar-presets.json";
import o2Absorbers from "./o2-absorbers.json";
import pallets from "./pallets.json";
import paperConversion from "./paper-conversion.json";
import qrSpecs from "./qr-specs.json";
import uspsCubic from "./usps-cubic.json";

export const rulesFiles = {
  "barcode-specs.json": barcodeSpecs,
  "box-sizes.json": boxSizes,
  "bulk-density.json": bulkDensity,
  "carriers.json": carriers,
  "containers.json": containers,
  "flutes.json": flutes,
  "mylar-presets.json": mylarPresets,
  "o2-absorbers.json": o2Absorbers,
  "pallets.json": pallets,
  "paper-conversion.json": paperConversion,
  "qr-specs.json": qrSpecs,
  "usps-cubic.json": uspsCubic,
} as const;

export type RulesFileName = keyof typeof rulesFiles;

export type RuleEntryMeta = {
  file: string;
  path: string;
  source: string;
  sourceUrl: string;
  effectiveFrom: string;
  verifiedOn: string | null;
};

function isRuleEntry(v: unknown): v is Omit<RuleEntryMeta, "file" | "path"> {
  return typeof v === "object" && v !== null && "source" in v && "effectiveFrom" in v;
}

/** Every object in a rules file that carries rule metadata. */
export function ruleEntries(file: string): RuleEntryMeta[] {
  const data = (rulesFiles as Record<string, unknown>)[file];
  if (!data) return [];
  const out: RuleEntryMeta[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node !== "object" || node === null || Array.isArray(node)) return;
    if (isRuleEntry(node)) {
      out.push({
        file,
        path,
        source: node.source,
        sourceUrl: node.sourceUrl,
        effectiveFrom: node.effectiveFrom,
        verifiedOn: node.verifiedOn ?? null,
      });
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(data, "");
  return out;
}

export function rulesVersion(file: string): string | undefined {
  return ((rulesFiles as Record<string, { version?: string }>)[file] ?? {}).version;
}

/** Summary for the RulesEffective block: latest effective date, verification status, unique sources. */
export function rulesSummary(files: string[]) {
  const entries = files.flatMap(ruleEntries);
  const effective = entries.map((e) => e.effectiveFrom).sort();
  const verified = entries
    .map((e) => e.verifiedOn)
    .filter((d): d is string => !!d)
    .sort();
  const sources = new Map<string, string>();
  for (const e of entries)
    if (e.source && !sources.has(e.source)) sources.set(e.source, e.sourceUrl);
  return {
    entries,
    latestEffectiveFrom: effective.at(-1) ?? null,
    lastVerifiedOn: verified.at(-1) ?? null,
    allVerified: entries.length > 0 && entries.every((e) => !!e.verifiedOn),
    unverifiedCount: entries.filter((e) => !e.verifiedOn).length,
    sources: [...sources].map(([source, sourceUrl]) => ({ source, sourceUrl })),
  };
}

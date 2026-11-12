import type { ReactNode } from "react";
import type { FaqItem } from "@/src/components/tools/FAQ";
import type { SourceItem } from "@/src/components/tools/Sources";
import { dimensionalWeightContent } from "./dimensional-weight-calculator";
import { standardBoxSizesContent } from "./standard-box-sizes";
import { paperWeightContent } from "./paper-weight-converter";
import { qrCodeContent } from "./qr-code-generator";
import { barcodeContent } from "./barcode-generator";
import { boxVolumeContent } from "./box-volume-calculator";

/**
 * Editorial content for a tool page (section 9, items 6-11), written in step G.
 * Each tool adds content/tools/<slug>.mdx (or .tsx) and registers it below.
 * Rule: every number must come from rules JSON or a cited source (section 13.4).
 */
export type ToolContent = {
  /** Sentence under the H1: what the tool does and the rule it follows (section 9, item 2). */
  answer?: ReactNode;
  /** One example result for the OG image, computed by the engine. */
  ogLine?: string;
  /** 60-90 words, self-contained, names Pack Legacy once, includes the core formula. */
  keyTakeaway: ReactNode;
  methodology: ReactNode;
  workedExamples: ReactNode;
  referenceTables?: ReactNode;
  commonMistakes: ReactNode;
  faq: FaqItem[];
  extraSources?: SourceItem[];
};

const content: Partial<Record<string, ToolContent>> = {
  "dimensional-weight-calculator": dimensionalWeightContent,
  "standard-box-sizes": standardBoxSizesContent,
  "paper-weight-converter": paperWeightContent,
  "qr-code-generator": qrCodeContent,
  "barcode-generator": barcodeContent,
  "box-volume-calculator": boxVolumeContent,
};

export function getContent(slug: string): ToolContent | undefined {
  return content[slug];
}

import type { ExplainStep } from "./result";
import { roundDisplay } from "./round";

/** Build one readable step: step('12.2 in -> 13 in', { rule: 'ups.dimRounding' }). */
export function step(text: string, opts: { rule?: string; formula?: string } = {}): ExplainStep {
  const s: ExplainStep = { text };
  if (opts.formula) s.formula = opts.formula;
  if (opts.rule) s.ruleRef = opts.rule;
  return s;
}

/** Collects steps in order; engines create one per calculation. */
export class Explainer {
  readonly steps: ExplainStep[] = [];
  add(text: string, opts: { rule?: string; formula?: string } = {}): this {
    this.steps.push(step(text, opts));
    return this;
  }
}

/** "16 x 12 x 8 in" with display rounding. */
export function fmtDims(dims: readonly number[], unit: string, dp = 3): string {
  return `${dims.map((d) => roundDisplay(d, dp)).join(" x ")} ${unit}`;
}

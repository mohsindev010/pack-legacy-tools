// The ToolResult contract (spec section 7.1). Every engine returns this shape;
// UI, API and tests depend on it.

export type ExplainStep = { text: string; formula?: string; ruleRef?: string };

export type FlagLevel = "info" | "warn" | "error";
export type Flag = { level: FlagLevel; code: string; message: string };

export type RuleCitation = {
  id: string;
  effectiveFrom: string;
  source: string;
  sourceUrl: string;
};

export type ToolResult<T> = {
  ok: boolean;
  value: T; // tool-specific output
  explain: ExplainStep[]; // the working, in order
  flags: Flag[]; // surcharges, out-of-scope inputs, print warnings
  rules: RuleCitation[];
};

export function okResult<T>(
  value: T,
  explain: ExplainStep[] = [],
  flags: Flag[] = [],
  rules: RuleCitation[] = [],
): ToolResult<T> {
  // A result carrying an error-level flag is never "ok" (principle 10: honest output).
  return { ok: !flags.some((f) => f.level === "error"), value, explain, flags, rules };
}

export function flag(level: FlagLevel, code: string, message: string): Flag {
  return { level, code, message };
}

/** Rule metadata every rules JSON entry must carry (principle 1). */
export type RuleMeta = {
  source: string;
  sourceUrl: string;
  effectiveFrom: string;
  /** ISO date the value was checked against the primary source; null = not yet verified. */
  verifiedOn: string | null;
};

export function cite(id: string, meta: RuleMeta): RuleCitation {
  return { id, effectiveFrom: meta.effectiveFrom, source: meta.source, sourceUrl: meta.sourceUrl };
}

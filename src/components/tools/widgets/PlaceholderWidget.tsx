import type { ToolMeta } from "@core/registry";
import { ResultCard } from "../ResultCard";

/** Shown until a tool's widget passes step F. */
export function PlaceholderWidget({ tool }: { tool: ToolMeta }) {
  return (
    <ResultCard
      label={`Phase ${tool.phase} · ${tool.status}`}
      headline="Calculator coming soon"
      values={[
        { label: "Answers", value: tool.question },
        { label: "Rules files", value: tool.rulesFiles.join(", ") },
      ]}
      flags={[
        {
          level: "info",
          code: "TOOL_NOT_BUILT",
          message:
            "This tool is in the build pipeline. Its spec must pass Gate 1 before the engine is written.",
        },
      ]}
    />
  );
}

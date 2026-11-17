import type { ExplainStep, Flag } from "@core/lib/result";
import { ExplainSteps } from "./ExplainSteps";
import { FlagList } from "./ResultCard";
import f from "./form.module.css";

/**
 * The working for the current result, always visible under the answer, so
 * users can check every step by hand (tester requirement, 17 Nov 2026).
 */
export function HowItWorks({ steps, notes = [] }: { steps: ExplainStep[]; notes?: Flag[] }) {
  return (
    <section className={f.how} aria-label="How this result was calculated">
      <h3>How this result was calculated</h3>
      <ExplainSteps steps={steps} title={null} />
      <FlagList flags={notes} />
    </section>
  );
}

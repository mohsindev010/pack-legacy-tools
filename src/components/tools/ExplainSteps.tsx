import type { ExplainStep } from "@core/lib/result";
import s from "./tools.module.css";

/** Numbered working with rule references. Same data as the API's explain[]. */
export function ExplainSteps({
  steps,
  title = "How we got this",
}: {
  steps: ExplainStep[];
  /** null renders no heading (when the caller already provides one). */
  title?: string | null;
}) {
  if (steps.length === 0) return null;
  return (
    <div>
      {title && <h3>{title}</h3>}
      <ol className={s.steps}>
        {steps.map((st, i) => (
          <li key={i}>
            {st.text}
            {st.formula && (
              <>
                {" "}
                <code>{st.formula}</code>
              </>
            )}
            {st.ruleRef && <span className={s.ruleRef}>[{st.ruleRef}]</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

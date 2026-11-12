import { rulesSummary } from "@core/rules";
import { formatDate } from "./Byline";

/** "Rules effective as of ..." read from the rules files' effectiveFrom/verifiedOn. */
export function RulesEffective({ rulesFiles }: { rulesFiles: string[] }) {
  const sum = rulesSummary(rulesFiles);
  if (sum.entries.length === 0) {
    return <p>Rules data for this tool has not been added yet.</p>;
  }
  return (
    <p>
      {sum.latestEffectiveFrom && (
        <>
          Rules effective as of{" "}
          <time dateTime={sum.latestEffectiveFrom}>{formatDate(sum.latestEffectiveFrom)}</time>
          .{" "}
        </>
      )}
      {sum.allVerified && sum.lastVerifiedOn ? (
        <>
          Last checked against the primary sources on{" "}
          <time dateTime={sum.lastVerifiedOn}>{formatDate(sum.lastVerifiedOn)}</time>.
        </>
      ) : (
        <strong>
          {sum.unverifiedCount} rule {sum.unverifiedCount === 1 ? "value is" : "values are"} not yet
          verified against the primary source.
        </strong>
      )}
    </p>
  );
}

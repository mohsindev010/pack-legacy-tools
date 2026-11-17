// Carrier and display rounding. Round only where a rule says so; display
// rounding happens last (principle 5).

/**
 * Tolerance for floating-point error before a ceiling. Without it,
 * 0.1 * 3 * 10 = 3.0000000000000004 would ceil to 4.
 */
export const CEIL_EPSILON = 1e-9;

/** Round up to a multiple of `step` (default 1), guarding against float error. */
export function ceilTo(x: number, step = 1): number {
  if (step <= 0) throw new RangeError("step must be > 0");
  const r = Math.ceil(x / step - CEIL_EPSILON) * step;
  // The float guard must not round a real (if tiny) positive value down to 0.
  return x > 0 && r <= 0 ? step : r;
}

/** Round a side up to the next whole unit (inch or cm): 12.2 -> 13. */
export const ceilUnit = (x: number) => ceilTo(x, 1);

/** Round a weight up to the next whole pound (or whole kg). */
export const ceilLb = (x: number) => ceilTo(x, 1);

/** Round a weight up to the next 0.5 kg step. */
export const ceilHalfKg = (x: number) => ceilTo(x, 0.5);

/** Round down to a multiple of `step`, guarding against float error (e.g. 2.9999999 -> 3 when step 1). */
export function floorTo(x: number, step = 1): number {
  if (step <= 0) throw new RangeError("step must be > 0");
  return Math.floor(x / step + CEIL_EPSILON) * step;
}

/** Half-away-from-zero rounding to `dp` decimal places, for display only. */
export function roundTo(x: number, dp = 0): number {
  const f = 10 ** dp;
  const r = Math.round(Math.abs(x) * f + CEIL_EPSILON) / f;
  return x < 0 ? -r : r;
}

// One formatter per precision: toLocaleString(…, options) builds a new
// Intl.NumberFormat on every call, which dominated engine run time.
const formatters = new Map<number, Intl.NumberFormat>();

/** Format a number for display: rounded, thousands separators, trailing zeros trimmed. */
export function roundDisplay(x: number, dp = 2): string {
  let f = formatters.get(dp);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { maximumFractionDigits: dp });
    formatters.set(dp, f);
  }
  return f.format(roundTo(x, dp));
}

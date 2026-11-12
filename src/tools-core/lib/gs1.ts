// GS1 numbering helpers (mod-10 check digit, GTIN padding, UPC-E zero suppression).
// Pure functions; the algorithm is fixed by the GS1 General Specifications.

const DIGITS = /^\d+$/;

/** GS1 mod-10 check digit for a digit string WITHOUT its check digit. */
export function gs1CheckDigit(body: string): number {
  if (!DIGITS.test(body)) throw new RangeError("digits only");
  let sum = 0;
  // From the rightmost digit: weights 3, 1, 3, 1, ...
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** True when the last digit is the correct GS1 check digit. */
export function hasValidCheckDigit(full: string): boolean {
  return (
    DIGITS.test(full) &&
    full.length >= 2 &&
    gs1CheckDigit(full.slice(0, -1)) === Number(full.at(-1))
  );
}

/** GTIN-8/12/13/14 left-padded with zeros to 14 digits (as used in GS1 Digital Link and AI 01). */
export const padGtin14 = (gtin: string) => gtin.padStart(14, "0");

/**
 * Expand a UPC-E (number system + 6 digits, no check digit) to its 11-digit UPC-A body.
 * Returns null when the input is not a valid UPC-E body.
 */
export function upceToUpcaBody(upce: string): string | null {
  if (!/^[01]\d{6}$/.test(upce)) return null;
  const ns = upce[0]!;
  const [d1, d2, d3, d4, d5, d6] = upce.slice(1).split("") as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  let mfr: string;
  let item: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") {
    mfr = d1 + d2 + d6 + "00";
    item = "00" + d3 + d4 + d5;
  } else if (d6 === "3") {
    mfr = d1 + d2 + d3 + "00";
    item = "000" + d4 + d5;
  } else if (d6 === "4") {
    mfr = d1 + d2 + d3 + d4 + "0";
    item = "0000" + d5;
  } else {
    mfr = d1 + d2 + d3 + d4 + d5;
    item = "0000" + d6;
  }
  return ns + mfr + item;
}

/** Zero-suppress an 11-digit UPC-A body to the 7-digit UPC-E body, or null if it cannot be suppressed. */
export function upcaBodyToUpce(body: string): string | null {
  if (!/^[01]\d{10}$/.test(body)) return null;
  const ns = body[0]!;
  const m = body.slice(1, 6);
  const p = body.slice(6, 11);
  let e: string | null = null;
  if (/^\d\d[012]00$/.test(m) && /^00\d{3}$/.test(p)) e = m[0]! + m[1]! + p.slice(2) + m[2]!;
  else if (/^\d{3}00$/.test(m) && /^000\d\d$/.test(p)) e = m.slice(0, 3) + p.slice(3) + "3";
  else if (/^\d{4}0$/.test(m) && /^0000\d$/.test(p)) e = m.slice(0, 4) + p[4]! + "4";
  else if (/^0000[5-9]$/.test(p)) e = m + p[4]!;
  if (e === null) return null;
  // Round-trip guards against the ambiguous cases.
  return upceToUpcaBody(ns + e) === body ? ns + e : null;
}

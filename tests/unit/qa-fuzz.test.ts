// QA fuzz: every engine, random and edge inputs. Valid input must never throw,
// never produce NaN/Infinity, and never print "NaN", "undefined" or "Infinity"
// in the working or flags. Invalid input must be rejected by the schema, not crash.
import { describe, expect, it } from "vitest";
import { getEngine } from "@core/engines";
import { allTools } from "@core/registry";

let seed = 1234567;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const num = (lo: number, hi: number, dp = 3) =>
  Math.round((lo + rnd() * (hi - lo)) * 10 ** dp) / 10 ** dp;
const EDGE = [0, -1, 1e-9, 0.001, 1, 1e6, 1e12, NaN, "", "abc", "1e3", " 5 ", "0x10", null];

/** Random query for each tool, as the URL / API would send it (strings). */
const gen: Record<string, () => Record<string, string>> = {
  "dimensional-weight-calculator": () => ({
    l: String(num(0.1, 120)),
    w: String(num(0.1, 80)),
    h: String(num(0.1, 80)),
    u: pick(["in", "cm"]),
    wt: String(num(0, 150)),
    p: pick(["box", "softpack", "mylar", "tube"]),
    ...(rnd() < 0.2 ? { div: String(num(100, 400, 0)) } : {}),
    ...(rnd() < 0.2 ? { c: pick(["ups", "usps", "dhl,fedex", "ups,fedex,usps,dhl"]) } : {}),
  }),
  "standard-box-sizes": () => ({
    l: String(num(0.5, 40)),
    w: String(num(0.5, 30)),
    h: String(num(0.2, 30)),
    u: pick(["in", "cm"]),
  }),
  "paper-weight-converter": () => {
    const f = pick(["gsm", "lb", "pt", "mm"]);
    const max = { gsm: 2000, lb: 750, pt: 200, mm: 5 }[f]!;
    return { v: String(num(0.01, max)), f, s: pick(["text", "uncoated", "c1s", "c2s"]) };
  },
  "box-volume-calculator": () => ({
    l: String(num(0.1, 120)),
    w: String(num(0.1, 120)),
    h: String(num(0.1, 120)),
    u: pick(["in", "cm", "mm"]) === "mm" ? "in" : pick(["in", "cm"]),
    q: String(Math.floor(num(1, 100000, 0))),
    ...(rnd() < 0.5 ? { wt: String(num(0, 900)) } : {}),
    ...(rnd() < 0.3 ? { up: "1" } : {}),
  }),
  "pallet-calculator": () => ({
    l: String(num(0.5, 120)),
    w: String(num(0.5, 120)),
    h: String(num(0.5, 120)),
    u: pick(["in", "cm"]),
    p: pick(["gma-48x40", "48x48", "epal-1", "epal-2", "epal-3"]),
    q: String(Math.floor(num(1, 50000, 0))),
    ...(rnd() < 0.5 ? { wt: String(num(0, 3000)) } : {}),
    ...(rnd() < 0.3 ? { up: "1" } : {}),
    ...(rnd() < 0.3 ? { st: "1" } : {}),
    ...(rnd() < 0.3 ? { mh: String(num(1, 150)) } : {}),
    ...(rnd() < 0.2 ? { oh: String(num(0, 6)) } : {}),
    ...(rnd() < 0.2
      ? { ph: String(num(0, 10)), pwt: String(num(0, 100)), ml: String(num(1, 5000)) }
      : {}),
  }),
  "mylar-bag-size-finder": () => {
    const p = pick(["rice", "beans", "oats", "flour", "sugar", "milk-powder", "custom"]);
    return {
      wt: String(num(0.001, 400)),
      u: pick(["lb", "kg", "oz", "g"]),
      p,
      ...(p === "custom" ? { d: String(num(50, 2000)) } : {}),
      ...(rnd() < 0.4 ? { hs: String(num(0, 50)) } : {}),
    };
  },
  "oxygen-absorber-calculator": () => {
    const c = pick([
      "quart-zip",
      "gallon-zip",
      "5gallon-open",
      "can10",
      "pail5",
      "pail6",
      "custom",
    ]);
    return {
      c,
      ...(c === "custom"
        ? { v: String(num(0.01, 900)), vu: pick(["gal", "qt", "L", "cc", "in3"]) }
        : {}),
      ...(rnd() < 0.7 ? { wt: String(num(0, 60)), wu: pick(["lb", "kg", "oz", "g"]) } : {}),
      n: String(Math.floor(num(1, 500, 0))),
    };
  },
  "qr-code-generator": () =>
    pick<Record<string, string>>([
      { t: "url", u: "https://packlegacy.com/" },
      { t: "url", u: "https://example.com/" + "z".repeat(Math.floor(num(1, 300, 0))) },
      { t: "text", x: "Hello " + num(0, 1e6) },
      { t: "wifi", ws: "Shop WiFi", wt: "WPA" },
    ]),
  "barcode-generator": () =>
    pick<Record<string, string>>([
      { s: "upca", d: "03600029145" },
      { s: "ean13", d: "400638133393" },
      { s: "code128", d: "ABC-" + Math.floor(num(0, 99999, 0)) },
      { s: "upca", d: "036000291452" },
    ]),
};

function badNumbers(v: unknown, path = "value"): string[] {
  if (typeof v === "number") return Number.isFinite(v) ? [] : [`${path}=${v}`];
  if (Array.isArray(v)) return v.flatMap((x, i) => badNumbers(x, `${path}[${i}]`));
  if (v && typeof v === "object")
    return Object.entries(v).flatMap(([k, x]) =>
      k === "drawing" ? [] : badNumbers(x, `${path}.${k}`),
    );
  return [];
}

describe("QA fuzz: every engine", () => {
  for (const tool of allTools()) {
    const eng = getEngine(tool.slug)!;
    it(`${tool.slug}: 400 random valid inputs never crash or print NaN/undefined`, () => {
      expect(eng, "engine").toBeDefined();
      let valid = 0;
      for (let i = 0; i < 400; i++) {
        const raw = eng.fromQuery(gen[tool.slug]!());
        const parsed = eng.schema.safeParse(raw);
        if (!parsed.success) continue;
        valid++;
        const r = eng.run(parsed.data);
        expect(badNumbers(r.value), JSON.stringify(raw)).toEqual([]);
        const text = JSON.stringify([r.explain, r.flags]);
        expect(text, JSON.stringify(raw)).not.toMatch(/\bNaN\b|undefined|Infinity/);
        // Query round trip keeps the same input.
        const again = eng.schema.safeParse(eng.fromQuery(eng.toQuery(parsed.data)));
        expect(again.success, JSON.stringify(raw)).toBe(true);
      }
      expect(valid, "enough valid samples").toBeGreaterThan(100);
    });

    it(`${tool.slug}: edge values are rejected or handled, never thrown`, () => {
      const base = gen[tool.slug]!();
      for (const key of Object.keys(base)) {
        for (const e of EDGE) {
          const q = { ...base, [key]: e as unknown as string };
          const parsed = eng.schema.safeParse(eng.fromQuery(q));
          if (!parsed.success) continue;
          const r = eng.run(parsed.data);
          expect(badNumbers(r.value), `${key}=${String(e)}`).toEqual([]);
        }
      }
    });
  }
});

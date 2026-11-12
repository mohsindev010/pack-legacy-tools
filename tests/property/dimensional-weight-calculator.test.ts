import { describe, expect, it } from "vitest";
import { calcDim } from "@core/tools/dim-weight";
import {
  dimWeightFromQuery,
  dimWeightInputSchema,
  dimWeightToQuery,
} from "@core/schemas/dim-weight";
import { carrierRules } from "@core/schemas/carriers";

// Deterministic pseudo-random inputs (no Date/Math.random: tests must repeat).
function* cases(count: number) {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < count; i++) {
    yield {
      l: Math.round((1 + rnd() * 60) * 8) / 8,
      w: Math.round((1 + rnd() * 40) * 8) / 8,
      h: Math.round((1 + rnd() * 30) * 8) / 8,
      weight: Math.round(rnd() * 80 * 10) / 10,
    };
  }
}
const parse = (raw: Record<string, unknown>) => dimWeightInputSchema.parse(raw);
const IDS = ["ups", "fedex", "usps", "dhl"] as const;

describe("tool 1 properties", () => {
  it("billable >= rounded actual weight, and >= DIM weight when applied", () => {
    for (const c of cases(300)) {
      const r = calcDim(parse(c));
      for (const id of IDS) {
        const x = r.value.carriers[id]!;
        if (x.billable === null) continue;
        expect(x.billable).toBeGreaterThanOrEqual(x.actual);
        if (x.dimWeight !== null) expect(x.billable).toBeGreaterThanOrEqual(x.dimWeight);
      }
    }
  });

  it("is independent of the order L, W, H are entered", () => {
    for (const c of cases(100)) {
      const a = calcDim(parse(c)).value.carriers;
      const b = calcDim(parse({ ...c, l: c.h, w: c.l, h: c.w })).value.carriers;
      for (const id of IDS) {
        expect(b[id]!.billable).toBe(a[id]!.billable);
        expect(b[id]!.surcharges).toEqual(a[id]!.surcharges);
      }
    }
  });

  it("never bills less when a side grows", () => {
    for (const c of cases(150)) {
      const a = calcDim(parse(c)).value.carriers;
      const b = calcDim(parse({ ...c, l: c.l + 1 })).value.carriers;
      for (const id of IDS) {
        if (a[id]!.billable === null || b[id]!.billable === null) continue;
        expect(b[id]!.billable!).toBeGreaterThanOrEqual(a[id]!.billable!);
      }
    }
  });

  it("is pure: same input, same output", () => {
    const input = parse({ l: 18.3, w: 14, h: 10, weight: 5 });
    expect(calcDim(input)).toEqual(calcDim(input));
  });

  it("gives the same inch-carrier result for the same box in cm and in", () => {
    // 30.48 x 22.86 x 10.16 cm is exactly 12 x 9 x 4 in.
    const a = calcDim(parse({ l: 12, w: 9, h: 4, weight: 2.5 })).value.carriers;
    const b = calcDim(parse({ l: 30.48, w: 22.86, h: 10.16, unit: "cm", weight: 2.5 * 0.45359237 }))
      .value.carriers;
    for (const id of ["ups", "fedex", "usps"] as const)
      expect(b[id]!.billable).toBe(a[id]!.billable);
  });

  it("every right-size suggestion really saves weight", () => {
    for (const c of cases(60)) {
      const r = calcDim(parse(c));
      for (const s of r.value.rightSize) {
        expect(s.to).toBeLessThan(s.from);
        for (const sv of s.savings) expect(sv.after).toBeLessThan(sv.before);
      }
    }
  });
});

describe("tool 1 input schema", () => {
  it("parses a shared URL query and round-trips it", () => {
    const q = { l: "16", w: "12", h: "8", u: "in", wt: "2", c: "ups,usps", div: "166", p: "tube" };
    const input = parse(dimWeightFromQuery(q));
    expect(input).toMatchObject({
      l: 16,
      carriers: ["ups", "usps"],
      contractDivisor: 166,
      packaging: "tube",
    });
    expect(parse(dimWeightFromQuery(dimWeightToQuery(input)))).toEqual(input);
  });

  it("rejects bad input with field paths", () => {
    const bad = dimWeightInputSchema.safeParse({ l: 0, w: 9, h: 250, weight: -1, carriers: [] });
    expect(bad.success).toBe(false);
    const paths = bad.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["l", "weight", "carriers"]));
    expect(
      dimWeightInputSchema.safeParse({ l: 1, w: 1, h: 1, weight: 1, contractDivisor: 50 }).success,
    ).toBe(false);
    expect(dimWeightInputSchema.safeParse({ l: 210, w: 1, h: 1, weight: 1 }).success).toBe(false);
  });

  it("rules file parses and keeps verified USPS data", () => {
    expect(carrierRules.carriers.usps.verifiedOn).toBe("2026-11-12");
    expect(carrierRules.carriers.ups.surcharges.additionalHandling?.volumeGtIn3).toBe(10368);
  });
});

describe("tool 1 via the engine registry (same path as the API)", () => {
  it("runs from a URL query, including product and clearance", async () => {
    const { getEngine, parseInput } = await import("@core/engines");
    const engine = getEngine("dimensional-weight-calculator")!;
    const q = {
      l: "12",
      w: "9",
      h: "4",
      wt: "2.5",
      c: "ups",
      pl: "10",
      pw: "8",
      ph: "2.5",
      cl: "0.25",
    };
    const parsed = parseInput(engine, engine.fromQuery(q));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(engine.fromQuery(engine.toQuery(parsed.input))).toMatchObject({
      product: { l: "10" },
      clearance: "0.25",
    });
    const r = engine.run(parsed.input) as ReturnType<typeof calcDim>;
    // Product height 2.5 + 2 x 0.25 = 3.0 is the floor, so height 4 -> 3 is still allowed.
    expect(r.value.rightSize.find((s) => s.side === "height")?.to).toBe(3);
    // Width 9 -> 8 is below 8 + 0.5, so it is never suggested.
    expect(r.value.rightSize.find((s) => s.side === "width")).toBeUndefined();
    const bad = parseInput(engine, engine.fromQuery({ l: "x", w: "9", h: "4", wt: "1" }));
    expect(bad.ok).toBe(false);
    expect(getEngine("nope")).toBeUndefined();
  });
});

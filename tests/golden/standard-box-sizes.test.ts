// Golden cases from specs/standard-box-sizes.md (Gate 1). Never edit an
// expected value to match the code.
import { describe, expect, it } from "vitest";
import { findBoxes, DEFAULT_BOX_RULES, type BoxFinderRules } from "@core/tools/box-finder";
import { boxFinderInputSchema } from "@core/schemas/box-finder";
import { fitsInside } from "@core/lib/geometry";

const parse = (raw: Record<string, unknown>) => boxFinderInputSchema.parse(raw);

// The spec's test box: a 10 x 8 x 4 in mailer (cases 1-4).
const fixture: BoxFinderRules = {
  ...DEFAULT_BOX_RULES,
  boxes: {
    ...DEFAULT_BOX_RULES.boxes,
    boxes: {
      "test-mailer": {
        id: "test-mailer",
        family: "mailer",
        label: "10 x 8 x 4 in test mailer",
        insideIn: [10, 8, 4],
        source: "Spec golden case",
        sourceUrl: "",
        effectiveFrom: "2026-11-12",
        verifiedOn: "2026-11-12",
      },
    },
  },
};

describe("tool 2 golden cases", () => {
  it("#1 product 9x6x2.5, 1/4 in clearance -> required 9.5x6.5x3; 10x8x4 fits; waste 57.8%", () => {
    const r = findBoxes(parse({ l: 9, w: 6, h: 2.5 }), fixture);
    expect(r.value.requiredIn).toEqual([9.5, 6.5, 3]);
    expect(r.value.clearanceIn).toBe(0.25);
    expect(r.value.matches).toHaveLength(1);
    expect(r.value.matches[0]!.waste).toBeCloseTo(0.578125, 6);
  });

  it("#2 E-flute outside 10.125x8.125x4.125 -> UPS 11x9x5 = 495 -> 4 lb", () => {
    const m = findBoxes(parse({ l: 9, w: 6, h: 2.5 }), fixture).value.matches[0]!;
    expect(m.outsideIn).toEqual([10.125, 8.125, 4.125]);
    expect(m.carriers.ups!.dimWeight).toBe(4);
    expect(m.upsWeight).toBe(4);
  });

  it("#3 exact-fit 9.5x6.5x3 -> outside 9.625x6.625x3.125 -> 3 lb, saves 1 lb", () => {
    const v = findBoxes(parse({ l: 9, w: 6, h: 2.5 }), fixture).value;
    expect(v.exactFit.insideIn).toEqual([9.5, 6.5, 3]);
    expect(v.exactFit.outsideIn).toEqual([9.625, 6.625, 3.125]);
    expect(v.exactFit.carriers.ups!.dimWeight).toBe(3);
    expect(v.exactFitSavingLb).toBe(1);
  });

  it("#4 the same product entered as 2.5 x 9 x 6 gives the same result", () => {
    const a = findBoxes(parse({ l: 9, w: 6, h: 2.5 }), fixture).value;
    const b = findBoxes(parse({ l: 2.5, w: 9, h: 6 }), fixture).value;
    expect(b.matches.map((m) => [m.id, m.waste])).toEqual(a.matches.map((m) => [m.id, m.waste]));
    expect(b.exactFit.carriers.ups!.dimWeight).toBe(a.exactFit.carriers.ups!.dimWeight);
  });

  it("#5 this side up: product 4x4x9 rejects boxes under 9.5 in inside height", () => {
    const upright = findBoxes(parse({ l: 4, w: 4, h: 9, orientation: "upright" })).value;
    const free = findBoxes(parse({ l: 4, w: 4, h: 9 })).value;
    for (const m of upright.matches) expect(m.insideIn[2]).toBeGreaterThanOrEqual(9.5);
    expect(free.totalFits).toBeGreaterThan(upright.totalFits);
  });

  it("#6 product 8x5x1.25, snug 1/8 -> required 8.25x5.25x1.5 fits USPS Small Flat Rate", () => {
    const r = findBoxes(parse({ l: 8, w: 5, h: 1.25, clearance: 0.125, family: "usps-flat-rate" }));
    expect(r.value.requiredIn).toEqual([8.25, 5.25, 1.5]);
    expect(r.value.matches[0]!.id).toBe("usps-fr-small");
    expect(r.value.matches[0]!.outsideSource).toBe("published");
    expect(r.flags.map((f) => f.code)).toContain("FLAT_RATE_NOTE");
  });

  it("#7 product 11.5x11.5x5 -> 12x12x5.5 does NOT fit USPS Large (11 3/4 in)", () => {
    const r = findBoxes(parse({ l: 11.5, w: 11.5, h: 5, family: "usps-flat-rate" }));
    expect(r.value.requiredIn).toEqual([12, 12, 5.5]);
    expect(r.value.matches.map((m) => m.id)).not.toContain("usps-fr-large");
  });

  it("#8 product 30x30x30 -> no stock fit, exact-fit only", () => {
    const r = findBoxes(parse({ l: 30, w: 30, h: 30 }));
    expect(r.value.matches).toEqual([]);
    expect(r.flags.map((f) => f.code)).toContain("NO_STOCK_FIT");
    expect(r.value.exactFit.insideIn).toEqual([30.5, 30.5, 30.5]);
  });
});

describe("tool 2 properties", () => {
  const products = [
    [9, 6, 2.5],
    [3, 2, 1],
    [11, 7, 5.25],
    [15.2, 10.1, 7.7],
    [5, 5, 5],
    [20, 3, 3],
  ] as const;

  it("every match fits, waste is within 0-1, and exact-fit wastes no more than any match", () => {
    for (const [l, w, h] of products) {
      for (const orientation of ["free", "upright"] as const) {
        const v = findBoxes(parse({ l, w, h, orientation })).value;
        for (const m of v.matches) {
          expect(fitsInside(v.requiredIn, m.insideIn, orientation)).toBe(true);
          expect(m.waste).toBeGreaterThanOrEqual(0);
          expect(m.waste).toBeLessThan(1);
          expect(v.exactFit.waste).toBeLessThanOrEqual(m.waste + 1e-9);
        }
      }
    }
  });

  it("matches are ranked by waste", () => {
    for (const [l, w, h] of products) {
      const m = findBoxes(parse({ l, w, h })).value.matches;
      for (let i = 1; i < m.length; i++)
        expect(m[i]!.waste).toBeGreaterThanOrEqual(m[i - 1]!.waste);
    }
  });

  it("billable weight appears only when a weight is entered", () => {
    const without = findBoxes(parse({ l: 9, w: 6, h: 2.5 }));
    const withW = findBoxes(parse({ l: 9, w: 6, h: 2.5, weight: 3 }));
    expect(without.value.matches[0]!.carriers.ups!.billable).toBeNull();
    expect(without.flags.map((f) => f.code)).toContain("WEIGHT_MISSING");
    expect(withW.value.matches[0]!.carriers.ups!.billable).toBeGreaterThanOrEqual(3);
  });

  it("cm input gives the same boxes as the same product in inches", () => {
    const a = findBoxes(parse({ l: 9, w: 6, h: 2.5 })).value.matches.map((m) => m.id);
    const b = findBoxes(
      parse({ l: 22.86, w: 15.24, h: 6.35, unit: "cm", clearance: 0.635 }),
    ).value.matches.map((m) => m.id);
    expect(b).toEqual(a);
  });

  it("runs through the engine registry from a URL query", async () => {
    const { getEngine, parseInput } = await import("@core/engines");
    const e = getEngine("standard-box-sizes")!;
    const p = parseInput(
      e,
      e.fromQuery({ l: "9", w: "6", h: "2.5", o: "upright", f: "rsc", b: "b", wt: "2" }),
    );
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(e.fromQuery(e.toQuery(p.input))).toMatchObject({
      orientation: "upright",
      family: "rsc",
      board: "b",
    });
    expect(parseInput(e, e.fromQuery({ l: "60", w: "1", h: "1" })).ok).toBe(false);
  });
});

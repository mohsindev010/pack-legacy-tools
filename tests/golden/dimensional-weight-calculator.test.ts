// Golden cases from specs/dimensional-weight-calculator.md (Gate 1).
// Never edit an expected value to match the code: fix the code or, if a rule
// changed, update from the official source and log it in CHANGELOG.md.
import { describe, expect, it } from "vitest";
import { calcDim } from "@core/tools/dim-weight";
import { dimWeightInputSchema } from "@core/schemas/dim-weight";

const run = (raw: Record<string, unknown>) => calcDim(dimWeightInputSchema.parse(raw));
const codes = (r: ReturnType<typeof run>, id: "ups" | "fedex" | "usps" | "dhl") =>
  r.value.carriers[id]!.flags.map((f) => f.code);

describe("tool 1 golden cases (2026 rules)", () => {
  it("#1 12x9x4 in, 2.5 lb, UPS & FedEx -> DIM 4, billable 4", () => {
    const r = run({ l: 12, w: 9, h: 4, weight: 2.5, carriers: ["ups", "fedex"] });
    for (const id of ["ups", "fedex"] as const) {
      const c = r.value.carriers[id]!;
      expect(c.volume).toBe(432);
      expect(c.dimWeight).toBe(4);
      expect(c.actual).toBe(3);
      expect(c.billable).toBe(4);
    }
  });

  it("#2 same box, USPS -> under 1 cu ft, billable 3", () => {
    const c = run({ l: 12, w: 9, h: 4, weight: 2.5, carriers: ["usps"] }).value.carriers.usps!;
    expect(c.dimApplied).toBe(false);
    expect(c.dimWeight).toBeNull();
    expect(c.billable).toBe(3);
  });

  it("#3 16x12x8, 2 lb, UPS -> 1,536/139 -> 12", () => {
    expect(
      run({ l: 16, w: 12, h: 8, weight: 2, carriers: ["ups"] }).value.carriers.ups!.billable,
    ).toBe(12);
  });

  it("#4 16x12x8, 2 lb, USPS -> gate -> 2", () => {
    expect(
      run({ l: 16, w: 12, h: 8, weight: 2, carriers: ["usps"] }).value.carriers.usps!.billable,
    ).toBe(2);
  });

  it("#5 12.2x9x4, 2.5 lb, UPS -> sides 13x9x4 -> 4", () => {
    const c = run({ l: 12.2, w: 9, h: 4, weight: 2.5, carriers: ["ups"] }).value.carriers.ups!;
    expect(c.roundedDims).toEqual([13, 9, 4]);
    expect(c.volume).toBe(468);
    expect(c.billable).toBe(4);
  });

  it("#6 18x14x10, 5 lb -> 19 for UPS, FedEx, USPS", () => {
    const r = run({ l: 18, w: 14, h: 10, weight: 5 });
    for (const id of ["ups", "fedex", "usps"] as const)
      expect(r.value.carriers[id]!.billable).toBe(19);
    expect(r.value.carriers.usps!.dimApplied).toBe(true);
  });

  it("#7 40x30x25 cm, 4.2 kg, DHL -> 6 kg", () => {
    const c = run({ l: 40, w: 30, h: 25, unit: "cm", weight: 4.2, carriers: ["dhl"] }).value
      .carriers.dhl!;
    expect(c.volume).toBe(30000);
    expect(c.dimWeight).toBe(6);
    expect(c.actual).toBe(4.5);
    expect(c.billable).toBe(6);
    expect(c.weightUnit).toBe("kg");
  });

  it("#8 40x20x20, 10 lb, UPS -> Additional Handling (L+G and volume), no Large Package", () => {
    const c = run({ l: 40, w: 20, h: 20, weight: 10, carriers: ["ups"] }).value.carriers.ups!;
    expect(c.lengthPlusGirth).toBe(120);
    const ah = c.surcharges.find((s) => s.code === "ADDITIONAL_HANDLING")!;
    expect(ah.reasons).toHaveLength(2);
    expect(c.surcharges.some((s) => s.code === "LARGE_PACKAGE")).toBe(false);
  });

  it("#9 31x24x24, 20 lb, UPS -> Large Package by volume, AHS not added", () => {
    const c = run({ l: 31, w: 24, h: 24, weight: 20, carriers: ["ups"] }).value.carriers.ups!;
    expect(c.volume).toBe(17856);
    expect(c.lengthPlusGirth).toBe(127);
    expect(c.surcharges.map((s) => s.code)).toEqual(["LARGE_PACKAGE"]);
  });

  it("#10 36x17x17, 10 lb -> AHS by volume only, UPS and FedEx", () => {
    const r = run({ l: 36, w: 17, h: 17, weight: 10, carriers: ["ups", "fedex"] });
    for (const id of ["ups", "fedex"] as const) {
      const c = r.value.carriers[id]!;
      expect(c.lengthPlusGirth).toBe(104);
      expect(c.volume).toBe(10404);
      const ah = c.surcharges.find((s) => s.code === "ADDITIONAL_HANDLING")!;
      expect(ah.reasons).toEqual(["volume 10,404 in³ > 10,368"]);
    }
  });

  it("#11 110x10x10 -> over maximum, no billable", () => {
    const r = run({ l: 110, w: 10, h: 10, weight: 5, carriers: ["ups"] });
    expect(r.value.carriers.ups!.billable).toBeNull();
    expect(codes(r, "ups")).toContain("OVER_MAX");
    expect(r.ok).toBe(false);
  });

  it("#12 97x10x10, 20 lb, UPS -> Large Package minimum 90 lb", () => {
    const r = run({ l: 97, w: 10, h: 10, weight: 20, carriers: ["ups"] });
    const c = r.value.carriers.ups!;
    expect(c.dimWeight).toBe(70);
    expect(c.billable).toBe(90);
    expect(codes(r, "ups")).toContain("LARGE_PACKAGE_MIN_APPLIED");
  });

  it("#13 12x12x12, 3 lb, USPS -> exactly 1,728 in³ is not 'exceeding' -> 3", () => {
    const c = run({ l: 12, w: 12, h: 12, weight: 3, carriers: ["usps"] }).value.carriers.usps!;
    expect(c.volume).toBe(1728);
    expect(c.dimApplied).toBe(false);
    expect(c.billable).toBe(3);
  });

  it("#14 12x9x4, 2.5 lb, UPS, contract divisor 166 -> 3", () => {
    const r = run({ l: 12, w: 9, h: 4, weight: 2.5, carriers: ["ups"], contractDivisor: 166 });
    expect(r.value.carriers.ups!.billable).toBe(3);
    expect(r.value.carriers.ups!.divisorSource).toBe("contract");
    expect(codes(r, "ups")).toContain("CONTRACT_DIVISOR");
  });

  it("#15 6-1/8 x 5-7/8 x 6-3/8 box, 2 lb, USPS cubic -> tier 0.2 (DMM example)", () => {
    const cubic = run({ l: 6.125, w: 5.875, h: 6.375, weight: 2, carriers: ["usps"] }).value
      .carriers.usps!.cubic!;
    expect(cubic.measured).toBeCloseTo(215.625 / 1728, 6);
    expect(cubic.tierFt3).toBe(0.2);
    expect(cubic.priorityMail).toBe(true);
    expect(cubic.groundAdvantage).toBe(true);
  });

  it("#16 softpack 12x10, 1 lb -> tier 0.2", () => {
    const cubic = run({ l: 12, w: 10, h: 1, weight: 1, carriers: ["usps"], packaging: "softpack" })
      .value.carriers.usps!.cubic!;
    expect(cubic.measured).toBe(22);
    expect(cubic.tierFt3).toBe(0.2);
  });

  it("#17 24x10x6, 5 lb, USPS -> nonstandard over 22 in, billable 5", () => {
    const r = run({ l: 24, w: 10, h: 6, weight: 5, carriers: ["usps"] });
    expect(r.value.carriers.usps!.billable).toBe(5);
    expect(codes(r, "usps")).toContain("USPS_NONSTANDARD_22");
  });

  it("#18 right-size 12x9x4, 2.5 lb -> cut height 4 -> 3 saves 1 lb at UPS", () => {
    const r = run({ l: 12, w: 9, h: 4, weight: 2.5, carriers: ["ups"] });
    const h = r.value.rightSize.find((s) => s.side === "height")!;
    expect(h.to).toBe(3);
    expect(h.savings).toEqual([{ carrier: "ups", name: "UPS", before: 4, after: 3, unit: "lb" }]);
  });
});

// Tester review 17 Nov 2026: cm/kg input must use each carrier's metric divisor.
describe("tool 1 metric and packaging cases (tester review)", () => {
  it("#19 50x40x30 cm, 3 kg, UPS & FedEx -> 60,000 / 5,000 = 12 kg", () => {
    const r = run({ l: 50, w: 40, h: 30, unit: "cm", weight: 3, carriers: ["ups", "fedex"] });
    for (const id of ["ups", "fedex"] as const) {
      const c = r.value.carriers[id]!;
      expect(c.roundedDims).toEqual([50, 40, 30]);
      expect(c.volume).toBe(60000);
      expect(c.divisor).toBe(5000);
      expect(c.dimWeight).toBe(12);
      expect(c.billable).toBe(12);
      expect(c.weightUnit).toBe("kg");
    }
  });

  it("#20 30x20x15 cm, 2 kg, UPS -> DIM 1.8 -> 2 kg, billable 2 kg (not 5 lb)", () => {
    const c = run({ l: 30, w: 20, h: 15, unit: "cm", weight: 2, carriers: ["ups"] }).value.carriers
      .ups!;
    expect(c.dimWeight).toBe(2);
    expect(c.actual).toBe(2);
    expect(c.billable).toBe(2);
  });

  it("#21 30.4 x 20 x 15 cm, 1.2 kg, UPS -> sides 31 x 20 x 15 -> 9,300 / 5,000 -> 2 kg", () => {
    const c = run({ l: 30.4, w: 20, h: 15, unit: "cm", weight: 1.2, carriers: ["ups"] }).value
      .carriers.ups!;
    expect(c.roundedDims).toEqual([31, 20, 15]);
    expect(c.dimWeight).toBe(2);
    expect(c.actual).toBe(2);
  });

  it("#22 12x9x4 in, 2.5 lb, DHL -> 432 / 139 -> 4 lb", () => {
    const c = run({ l: 12, w: 9, h: 4, weight: 2.5, carriers: ["dhl"] }).value.carriers.dhl!;
    expect(c.divisor).toBe(139);
    expect(c.dimWeight).toBe(4);
    expect(c.billable).toBe(4);
    expect(c.weightUnit).toBe("lb");
  });

  it("#23 130x30x30 cm, 10 kg, UPS -> 52 in longest side still triggers Additional Handling", () => {
    const c = run({ l: 130, w: 30, h: 30, unit: "cm", weight: 10, carriers: ["ups"] }).value
      .carriers.ups!;
    expect(c.weightUnit).toBe("kg");
    expect(c.surcharges.map((s) => s.code)).toEqual(["ADDITIONAL_HANDLING"]);
  });

  it("#24 250x20x20 cm, 10 kg, UPS -> DIM 20 kg, Large Package minimum 90 lb = 41 kg", () => {
    const r = run({ l: 250, w: 20, h: 20, unit: "cm", weight: 10, carriers: ["ups"] });
    expect(r.value.carriers.ups!.dimWeight).toBe(20);
    expect(r.value.carriers.ups!.billable).toBe(41);
    expect(codes(r, "ups")).toContain("LARGE_PACKAGE_MIN_APPLIED");
  });

  it("#25 Mylar pouch 12x10 in, 1 lb, USPS -> soft-pack cubic tier 0.2", () => {
    const cubic = run({ l: 12, w: 10, h: 1, weight: 1, carriers: ["usps"], packaging: "mylar" })
      .value.carriers.usps!.cubic!;
    expect(cubic.measure).toBe("length-plus-width-in");
    expect(cubic.tierFt3).toBe(0.2);
  });
});

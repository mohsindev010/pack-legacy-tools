import { describe, expect, it } from "vitest";
import {
  cm3ToIn3,
  ft3ToM3,
  in3ToCm3,
  in3ToFt3,
  in3ToL,
  in3ToM3,
  inToCm,
  cmToIn,
  lbToKg,
  kgToLb,
  toIn,
  fromIn,
  toLb,
  toKg,
} from "@core/lib/units";
import {
  ceilTo,
  ceilUnit,
  ceilLb,
  ceilHalfKg,
  floorTo,
  roundTo,
  roundDisplay,
} from "@core/lib/round";
import { sortDesc, orientations, lengthPlusGirth, volume, fitsInside } from "@core/lib/geometry";
import { okResult, flag, cite } from "@core/lib/result";
import { step, Explainer, fmtDims } from "@core/lib/explain";

describe("units", () => {
  it("uses exact definitional constants", () => {
    expect(inToCm(1)).toBe(2.54);
    expect(lbToKg(1)).toBe(0.45359237);
    expect(in3ToFt3(1728)).toBe(1);
    expect(in3ToL(1)).toBeCloseTo(0.016387064, 12);
    expect(ft3ToM3(1)).toBeCloseTo(0.028316847, 9);
  });
  it("matches the box-volume golden conversions (12 x 10 x 5 in)", () => {
    const v = 12 * 10 * 5;
    expect(v).toBe(600);
    expect(in3ToFt3(v)).toBeCloseTo(0.3472, 4);
    expect(in3ToL(v)).toBeCloseTo(9.832, 3);
    expect(in3ToM3(v)).toBeCloseTo(0.009832, 6);
  });
  it("round-trips", () => {
    for (const x of [0.1, 1, 12.2, 48, 508]) {
      expect(cmToIn(inToCm(x))).toBeCloseTo(x, 12);
      expect(kgToLb(lbToKg(x))).toBeCloseTo(x, 12);
      expect(cm3ToIn3(in3ToCm3(x))).toBeCloseTo(x, 12);
      expect(fromIn(toIn(x, "mm"), "mm")).toBeCloseTo(x, 12);
    }
  });
  it("converts weights from every unit", () => {
    expect(toLb(16, "oz")).toBe(1);
    expect(toLb(1000, "g")).toBeCloseTo(2.20462262, 8);
    expect(toKg(1, "lb")).toBe(0.45359237);
    expect(toKg(2, "kg")).toBeCloseTo(2, 12);
  });
});

describe("round", () => {
  it("ceils sides to the next whole unit (12.2 -> 13)", () => {
    expect(ceilUnit(12.2)).toBe(13);
    expect(ceilUnit(12)).toBe(12);
  });
  it("guards against float error before a ceiling", () => {
    expect(0.1 * 3 * 10).toBeGreaterThan(3); // 3.0000000000000004
    expect(ceilLb(0.1 * 3 * 10)).toBe(3);
  });
  it("matches DIM golden rounding (432/139 -> 4, 1536/139 -> 12)", () => {
    expect(ceilLb(432 / 139)).toBe(4);
    expect(ceilLb(1536 / 139)).toBe(12);
    expect(ceilLb(30000 / 5000)).toBe(6);
  });
  it("supports half-kg and arbitrary steps", () => {
    expect(ceilHalfKg(2.1)).toBe(2.5);
    expect(ceilHalfKg(2.5)).toBe(2.5);
    expect(ceilTo(9.51, 0.125)).toBe(9.625);
    expect(() => ceilTo(1, 0)).toThrow(RangeError);
    expect(() => floorTo(1, -1)).toThrow(RangeError);
  });
  it("floors with tolerance", () => {
    expect(floorTo(2.9999999999)).toBe(3);
    expect(floorTo(17.99, 0.25)).toBe(17.75);
  });
  it("rounds half away from zero for display", () => {
    expect(roundTo(2.5)).toBe(3);
    expect(roundTo(-2.5)).toBe(-3);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundDisplay(1536.456, 1)).toBe("1,536.5");
    expect(roundDisplay(4, 2)).toBe("4");
  });
});

describe("geometry", () => {
  it("sorts dimensions descending without mutating", () => {
    const d = [4, 12, 9];
    expect(sortDesc(d)).toEqual([12, 9, 4]);
    expect(d).toEqual([4, 12, 9]);
    expect(() => sortDesc([1, 2])).toThrow(RangeError);
  });
  it("lists 6 unique orientations, fewer for repeated sides", () => {
    expect(orientations(1, 2, 3)).toHaveLength(6);
    expect(orientations(2, 2, 3)).toHaveLength(3);
    expect(orientations(2, 2, 2)).toHaveLength(1);
  });
  it("computes length plus girth with L as the longest side", () => {
    expect(lengthPlusGirth([20, 40, 20])).toBe(120); // golden DIM #8
    expect(lengthPlusGirth([31, 24, 24])).toBe(127); // golden DIM #9
    expect(volume([31, 24, 24])).toBe(17856);
  });
  it("checks fit freely and upright", () => {
    expect(fitsInside([9.5, 6.5, 3], [4, 10, 8])).toBe(true);
    expect(fitsInside([3, 9.5, 6.5], [10, 8, 4])).toBe(true); // rotated input, same answer
    expect(fitsInside([9.5, 6.5, 4.5], [10, 8, 4])).toBe(false);
    // "This side up": a 9.5 in tall product does not fit a 10 x 10 x 6 box upright, but does lying down
    expect(fitsInside([4.5, 4.5, 9.5], [10, 10, 6], "upright")).toBe(false);
    expect(fitsInside([4.5, 4.5, 9.5], [10, 10, 6], "free")).toBe(true);
    expect(fitsInside([4.5, 4.4, 9.5], [4.4, 4.5, 10], "upright")).toBe(true);
  });
});

describe("result and explain", () => {
  it("marks results with error flags as not ok", () => {
    expect(okResult(1).ok).toBe(true);
    expect(okResult(1, [], [flag("warn", "W", "w")]).ok).toBe(true);
    expect(okResult(1, [], [flag("error", "E", "e")]).ok).toBe(false);
  });
  it("cites rule metadata", () => {
    expect(
      cite("ups", { source: "S", sourceUrl: "U", effectiveFrom: "2026-01-26", verifiedOn: null }),
    ).toEqual({
      id: "ups",
      source: "S",
      sourceUrl: "U",
      effectiveFrom: "2026-01-26",
    });
  });
  it("builds steps", () => {
    expect(step("12.2 in -> 13 in", { rule: "ups.dimRounding" })).toEqual({
      text: "12.2 in -> 13 in",
      ruleRef: "ups.dimRounding",
    });
    const e = new Explainer().add("a").add("b", { formula: "x" });
    expect(e.steps).toEqual([{ text: "a" }, { text: "b", formula: "x" }]);
    expect(fmtDims([10.125, 8, 4], "in")).toBe("10.125 x 8 x 4 in");
  });
});

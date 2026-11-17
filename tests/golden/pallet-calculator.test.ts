// Golden cases from specs/pallet-calculator.md, worked by hand. Never edit an
// expected value to match the code.
import { describe, expect, it } from "vitest";
import { calcPallet, type PalletValue } from "@core/tools/pallet";
import { palletFromQuery, palletInputSchema, palletToQuery } from "@core/schemas/pallets";
import { bestLayer } from "@core/lib/packing";

const run = (raw: Record<string, unknown>) => calcPallet(palletInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as PalletValue;
const ct = (v: PalletValue, id: string) => v.containers.find((c) => c.id === id)!;
const A = { l: 12, w: 10, h: 8, unit: "in" };

describe("layer packing", () => {
  it("16 x 12 on 48 x 40 -> 10 with a two-block pattern (uniform grid gives 9)", () => {
    expect(bestLayer(48, 40, 16, 12).count).toBe(10);
    expect(bestLayer(48, 40, 16, 12).blocks).toHaveLength(2);
  });
  it("48 x 40 pallets in a 20 ft floor -> 9; EPAL 1 -> 11", () => {
    expect(bestLayer(5898, 2352, 1219.2, 1016).count).toBe(9);
    expect(bestLayer(5898, 2352, 1200, 800).count).toBe(11);
  });
  it("a perfect fit uses one block", () => {
    expect(bestLayer(1200, 800, 400, 300)).toMatchObject({ count: 8 });
    expect(bestLayer(1200, 800, 400, 300).blocks).toHaveLength(1);
  });
});

describe("tool 7 golden cases", () => {
  it("#1 12x10x8 in on GMA, any way up -> 20 per layer x 5 layers = 100 (10 in vertical)", () => {
    const v = val(A);
    expect(v.layer).toMatchObject({ perLayer: 20, vertical: 10 });
    expect(v.layersBySpace).toBe(5);
    expect(v.perPallet).toBe(100);
    expect(v.loadHeight).toBeCloseTo(55.5, 9);
  });

  it("#2 same, this side up -> 16 x 6 = 96, 53.5 in tall", () => {
    const v = val({ ...A, upright: true });
    expect(v.layer!.perLayer).toBe(16);
    expect(v.perPallet).toBe(96);
    expect(v.loadHeight).toBeCloseTo(53.5, 9);
  });

  it("#3 16x12x6 in upright on GMA -> 10 per layer x 9 = 90", () => {
    const v = val({ l: 16, w: 12, h: 6, unit: "in", upright: true });
    expect(v.layer!.perLayer).toBe(10);
    expect(v.perPallet).toBe(90);
  });

  it("#4 40x30x25 cm upright on EPAL 1 -> 8 per layer x 5 = 40", () => {
    const v = val({ l: 40, w: 30, h: 25, unit: "cm", upright: true, pallet: "epal-1" });
    expect(v.pallet.height).toBeCloseTo(14.4, 9);
    expect(v.layer!.perLayer).toBe(8);
    expect(v.perPallet).toBe(40);
    expect(v.areaUsed).toBeCloseTo(1, 9);
  });

  it("#5 12x10x8 at 40 lb -> 2,500 lb load limit allows 62 (4 layers, 2,520 lb gross)", () => {
    const r = run({ ...A, weight: 40 });
    const v = r.value;
    expect(v.weightCap).toBe(62);
    expect(v.perPallet).toBe(62);
    expect(v.limit).toBe("weight");
    expect(v.layersUsed).toBe(4);
    expect(v.loadHeight).toBeCloseTo(45.5, 9);
    expect(v.grossWeight).toBeCloseTo(2520, 9);
    expect(r.flags.map((f) => f.code)).toContain("PALLET_WEIGHT_LIMITED");
  });

  it("#6 GMA pallets of #1: 9 in a 20 ft, 20 in a 40 ft", () => {
    const v = val({ ...A, qty: 5000 });
    expect(ct(v, "20ft")).toMatchObject({ floor: 9, pallets: 9, cartons: 900, levels: 1 });
    expect(ct(v, "40ft")).toMatchObject({ floor: 20, pallets: 20, cartons: 2000 });
    expect(v.palletsNeeded).toBe(50);
    expect(ct(v, "40ft").needed).toBe(3);
  });

  it("#7 EPAL 1 pallets: 11 in a 20 ft, 25 in a 40 ft", () => {
    const v = val({ l: 40, w: 30, h: 25, unit: "cm", upright: true, pallet: "epal-1" });
    expect(ct(v, "20ft").pallets).toBe(11);
    expect(ct(v, "40ft").pallets).toBe(25);
  });

  it("#8 100 in height limit -> 95.5 in load: too tall for 20 ft and 40 ft, fits 40 ft HC", () => {
    const r = run({ ...A, maxHeight: 100 });
    expect(r.value.perPallet).toBe(180);
    expect(r.value.loadHeight).toBeCloseTo(95.5, 9);
    expect(ct(r.value, "20ft")).toMatchObject({ pallets: 0, reason: "TOO_TALL" });
    expect(ct(r.value, "40ft")).toMatchObject({ pallets: 0, reason: "TOO_TALL" });
    expect(ct(r.value, "40hc")).toMatchObject({ pallets: 20, reason: null });
  });

  it("#9 40 in height limit with stacking -> 37.5 in loads, 2 high, 18 in a 20 ft", () => {
    const v = val({ ...A, maxHeight: 40, stack: true });
    expect(v.perPallet).toBe(64);
    expect(v.layer!.vertical).toBe(8);
    expect(ct(v, "20ft")).toMatchObject({ floor: 9, levels: 2, pallets: 18 });
  });

  it("#10 a carton larger than the pallet height limit -> NO_PALLET_FIT", () => {
    const r = run({ l: 70, w: 70, h: 70, unit: "in" });
    expect(r.ok).toBe(false);
    expect(r.value.perPallet).toBe(0);
    expect(r.flags.map((f) => f.code)).toContain("NO_PALLET_FIT");
  });

  it("pallet overrides replace preset values", () => {
    const v = val({ ...A, palletH: 6, maxLoad: 1000, weight: 40 });
    expect(v.pallet.height).toBe(6);
    expect(v.weightCap).toBe(25);
  });

  it("free fit is never less than upright fit, and the URL round-trips", () => {
    for (const [l, w, h] of [
      [12, 10, 8],
      [20, 15, 9],
      [7, 5, 11],
    ]) {
      expect(val({ l, w, h }).perPallet).toBeGreaterThanOrEqual(
        val({ l, w, h, upright: true }).perPallet,
      );
    }
    const i = palletInputSchema.parse({ ...A, weight: 12, qty: 300, stack: true, maxHeight: 50 });
    expect(palletInputSchema.parse(palletFromQuery(palletToQuery(i)))).toEqual(i);
  });
});

describe("tool 7 QA regressions", () => {
  it("preset values come back exact in both unit systems", () => {
    expect(val({ l: 12, w: 10, h: 8, unit: "in" }).pallet).toMatchObject({ length: 48, width: 40 });
    expect(val({ l: 40, w: 30, h: 25, unit: "cm", pallet: "epal-1" }).pallet).toMatchObject({
      length: 120,
      width: 80,
      height: 14.4,
    });
  });
  it("rejects tiny cartons and impossible pallet overrides", () => {
    for (const bad of [
      { ...A, l: 1e-9 },
      { ...A, palletL: 1e-9 },
      { ...A, palletH: 1000 },
      { ...A, palletWeight: 5000 },
      { ...A, maxLoad: 1e9 },
    ])
      expect(palletInputSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
});

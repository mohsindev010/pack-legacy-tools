// Golden cases from specs/box-volume-calculator.md (Gate 1 approved 12 Nov 2026).
// Never edit an expected value to match the code.
import { describe, expect, it } from "vitest";
import { calcBoxVolume, type BoxVolumeValue, type ContainerFit } from "@core/tools/box-volume";
import { boxVolumeInputSchema } from "@core/schemas/box-volume";
import { containerRules } from "@core/schemas/containers";

const run = (raw: Record<string, unknown>) => calcBoxVolume(boxVolumeInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as BoxVolumeValue;
const box = (v: BoxVolumeValue, id: string) =>
  v.containers.find((c) => c.id === id) as ContainerFit;
const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
const codes = (raw: Record<string, unknown>) => run(raw).flags.map((f) => f.code);

const A = { l: 24, w: 18, h: 12, unit: "in" };
const M = { l: 60, w: 40, h: 30, unit: "cm" };

describe("tool 6 rules (Evergreen Line)", () => {
  it("container figures match the approved spec", () => {
    const c = containerRules.containers;
    expect(c["20ft"].insideMm).toEqual([5898, 2352, 2393]);
    expect(c["40ft"].insideMm).toEqual([12032, 2352, 2385]);
    expect(c["40hc"].insideMm).toEqual([12032, 2352, 2690]);
    expect(c["40hc"].doorMm).toEqual([2343, 2585]);
    expect([c["20ft"].payloadKg, c["40ft"].payloadKg, c["40hc"].payloadKg]).toEqual([
      28360, 26480, 26280,
    ]);
  });
});

describe("tool 6 golden cases", () => {
  it("#1 24 x 18 x 12 in -> 5,184 in³, 3 ft³, 84.95 L, 0.0850 m³", () => {
    const p = val(A).perCarton;
    expect(p.in3).toBe(5184);
    expect(p.ft3).toBe(3);
    expect(r(p.liters, 2)).toBe(84.95);
    expect(r(p.m3, 4)).toBe(0.085);
  });

  it("#2 60 x 40 x 30 cm -> 0.0720 m³, 72 L, 4,393.71 in³, 2.543 ft³", () => {
    const p = val(M).perCarton;
    expect(r(p.m3, 6)).toBe(0.072);
    expect(r(p.liters, 2)).toBe(72);
    expect(r(p.in3, 2)).toBe(4393.71);
    expect(r(p.ft3, 3)).toBe(2.543);
  });

  it("#3 24 x 18 x 12 in, 20 ft -> 315 (9 x 5 x 7), 80.6 %, nominal 390", () => {
    const c = box(val(A), "20ft");
    expect(c.fit).toBe(315);
    expect(c.grid).toEqual([9, 5, 7]);
    expect(c.orientation).toEqual([24, 18, 12]);
    expect(r(c.utilisation * 100, 1)).toBe(80.6);
    expect(Math.floor(c.nominalCount)).toBe(390);
  });

  it("#4 40 ft 665 (19 x 5 x 7); 40 HC 780 (39 x 5 x 4, on its 12 x 18 face)", () => {
    const v = val(A);
    expect(box(v, "40ft").fit).toBe(665);
    expect(box(v, "40ft").grid).toEqual([19, 5, 7]);
    expect(box(v, "40hc").fit).toBe(780);
    expect(box(v, "40hc").grid).toEqual([39, 5, 4]);
    expect(box(v, "40hc").orientation).toEqual([12, 18, 24]);
  });

  it("#5 qty 1,000 -> 3,000 ft³ / 84.95 m³; 20 ft x 4 (last 55); 40 HC x 2 (last 220)", () => {
    const v = val({ ...A, qty: 1000 });
    expect(v.total.ft3).toBe(3000);
    expect(r(v.total.m3, 2)).toBe(84.95);
    expect([box(v, "20ft").needed, box(v, "20ft").lastHolds]).toEqual([4, 55]);
    expect([box(v, "40hc").needed, box(v, "40hc").lastHolds]).toEqual([2, 220]);
  });

  it("#6 60 x 40 x 30 cm at 120 kg, 20 ft -> 236, WEIGHT_LIMITED", () => {
    const c = box(val({ ...M, weight: 120 }), "20ft");
    expect(c.spaceCount).toBe(315);
    expect(c.weightCap).toBe(236);
    expect(c.fit).toBe(236);
    expect(c.limit).toBe("weight");
    expect(codes({ ...M, weight: 120 })).toContain("WEIGHT_LIMITED");
  });

  it("#7 same, 40 ft -> space 700, weight 220", () => {
    const c = box(val({ ...M, weight: 120 }), "40ft");
    expect(c.spaceCount).toBe(700);
    expect(c.fit).toBe(220);
    expect(c.limit).toBe("weight");
  });

  it("#8 16 x 12 x 10 in, 40 HC: free 2,106 (39 x 9 x 6); upright 2,030 (29 x 7 x 10)", () => {
    const B = { l: 16, w: 12, h: 10, unit: "in" };
    const free = box(val(B), "40hc");
    const up = box(val({ ...B, upright: true }), "40hc");
    expect([free.fit, free.grid]).toEqual([2106, [39, 9, 6]]);
    expect([up.fit, up.grid]).toEqual([2030, [29, 7, 10]]);
  });

  it("#9 10 x 8 x 4 in, 20 ft -> 6,003 (29 x 9 x 23), 94.8 %", () => {
    const c = box(val({ l: 10, w: 8, h: 4, unit: "in" }), "20ft");
    expect(c.fit).toBe(6003);
    expect(c.grid).toEqual([29, 9, 23]);
    expect(r(c.utilisation * 100, 1)).toBe(94.8);
  });

  it("#10 100 x 100 x 50 in -> 0 in 20 ft and 40 ft; 4 in 40 HC", () => {
    const v = val({ l: 100, w: 100, h: 50, unit: "in" });
    expect(box(v, "20ft")).toMatchObject({ fit: 0, reason: "NO_CONTAINER_FIT", needed: null });
    expect(box(v, "40ft")).toMatchObject({ fit: 0, reason: "NO_CONTAINER_FIT" });
    expect(box(v, "40hc").fit).toBe(4);
    expect(box(v, "40hc").grid).toEqual([4, 1, 1]);
  });
});

describe("tool 6 edge cases and flags", () => {
  it("a carton that fits inside but not through the door gets NO_DOOR_FIT", () => {
    // 2,600 mm tall upright: 40 HC inside height 2,690 but door 2,585.
    const v = val({ l: 1000, w: 1000, h: 2600, unit: "mm", upright: true, containers: "40hc" });
    expect(box(v, "40hc")).toMatchObject({ fit: 0, reason: "NO_DOOR_FIT" });
  });

  it("sides that exactly divide the inside width and match the door height fit", () => {
    // 1,176 x 2 = 2,352 (20 ft inside width); 2,280 = 20 ft door height.
    const v = val({ l: 1176, w: 1176, h: 2280, unit: "mm", upright: true, containers: "20ft" });
    expect(box(v, "20ft").grid).toEqual([5, 2, 1]);
  });

  it("weight 0 means no payload check", () => {
    expect(box(val({ ...M, weight: 0 }), "20ft").weightCap).toBeNull();
  });

  it("ROAD_WEIGHT info above 20,000 kg of cargo", () => {
    expect(codes({ ...M, weight: 120 })).toContain("ROAD_WEIGHT");
    expect(codes({ ...M, weight: 10 })).not.toContain("ROAD_WEIGHT");
  });

  it("always notes uniform stacking and container variation", () => {
    expect(codes(A)).toEqual(expect.arrayContaining(["UNIFORM_STACK", "CONTAINER_VARIES"]));
  });

  it("a light carton is space-limited but still reports weight and payload use", () => {
    // 24 x 18 x 12 in at 20 lb: 20 ft fits 315 by space; 20 lb = 9.0718474 kg.
    const v = val({ ...A, weight: 20, qty: 1000 });
    expect(v.totalWeight).toBe(20000);
    expect(r(v.totalWeightKg!, 2)).toBe(9071.85);
    const c = box(v, "20ft");
    expect(c.limit).toBe("space");
    expect(c.weightCap).toBe(3126); // 28,360 / 9.0718474 = 3,126.2
    expect(r(c.loadKg!, 1)).toBe(2857.6); // 315 x 9.0718474
    expect(r(c.payloadUsed! * 100, 1)).toBe(10.1);
    const steps = run({ ...A, weight: 20 }).explain.map((e) => e.text);
    expect(steps.some((t) => t.includes("so space sets the count"))).toBe(true);
  });

  it("without a weight there is no payload data", () => {
    const v = val(A);
    expect(v.totalWeight).toBeNull();
    expect(box(v, "20ft")).toMatchObject({ weightCap: null, loadKg: null, payloadUsed: null });
  });

  it("lb weights are converted to kg for the payload", () => {
    // 100 lb = 45.359237 kg -> 28,360 / 45.359237 = 625.2
    expect(box(val({ ...A, weight: 100 }), "20ft").weightCap).toBe(625);
  });

  it("rejects bad input", () => {
    expect(boxVolumeInputSchema.safeParse({ ...A, l: 0 }).success).toBe(false);
    expect(boxVolumeInputSchema.safeParse({ ...A, qty: 1.5 }).success).toBe(false);
    expect(boxVolumeInputSchema.safeParse({ ...A, l: 121 }).success).toBe(false);
    expect(boxVolumeInputSchema.safeParse({ ...A, containers: "" }).success).toBe(false);
  });
});

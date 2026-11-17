// Golden cases for tool 8 (mylar bag size finder) and tool 9 (oxygen absorber
// calculator), worked by hand from the rules files. Never edit an expected value
// to match the code.
import { describe, expect, it } from "vitest";
import { findMylarBag, type MylarValue } from "@core/tools/mylar";
import { calcOxygen, planPackets, type O2Value } from "@core/tools/oxygen";
import {
  mylarFromQuery,
  mylarInputSchema,
  mylarToQuery,
  o2FromQuery,
  o2InputSchema,
  o2ToQuery,
} from "@core/schemas/storage";

const bag = (raw: Record<string, unknown>) =>
  findMylarBag(mylarInputSchema.parse(raw)).value as MylarValue;
const o2 = (raw: Record<string, unknown>) => calcOxygen(o2InputSchema.parse(raw));
const ov = (raw: Record<string, unknown>) => o2(raw).value as O2Value;
const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

describe("tool 8 golden cases", () => {
  it("#1 4 lb rice -> 2.356 L, 2.592 L with 10 % headspace -> 1 gallon bag, 62 % full", () => {
    const v = bag({ weight: 4, unit: "lb", product: "rice" });
    expect(r(v.productL, 3)).toBe(2.356);
    expect(r(v.requiredL, 3)).toBe(2.592);
    expect(v.recommended).toBe("gallon-zip");
    const g = v.bags.find((b) => b.id === "gallon-zip")!;
    expect(r(g.fill * 100, 0)).toBe(62);
    expect(r(g.holds, 2)).toBe(5.84); // lb of rice a gallon bag holds
  });

  it("#2 1 lb wheat flour -> 0.832 L -> 1 quart bag", () => {
    const v = bag({ weight: 1, unit: "lb", product: "flour" });
    expect(r(v.requiredL, 3)).toBe(0.832);
    expect(v.recommended).toBe("quart-zip");
  });

  it("#3 30 lb rice -> 19.44 L, more than a 5 gallon bag -> 2 x 5 gallon", () => {
    const res = findMylarBag(mylarInputSchema.parse({ weight: 30, unit: "lb", product: "rice" }));
    expect(r(res.value.requiredL, 2)).toBe(19.44);
    expect(res.value.recommended).toBe("5gallon-open");
    expect(res.value.bagsNeeded).toBe(2);
    expect(res.flags.map((f) => f.code)).toContain("SPLIT_INTO_BAGS");
  });

  it("#4 a 5 gallon bag holds 29.21 lb of rice with 10 % headspace", () => {
    const v = bag({ weight: 1, unit: "lb", product: "rice" });
    expect(r(v.bags.find((b) => b.id === "5gallon-open")!.holds, 2)).toBe(29.21);
  });

  it("#5 custom 500 g/L, 1 kg, no headspace -> 2 L -> 1 gallon", () => {
    const v = bag({ weight: 1, unit: "kg", product: "custom", density: 500, headspace: 0 });
    expect(v.requiredL).toBeCloseTo(2, 12);
    expect(v.recommended).toBe("gallon-zip");
  });

  it("#6 custom product needs a density; URL round-trips", () => {
    expect(mylarInputSchema.safeParse({ weight: 1, product: "custom" }).success).toBe(false);
    const i = mylarInputSchema.parse({ weight: 2, unit: "kg", product: "custom", density: 640 });
    expect(mylarInputSchema.parse(mylarFromQuery(mylarToQuery(i)))).toEqual(i);
  });
});

describe("tool 9 golden cases (Sorbent Systems method)", () => {
  it("#1 5 gallon pail + 35 lb rice -> 3,066 cc air -> 643.9 cc O2 -> one 750 cc", () => {
    const v = ov({ container: "pail5", weight: 35, weightUnit: "lb" });
    expect(r(v.productCc, 0)).toBe(15876);
    expect(r(v.airCc, 0)).toBe(3066);
    expect(r(v.oxygenCc, 1)).toBe(643.9);
    expect(v.perContainer.sizes).toEqual([750]);
  });

  it("#2 empty 1 gallon bag -> 794.9 cc -> one 1,000 cc", () => {
    const v = ov({ container: "gallon-zip" });
    expect(r(v.oxygenCc, 1)).toBe(794.9);
    expect(v.perContainer.sizes).toEqual([1000]);
  });

  it("#3 1 gallon bag + 4 lb rice -> 413.9 cc -> one 500 cc; 10 bags -> 10 x 500 cc", () => {
    const v = ov({ container: "gallon-zip", weight: 4, weightUnit: "lb", count: 10 });
    expect(r(v.oxygenCc, 1)).toBe(413.9);
    expect(v.perContainer.sizes).toEqual([500]);
    expect(v.shoppingList).toEqual([{ sizeCc: 500, packets: 10 }]);
  });

  it("#4 empty #10 can -> 835.8 cc -> one 1,000 cc", () => {
    const v = ov({ container: "can10" });
    expect(r(v.oxygenCc, 1)).toBe(835.8);
    expect(v.perContainer.sizes).toEqual([1000]);
  });

  it("#5 custom 1,000 L empty -> 210,000 cc -> 84 x 2,500 cc", () => {
    const v = ov({ container: "custom", volume: 1000, volumeUnit: "L" });
    expect(r(v.oxygenCc, 6)).toBe(210000);
    expect(v.perContainer.sizes).toHaveLength(84);
    expect(v.perContainer.totalCc).toBe(210000);
  });

  it("#6 packet plans: fewest packets, then smallest total", () => {
    expect(planPackets(1600, [50, 100, 300, 500, 750, 1000, 1500, 2000, 2500]).sizes).toEqual([
      2000,
    ]);
    expect(planPackets(2600, [50, 100, 300, 500, 750, 1000, 1500, 2000, 2500])).toEqual({
      sizes: [2500, 100],
      totalCc: 2600,
    });
    expect(planPackets(0, [100]).sizes).toEqual([]);
  });

  it("#7 single-size options for 643.9 cc", () => {
    const s = ov({ container: "pail5", weight: 35 }).singleSize;
    expect(s.find((x) => x.sizeCc === 300)!.packets).toBe(3);
    expect(s.find((x) => x.sizeCc === 500)!.packets).toBe(2);
    expect(s.find((x) => x.sizeCc === 2000)!.packets).toBe(1);
  });

  it("#8 product heavier than the container's cc -> OVERFULL error", () => {
    const res = o2({ container: "gallon-zip", weight: 10, weightUnit: "kg" });
    expect(res.ok).toBe(false);
    expect(res.flags.map((f) => f.code)).toContain("OVERFULL");
  });

  it("#9 custom container needs a volume; URL round-trips", () => {
    expect(o2InputSchema.safeParse({ container: "custom" }).success).toBe(false);
    const i = o2InputSchema.parse({
      container: "custom",
      volume: 2,
      volumeUnit: "gal",
      weight: 5,
      weightUnit: "kg",
      count: 4,
    });
    expect(o2InputSchema.parse(o2FromQuery(o2ToQuery(i)))).toEqual(i);
  });
});

describe("tools 8 and 9 QA regressions", () => {
  it("reject fills under 1 g and containers under 1 cc", () => {
    expect(mylarInputSchema.safeParse({ weight: 1e-9, unit: "g" }).success).toBe(false);
    expect(mylarInputSchema.safeParse({ weight: 1, unit: "g" }).success).toBe(true);
    expect(
      o2InputSchema.safeParse({ container: "custom", volume: 1e-9, volumeUnit: "cc" }).success,
    ).toBe(false);
  });
});

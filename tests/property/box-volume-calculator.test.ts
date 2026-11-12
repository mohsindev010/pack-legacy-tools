import { describe, expect, it } from "vitest";
import { calcBoxVolume } from "@core/tools/box-volume";
import {
  boxVolumeFromQuery,
  boxVolumeInputSchema,
  boxVolumeToQuery,
} from "@core/schemas/box-volume";

// Deterministic pseudo-random inputs (no Date/Math.random: tests must repeat).
function* cases(count: number) {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < count; i++) {
    yield {
      l: Math.round((1 + rnd() * 100) * 8) / 8,
      w: Math.round((1 + rnd() * 60) * 8) / 8,
      h: Math.round((1 + rnd() * 60) * 8) / 8,
      weight: Math.round(rnd() * 500 * 10) / 10,
      qty: 1 + Math.floor(rnd() * 5000),
    };
  }
}
const run = (raw: Record<string, unknown>) =>
  calcBoxVolume(boxVolumeInputSchema.parse({ unit: "in", ...raw })).value;
const fits = (raw: Record<string, unknown>) => run(raw).containers.map((c) => c.fit);

describe("tool 6 properties", () => {
  it("free-mode fit never changes when L, W, H are permuted", () => {
    for (const { l, w, h } of cases(150)) {
      const a = fits({ l, w, h });
      expect(fits({ l: h, w: l, h: w })).toEqual(a);
      expect(fits({ l: w, w: h, h: l })).toEqual(a);
    }
  });

  it("upright ≤ free; weight never raises fit; volume used ≤ inside volume", () => {
    for (const { l, w, h, weight } of cases(150)) {
      const free = run({ l, w, h });
      const up = run({ l, w, h, upright: true });
      const heavy = run({ l, w, h, weight });
      free.containers.forEach((c, i) => {
        expect(up.containers[i]!.fit).toBeLessThanOrEqual(c.fit);
        expect(heavy.containers[i]!.fit).toBeLessThanOrEqual(c.fit);
        expect(c.utilisation).toBeLessThanOrEqual(1 + 1e-9);
      });
    }
  });

  it("containers needed always hold the quantity, with the last one partly or fully filled", () => {
    for (const { l, w, h, qty } of cases(150)) {
      for (const c of run({ l, w, h, qty }).containers) {
        if (c.fit === 0) continue;
        expect((c.needed! - 1) * c.fit + c.lastHolds!).toBe(qty);
        expect(c.lastHolds!).toBeGreaterThan(0);
        expect(c.lastHolds!).toBeLessThanOrEqual(c.fit);
      }
    }
  });

  it("the same carton in in, cm and mm gives the same volume and fit", () => {
    for (const { l, w, h } of cases(60)) {
      const a = run({ l, w, h });
      const b = run({ l: l * 2.54, w: w * 2.54, h: h * 2.54, unit: "cm" });
      const c = run({ l: l * 25.4, w: w * 25.4, h: h * 25.4, unit: "mm" });
      expect(b.perCarton.m3).toBeCloseTo(a.perCarton.m3, 9);
      expect(c.perCarton.m3).toBeCloseTo(a.perCarton.m3, 9);
      expect(b.containers.map((x) => x.fit)).toEqual(a.containers.map((x) => x.fit));
      expect(c.containers.map((x) => x.fit)).toEqual(a.containers.map((x) => x.fit));
    }
  });

  it("URL query round-trips", () => {
    for (const { l, w, h, weight, qty } of cases(50)) {
      const i = boxVolumeInputSchema.parse({
        l,
        w,
        h,
        weight,
        qty,
        upright: qty % 2 === 0,
        containers: qty % 3 === 0 ? "40hc" : undefined,
      });
      expect(boxVolumeInputSchema.parse(boxVolumeFromQuery(boxVolumeToQuery(i)))).toEqual(i);
    }
  });
});

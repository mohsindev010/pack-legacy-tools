// Golden cases for tool 3, from the worked examples and tables on the Custom Box
// Makers paper weight chart (tester requirement, 17 Nov 2026). Never edit an
// expected value to match the code.
import { describe, expect, it } from "vitest";
import { convertPaperWeight, type PaperWeightValue } from "@core/tools/paper-weight";
import {
  paperWeightFromQuery,
  paperWeightInputSchema,
  paperWeightToQuery,
} from "@core/schemas/paper-weight";

const val = (raw: Record<string, unknown>) =>
  convertPaperWeight(paperWeightInputSchema.parse(raw)).value as PaperWeightValue;
const r = (x: number, dp = 1) => Math.round(x * 10 ** dp) / 10 ** dp;
const gsm = (value: number, stock: string) => val({ value, from: "pt", stock }).gsm;

describe("tool 3 golden cases (Custom Box Makers examples)", () => {
  it("#1 20 pt text stock ≈ 120 GSM", () => expect(gsm(20, "text")).toBe(120));
  it("#2 24 pt uncoated ≈ 336 GSM", () => expect(gsm(24, "uncoated")).toBe(336));
  it("#3 24 pt C1S (medium coating) ≈ 360 GSM", () => expect(gsm(24, "c1s")).toBe(360));
  it("#4 8 pt C2S (medium + high coating) ≈ 132 GSM", () => expect(gsm(8, "c2s")).toBe(132));

  it("#5 the site's PT tables", () => {
    expect([10, 12, 14, 16, 18].map((p) => gsm(p, "text"))).toEqual([60, 72, 84, 96, 108]);
    expect([10, 12, 14, 16, 18].map((p) => gsm(p, "uncoated"))).toEqual([140, 168, 196, 224, 252]);
    expect([10, 12, 14, 16, 18].map((p) => gsm(p, "c1s"))).toEqual([150, 180, 210, 240, 270]);
    expect([10, 12, 14, 16, 18, 20, 22, 24].map((p) => gsm(p, "c2s"))).toEqual([
      165, 198, 231, 264, 297, 330, 363, 396,
    ]);
  });

  it("#6 54 lb text ≈ 80 GSM; 54 lb coated ≈ 146 GSM", () => {
    expect(r(val({ value: 54, from: "lb", stock: "text" }).gsm, 0)).toBe(80);
    expect(r(val({ value: 54, from: "lb", stock: "c1s" }).gsm, 0)).toBe(146);
  });

  it("#7 300 GSM uncoated -> 110.7 lb cover, 21.4 pt, 0.544 mm", () => {
    const v = val({ value: 300, from: "gsm", stock: "uncoated" });
    expect(r(v.lb)).toBe(110.7);
    expect(v.lbBasis).toBe("cover");
    expect(r(v.pt)).toBe(21.4);
    expect(r(v.mm, 3)).toBe(0.544);
  });

  it("#8 300 GSM text -> 202.7 lb text, 50 pt", () => {
    const v = val({ value: 300, from: "gsm", stock: "text" });
    expect(r(v.lb)).toBe(202.7);
    expect(v.lbBasis).toBe("text");
    expect(v.pt).toBe(50);
  });

  it("#9 0.5 mm uncoated -> 19.7 pt -> 275.6 GSM", () => {
    const v = val({ value: 0.5, from: "mm", stock: "uncoated" });
    expect(r(v.pt)).toBe(19.7);
    expect(r(v.gsm)).toBe(275.6);
    expect(v.mm).toBeCloseTo(0.5, 12);
  });

  it("#10 the stock table shows the same GSM on all four stocks", () => {
    const v = val({ value: 336, from: "gsm", stock: "uncoated" });
    expect(v.stocks.map((s) => [s.id, r(s.pt)])).toEqual([
      ["text", 56],
      ["uncoated", 24],
      ["c1s", 22.4],
      ["c2s", 20.4],
    ]);
  });
});

describe("tool 3 round trips and input", () => {
  it("converting the result back gives the input", () => {
    for (const stock of ["text", "uncoated", "c1s", "c2s"]) {
      const a = val({ value: 18, from: "pt", stock });
      expect(val({ value: a.gsm, from: "gsm", stock }).pt).toBeCloseTo(18, 9);
      expect(val({ value: a.lb, from: "lb", stock }).gsm).toBeCloseTo(a.gsm, 9);
      expect(val({ value: a.mm, from: "mm", stock }).gsm).toBeCloseTo(a.gsm, 9);
    }
  });

  it("every result is marked approximate and shows its working", () => {
    const res = convertPaperWeight(paperWeightInputSchema.parse({ value: 24, from: "pt" }));
    expect(res.flags.map((f) => f.code)).toEqual(["APPROXIMATE"]);
    expect(res.explain.length).toBeGreaterThanOrEqual(3);
    expect(res.explain[0]!.formula).toBe("GSM ≈ PT × 1400 / 100");
  });

  it("rejects bad input and round-trips the URL", () => {
    expect(paperWeightInputSchema.safeParse({ value: 0 }).success).toBe(false);
    expect(paperWeightInputSchema.safeParse({ value: 300, from: "pt" }).success).toBe(false);
    const i = paperWeightInputSchema.parse({ value: 16, from: "pt", stock: "c2s" });
    expect(paperWeightInputSchema.parse(paperWeightFromQuery(paperWeightToQuery(i)))).toEqual(i);
  });
});

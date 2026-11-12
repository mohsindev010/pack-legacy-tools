// Golden cases from specs/paper-weight-converter.md (Gate 1). Never edit an
// expected value to match the code.
import { describe, expect, it } from "vitest";
import { convertPaperWeight, ptFromGsm, type PaperWeightValue } from "@core/tools/paper-weight";
import { paperWeightInputSchema } from "@core/schemas/paper-weight";
import { GRADE_IDS, gsmPerLb, paperGradeRules } from "@core/schemas/paper";

const run = (raw: Record<string, unknown>) => convertPaperWeight(paperWeightInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as PaperWeightValue;
const lbIn = (v: PaperWeightValue, id: string) => v.grades.find((g) => g.id === id)!.lb.typical;
const r1 = (x: number) => Math.round(x * 10) / 10;

describe("tool 3 factors", () => {
  it("exact factors derive from the basis ream (D1)", () => {
    const f = Object.fromEntries(GRADE_IDS.map((id) => [id, gsmPerLb(paperGradeRules.grades[id])]));
    expect(f.bond).toBeCloseTo(3.7597, 4);
    expect(f.text).toBeCloseTo(1.4801, 4);
    expect(f.cover).toBeCloseTo(2.7041, 4);
    expect(f.index).toBeCloseTo(1.808, 4);
    expect(f.bristolTag).toBeCloseTo(2.1928, 4);
    expect(f.tissue).toBeCloseTo(1.6953, 4);
    expect(f.newsprint).toBeCloseTo(1.6275, 4);
    expect(f.paperboard).toBeCloseTo(4.8824, 4);
  });
});

describe("tool 3 golden cases", () => {
  it("#1 300 gsm -> 110.9 cover, 79.8 bond, 202.7 text, 165.9 index, 61.4 board", () => {
    const v = val({ value: 300, from: "gsm" });
    expect(r1(lbIn(v, "cover"))).toBe(110.9);
    expect(r1(lbIn(v, "bond"))).toBe(79.8);
    expect(r1(lbIn(v, "text"))).toBe(202.7);
    expect(r1(lbIn(v, "index"))).toBe(165.9);
    expect(r1(lbIn(v, "paperboard"))).toBe(61.4);
  });

  it("#2 80 lb text -> 118.4 gsm", () => {
    expect(r1(val({ value: 80, from: "lb", grade: "text" }).gsm.typical)).toBe(118.4);
  });

  it("#3 100 lb cover -> 270.4 gsm (not 270.8)", () => {
    expect(r1(val({ value: 100, from: "lb", grade: "cover" }).gsm.typical)).toBe(270.4);
  });

  it("#4 12 pt SBS -> typical 256 gsm", () => {
    const v = val({ value: 12, from: "pt", board: "sbs" });
    expect(v.caliperUm.typical).toBeCloseTo(304.8, 6);
    expect(Math.round(v.gsm.typical)).toBe(256);
  });

  it("#5 300 gsm at density 0.70 / 0.84 / 1.00 -> 16.9 / 14.1 / 11.8 pt", () => {
    expect(r1(ptFromGsm(300, 0.7))).toBe(16.9);
    expect(r1(ptFromGsm(300, 0.84))).toBe(14.1);
    expect(r1(ptFromGsm(300, 1))).toBe(11.8);
    const v = val({ value: 300, from: "gsm", board: "sbs" });
    expect(r1(v.caliperPt.typical)).toBe(14.1);
    expect(r1(v.caliperPt.min)).toBe(13.6);
    expect(r1(v.caliperPt.max)).toBe(16.2);
  });

  it("#6 50 lb with no grade -> GRADE_REQUIRED error", () => {
    const r = run({ value: 50, from: "lb" });
    expect(r.ok).toBe(false);
    expect(r.value).toBeNull();
    expect(r.flags.map((f) => f.code)).toEqual(["GRADE_REQUIRED"]);
  });

  it("#7 16 pt SBS -> 297-354 gsm, typical 341", () => {
    const g = val({ value: 16, from: "pt", board: "sbs" }).gsm;
    expect([Math.round(g.min), Math.round(g.typical), Math.round(g.max)]).toEqual([297, 341, 354]);
  });

  it("#8 69 lb / 1,000 sq ft paperboard -> 337 gsm", () => {
    expect(Math.round(val({ value: 69, from: "lb", grade: "paperboard" }).gsm.typical)).toBe(337);
  });

  it("#9 0.5 mm -> 19.7 pt = 500 µm", () => {
    const v = val({ value: 0.5, from: "mm" });
    expect(v.caliperUm.typical).toBeCloseTo(500, 9);
    expect(r1(v.caliperPt.typical)).toBe(19.7);
  });
});

describe("tool 3 properties", () => {
  it("gsm -> lb -> gsm round-trips for every grade", () => {
    for (const gsm of [17, 80, 118.4, 300, 450, 1200]) {
      for (const id of GRADE_IDS) {
        const lb = lbIn(val({ value: gsm, from: "gsm" }), id);
        expect(val({ value: lb, from: "lb", grade: id }).gsm.typical).toBeCloseTo(gsm, 9);
      }
    }
  });

  it("pt <-> mm <-> µm round-trip", () => {
    for (const pt of [8, 12, 18, 24.5]) {
      const v = val({ value: pt, from: "pt" });
      expect(val({ value: v.caliperMm.typical, from: "mm" }).caliperPt.typical).toBeCloseTo(pt, 9);
      expect(val({ value: v.caliperUm.typical, from: "um" }).caliperPt.typical).toBeCloseTo(pt, 9);
    }
  });

  it("a higher density always gives a thinner caliper", () => {
    for (const gsm of [150, 300, 600]) {
      let prev = Infinity;
      for (const d of [0.6, 0.7, 0.8, 0.84, 0.9, 1.1]) {
        const pt = ptFromGsm(gsm, d);
        expect(pt).toBeLessThan(prev);
        prev = pt;
      }
      const c = val({ value: gsm, from: "gsm" }).caliperPt;
      expect(c.min).toBeLessThanOrEqual(c.typical);
      expect(c.typical).toBeLessThanOrEqual(c.max);
    }
  });

  it("weight input is exact; caliper input gives a gsm range", () => {
    const w = val({ value: 300, from: "gsm" });
    expect(w.gsm.min).toBe(w.gsm.max);
    const c = val({ value: 16, from: "pt" });
    expect(c.gsm.min).toBeLessThan(c.gsm.max);
    expect(c.caliperUm.min).toBe(c.caliperUm.max);
  });

  it("flags density estimate and mill-spec note; rejects absurd values", () => {
    const codes = run({ value: 300, from: "gsm" }).flags.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["DENSITY_ESTIMATE", "MILL_SPEC_WINS"]));
    expect(paperWeightInputSchema.safeParse({ value: 6000, from: "gsm" }).success).toBe(false);
    expect(paperWeightInputSchema.safeParse({ value: 300, from: "pt" }).success).toBe(false);
    expect(paperWeightInputSchema.safeParse({ value: 0, from: "gsm" }).success).toBe(false);
  });

  it("runs through the engine registry from a URL query", async () => {
    const { getEngine, parseInput } = await import("@core/engines");
    const e = getEngine("paper-weight-converter")!;
    const p = parseInput(e, e.fromQuery({ v: "16", f: "pt", b: "crb", g: "index" }));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(e.fromQuery(e.toQuery(p.input))).toMatchObject({
      value: "16",
      from: "pt",
      board: "crb",
      grade: "index",
    });
    expect(parseInput(e, e.fromQuery({ v: "abc" })).ok).toBe(false);
  });
});

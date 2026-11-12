// Golden cases from specs/barcode-generator.md (build plan 12.5, sizes verified in the
// GS1 General Specifications). Never edit an expected value to match the code.
import { describe, expect, it } from "vitest";
import { generateBarcode, type BarcodeValue } from "@core/tools/barcode";
import { barcodeInputSchema } from "@core/schemas/barcode";
import { toSvg } from "@core/lib/drawing";
import { toPdf } from "@core/lib/pdf";
import { gs1CheckDigit, upcaBodyToUpce, upceToUpcaBody } from "@core/lib/gs1";

const run = (raw: Record<string, unknown>) => generateBarcode(barcodeInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as BarcodeValue;
const r2 = (x: number) => Math.round(x * 100) / 100;
const errorOf = (raw: Record<string, unknown>) => {
  const p = barcodeInputSchema.safeParse(raw);
  return p.success ? null : p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("tool 5 golden cases", () => {
  it("#1 UPC-A 03600029145 -> check digit 2, 036000291452", () => {
    const v = val({ symbology: "upca", data: "03600029145" });
    expect(v.encoded).toBe("036000291452");
    expect(v.checkDigitAdded).toBe(true);
  });

  it("#2 EAN-13 400638133393 -> check digit 1, 4006381333931", () => {
    expect(val({ symbology: "ean13", data: "400638133393" }).encoded).toBe("4006381333931");
  });

  it("#3 UPC-A at 80% -> X 0.264 mm, width incl. quiet zones 29.83 mm", () => {
    const v = val({ symbology: "upca", data: "03600029145", magnification: 80 });
    expect(v.xMm).toBeCloseTo(0.264, 9);
    expect(r2(v.widthMm)).toBe(29.83);
  });

  it("#4 UPC-A at 100% -> X 0.330 mm, 37.29 x 25.93 mm", () => {
    const v = val({ symbology: "upca", data: "036000291452" });
    expect(v.xMm).toBeCloseTo(0.33, 9);
    expect(v.modules).toBe(95);
    expect(v.quietZoneX).toEqual([9, 9]);
    expect([r2(v.widthMm), r2(v.heightMm)]).toEqual([37.29, 25.93]);
  });

  it("#5 UPC-A at 200% -> X 0.660 mm, width 74.58 mm", () => {
    const v = val({ symbology: "upca", data: "03600029145", magnification: 200 });
    expect(v.xMm).toBeCloseTo(0.66, 9);
    expect(r2(v.widthMm)).toBe(74.58);
  });

  it("#6 UPC-A 036000291453 -> error: wrong check digit (expected 2)", () => {
    expect(errorOf({ symbology: "upca", data: "036000291453" })).toEqual([
      "data: Wrong check digit: expected 2",
    ]);
  });

  it("#7 magnification 70% -> error: below 80% minimum", () => {
    expect(errorOf({ symbology: "upca", data: "03600029145", magnification: 70 })).toEqual([
      "magnification: Below the 80% minimum",
    ]);
  });

  it("#8 fixed input SVG matches the stored snapshot", () => {
    const v = val({ symbology: "upca", data: "03600029145" });
    expect(toSvg(v.drawing, { title: "UPC-A 036000291452" })).toMatchSnapshot();
  });

  it("#9 GS1 nominal sizes: EAN-13 37.29 x 25.93, EAN-8 26.73 x 21.31, UPC-E 22.11 x 25.93", () => {
    const e13 = val({ symbology: "ean13", data: "4006381333931" });
    expect(e13.quietZoneX).toEqual([11, 7]);
    expect([r2(e13.widthMm), r2(e13.heightMm)]).toEqual([37.29, 25.93]);
    const e8 = val({ symbology: "ean8", data: "9638507" });
    expect(e8.encoded).toBe("96385074");
    expect([r2(e8.widthMm), r2(e8.heightMm)]).toEqual([26.73, 21.31]);
    const ue = val({ symbology: "upce", data: "0425261" });
    expect([r2(ue.widthMm), r2(ue.heightMm)]).toEqual([22.11, 25.93]);
  });

  it("#10 ITF-14 at X 0.495: 10X quiet zones, 31.75 mm bars, 4.8 mm bearer bars", () => {
    const v = val({ symbology: "itf14", data: "1540014128876" });
    expect(v.encoded).toBe("15400141288763");
    expect(v.quietZoneX).toEqual([10, 10]);
    expect(v.barHeightMm).toBeCloseTo(31.75, 9);
    const noBearer = val({ symbology: "itf14", data: "1540014128876", bearer: false, hri: false });
    expect(noBearer.heightMm).toBeCloseTo(31.75, 9);
    expect(
      v.widthMm - val({ symbology: "itf14", data: "1540014128876", bearer: false }).widthMm,
    ).toBeCloseTo(9.6, 9);
  });
});

describe("tool 5 data rules", () => {
  it("GS1 check digit: GS1 example GTIN 09501101530003 and UPC-A 03600029145 -> 2", () => {
    expect(gs1CheckDigit("0950110153000")).toBe(3);
    expect(gs1CheckDigit("03600029145")).toBe(2);
  });

  it("UPC-E zero suppression round-trips and refuses numbers that cannot be suppressed", () => {
    for (const e of ["0425261", "0123453", "0123454", "0123455", "1987659"]) {
      const a = upceToUpcaBody(e)!;
      expect(upcaBodyToUpce(a)).toBe(e);
    }
    expect(upcaBodyToUpce("03600029145")).toBeNull();
    expect(val({ symbology: "upce", data: "04252614" }).encoded).toBe("04252614");
    expect(val({ symbology: "upce", data: "04210000526" }).encoded).toBe("04252614");
    expect(errorOf({ symbology: "upce", data: "03600029145" })?.[0]).toContain("zero-suppressed");
  });

  it("GS1-128 and DataMatrix take AI element strings and check the GTIN", () => {
    const g = val({ symbology: "gs1-128", data: "(01)09501101530003(17)271231(10)AB12" });
    expect(g.quietZoneX).toEqual([10, 10]);
    expect(g.barHeightMm).toBeCloseTo(31.75, 9);
    expect(errorOf({ symbology: "gs1-128", data: "0109501101530003" })?.[0]).toContain("brackets");
    expect(errorOf({ symbology: "gs1-128", data: "(01)09501101530004" })?.[0]).toContain(
      "expected 3",
    );
    const dm = val({ symbology: "gs1datamatrix", data: "(01)09501101530003(17)271231" });
    expect(dm.quietZoneX).toEqual([1, 1]);
    expect(dm.xMm).toBeCloseTo(0.495, 9);
  });

  it("character sets: Code 39 uppercase only, Code 128 printable ASCII", () => {
    expect(errorOf({ symbology: "code39", data: "pack" })).not.toBeNull();
    expect(errorOf({ symbology: "code39", data: "PACK-12" })).toBeNull();
    expect(errorOf({ symbology: "code128", data: "Pack-12/a" })).toBeNull();
  });

  it("X-dimension outside the GS1 range is an error", () => {
    expect(errorOf({ symbology: "itf14", data: "1540014128876", xMm: 0.3 })?.[0]).toContain(
      "minimum",
    );
    expect(
      errorOf({ symbology: "gs1-128", data: "(00)095011015300000004", xMm: 1 })?.[0],
    ).toContain("maximum");
  });
});

describe("tool 5 flags and properties", () => {
  it("red bars, low contrast and inverted colours are flagged", () => {
    const codes = (fg: string, bg = "#FFFFFF") =>
      run({ symbology: "upca", data: "03600029145", fg, bg }).flags.map((f) => f.code);
    expect(codes("#000000")).not.toContain("RED_BARS");
    expect(codes("#E00000")).toContain("RED_BARS");
    expect(codes("#003399")).not.toContain("LOW_CONTRAST");
    expect(codes("#FFFFFF", "#000000")).toContain("INVERTED");
    expect(run({ symbology: "upca", data: "03600029145", fg: "#FFFFFF", bg: "#000000" }).ok).toBe(
      false,
    );
  });

  it("truncated bars warn; every GTIN symbology shows the GS1 licence note", () => {
    const t = run({ symbology: "upca", data: "03600029145", barHeightPct: 60 });
    expect(t.flags.map((f) => f.code)).toContain("TRUNCATED");
    expect(t.flags.map((f) => f.code)).toContain("GS1_LICENCE");
    expect(run({ symbology: "code128", data: "A1" }).flags.map((f) => f.code)).not.toContain(
      "GS1_LICENCE",
    );
  });

  it("size scales linearly with magnification", () => {
    const w100 = val({ symbology: "ean13", data: "400638133393" }).widthMm;
    for (const m of [80, 100, 125, 150, 200]) {
      expect(
        val({ symbology: "ean13", data: "400638133393", magnification: m }).widthMm,
      ).toBeCloseTo((w100 * m) / 100, 9);
    }
  });

  it("every bar lies inside the quiet zones and the drawing", () => {
    const v = val({ symbology: "ean13", data: "400638133393" });
    const minX = Math.min(...v.drawing.rects.map((r) => r.x));
    const maxX = Math.max(...v.drawing.rects.map((r) => r.x + r.w));
    expect(minX).toBeCloseTo(11 * v.xMm, 9);
    expect(v.widthMm - maxX).toBeCloseTo(7 * v.xMm, 9);
  });

  it("PDF export is exactly the symbol size", async () => {
    const v = val({ symbology: "upca", data: "03600029145" });
    const bytes = await toPdf(v.drawing, "UPC-A");
    const text = new TextDecoder("latin1").decode(bytes);
    const box = /\/MediaBox \[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(text)!;
    expect(Number(box[1])).toBeCloseTo((37.29 * 72) / 25.4, 1);
    expect(Number(box[2])).toBeCloseTo((25.93 * 72) / 25.4, 1);
  });

  it("runs through the engine registry from a URL query", async () => {
    const { getEngine, parseInput } = await import("@core/engines");
    const e = getEngine("barcode-generator")!;
    const p = parseInput(e, e.fromQuery({ s: "ean13", d: "400638133393", m: "150", fg: "003399" }));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(e.fromQuery(e.toQuery(p.input))).toMatchObject({
      symbology: "ean13",
      data: "400638133393",
      magnification: "150",
      fg: "#003399",
    });
  });
});

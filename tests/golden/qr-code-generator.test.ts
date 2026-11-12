// Golden cases from specs/qr-code-generator.md (build plan 12.4). Never edit an
// expected value to match the code.
import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { buildPayload, generateQr, type QrValue } from "@core/tools/qr";
import { qrFromQuery, qrInputSchema, qrToQuery } from "@core/schemas/qr";
import { toSvg } from "@core/lib/drawing";
import { rasterize } from "@core/lib/raster";

const parse = (raw: Record<string, unknown>) => qrInputSchema.parse(raw);
const run = (raw: Record<string, unknown>) => generateQr(parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as QrValue;
const codes = (raw: Record<string, unknown>) => run(raw).flags.map((f) => f.code);
const PL = { type: "url", url: "https://packlegacy.com/" };

/** Decode the rendered symbol the way a scanner would. */
function decode(v: QrValue): string | null {
  const r = rasterize(v.drawing, 8 / v.moduleMm); // 8 px per module
  return jsQR(r.data, r.width, r.height)?.data ?? null;
}

describe("tool 4 golden cases", () => {
  it("#1 scan distance 30 cm -> minimum print size 3.0 cm (10:1 rule)", () => {
    expect(val({ ...PL, distanceCm: 30 }).minSizeMm).toBeCloseTo(30, 9);
    expect(val({ ...PL, distanceCm: 10 }).minSizeMm).toBeCloseTo(20, 9); // 2 cm floor
  });

  it("#2 https://packlegacy.com/ at M, 3 cm -> version 2 (25 x 25), module 0.91 mm", () => {
    const v = val({ ...PL, ec: "M", sizeCm: 3 });
    expect(v.version).toBe(2);
    expect(v.modules).toBe(25);
    expect(v.moduleMm).toBeCloseTo(30 / 33, 9);
    expect(Math.round(v.moduleMm * 100) / 100).toBe(0.91);
  });

  it("#3 same at 2 cm -> module 0.61 mm, no module-size warning", () => {
    const v = val({ ...PL, sizeCm: 2 });
    expect(Math.round(v.moduleMm * 100) / 100).toBe(0.61);
    expect(codes({ ...PL, sizeCm: 2 })).not.toContain("MODULE_TOO_SMALL");
    expect(codes({ ...PL, sizeCm: 2 })).toContain("TOO_SMALL_FOR_DISTANCE"); // 2 cm < 3 cm at 30 cm
  });

  it("#4 white on black -> error: inverted colours", () => {
    const r = run({ ...PL, fg: "#FFFFFF", bg: "#000000" });
    expect(r.ok).toBe(false);
    expect(r.flags.map((f) => f.code)).toContain("INVERTED");
  });

  it("#5 GTIN 0036000291452 (13 digits) -> padded 00036000291452 in the Digital Link", () => {
    const p = buildPayload(
      parse({ type: "gs1", domain: "https://example.com", gtin: "0036000291452" }),
    );
    expect(p).toBe("https://example.com/01/00036000291452");
  });

  it("#6 fixed input SVG matches the stored snapshot", () => {
    expect(toSvg(val(PL).drawing, { title: "QR code" })).toMatchSnapshot();
  });

  it("#7 Digital Link keeps the GS1 order: /01/ /10/ /21/ then ?17=", () => {
    const p = buildPayload(
      parse({
        type: "gs1",
        domain: "https://id.gs1.org/",
        gtin: "09520123456788",
        lot: "ABC1",
        serial: "12345",
        expiry: "180426",
      }),
    );
    // The GS1 Digital Link URI Syntax example (section 4.10).
    expect(p).toBe("https://id.gs1.org/01/09520123456788/10/ABC1/21/12345?17=180426");
  });

  it("#8 every content type decodes back to its payload", () => {
    const cases: Record<string, unknown>[] = [
      PL,
      { ...PL, utmSource: "box", utmMedium: "print", utmCampaign: "spring 26" },
      { type: "text", text: "Batch 42 — keep dry" },
      { type: "email", email: "hello@example.com", subject: "Order 12" },
      { type: "phone", phone: "+1 (555) 123-4567" },
      { type: "sms", phone: "+15551234567", smsBody: "Hi" },
      { type: "wifi", ssid: "Warehouse; 2", password: "p@ss:word", security: "WPA" },
      {
        type: "vcard",
        firstName: "Sam",
        lastName: "Lee",
        org: "Example Co",
        vPhone: "+15551234567",
      },
      { type: "gs1", domain: "https://example.com", gtin: "09501101530003", lot: "A 1" },
    ];
    for (const c of cases) {
      const v = val(c);
      expect(decode(v), JSON.stringify(c)).toBe(v.payload);
    }
  });
});

describe("tool 4 payloads and properties", () => {
  it("builds the standard payload formats", () => {
    expect(buildPayload(parse({ ...PL, utmSource: "box", utmCampaign: "a b" }))).toBe(
      "https://packlegacy.com/?utm_source=box&utm_campaign=a+b",
    );
    expect(buildPayload(parse({ type: "phone", phone: "+1 (555) 123-4567" }))).toBe(
      "tel:+15551234567",
    );
    expect(buildPayload(parse({ type: "wifi", ssid: "A;B", password: "x:y", hidden: true }))).toBe(
      "WIFI:T:WPA;S:A\\;B;P:x\\:y;H:true;;",
    );
    expect(buildPayload(parse({ type: "wifi", ssid: "Guest", security: "nopass" }))).toBe(
      "WIFI:T:nopass;S:Guest;;",
    );
    expect(buildPayload(parse({ type: "email", email: "a@b.co", subject: "Hi there" }))).toBe(
      "mailto:a@b.co?subject=Hi%20there",
    );
  });

  it("a logo forces level H, clears the centre, and still decodes", () => {
    const v = val({ ...PL, logo: true, ec: "M" });
    expect(v.ec).toBe("H");
    expect(v.logoBox).not.toBeNull();
    expect(codes({ ...PL, logo: true, ec: "M" })).toContain("LOGO_FORCES_H");
    expect(decode(v)).toBe(v.payload);
  });

  it("validation: bad URL, GTIN check digit, expiry format, too much data", () => {
    expect(qrInputSchema.safeParse({ type: "url", url: "packlegacy" }).success).toBe(false);
    const g = qrInputSchema.safeParse({
      type: "gs1",
      domain: "https://example.com",
      gtin: "09501101530004",
    });
    expect(g.success).toBe(false);
    if (!g.success) expect(g.error.issues[0]!.message).toContain("expected 3");
    expect(
      qrInputSchema.safeParse({
        type: "gs1",
        domain: "https://example.com",
        gtin: "09501101530003",
        expiry: "271331",
      }).success,
    ).toBe(false);
    expect(qrInputSchema.safeParse({ ...PL, quietZone: 2 }).success).toBe(false);
    const big = run({ type: "text", text: "x".repeat(1500), ec: "H" });
    expect(big.ok).toBe(false);
    expect(big.flags.map((f) => f.code)).toEqual(["DATA_TOO_LONG"]);
  });

  it("module size grows with print size; higher EC means more modules", () => {
    const a = val({ ...PL, sizeCm: 2 }).moduleMm;
    const b = val({ ...PL, sizeCm: 4 }).moduleMm;
    expect(b).toBeCloseTo(2 * a, 9);
    const sizes = (["L", "M", "Q", "H"] as const).map(
      (ec) => val({ type: "text", text: "x".repeat(60), ec }).modules,
    );
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]!);
  });

  it("low contrast warns; tiny modules warn", () => {
    expect(codes({ ...PL, fg: "#CCCCCC" })).toContain("LOW_CONTRAST");
    expect(codes({ type: "text", text: "x".repeat(400), sizeCm: 2 })).toContain("MODULE_TOO_SMALL");
  });

  it("the URL never carries the Wi-Fi password, and round-trips everything else", () => {
    const i = parse({ type: "wifi", ssid: "Shop", password: "secret", ec: "Q", sizeCm: 4 });
    const q = qrToQuery(i);
    expect(Object.values(q).join(" ")).not.toContain("secret");
    expect(qrFromQuery(q)).toMatchObject({ type: "wifi", ssid: "Shop", ec: "Q", sizeCm: "4" });
    expect(qrInputSchema.parse(qrFromQuery(qrToQuery(parse(PL))))).toEqual(parse(PL));
  });

  it("runs through the engine registry, and the drawing hook names the file", async () => {
    const { getEngine, parseInput } = await import("@core/engines");
    const e = getEngine("qr-code-generator")!;
    const p = parseInput(e, e.fromQuery({ t: "url", u: "https://packlegacy.com/", ec: "H" }));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const d = e.drawing!(e.run(p.input).value);
    expect(d?.filename).toBe("qr-code");
    expect(d?.drawing.widthMm).toBe(30);
  });
});

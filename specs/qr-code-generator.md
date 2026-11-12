# Spec: QR Code Generator for Packaging

- Slug: `/tools/qr-code-generator/`
- Status: **Built 12 Nov 2026; awaiting Gate 2.** Spec and build in one pass on the owner's instruction ("make the qr code and barcode in one go"); decisions D1–D5 below use Claude's recommendations and are open for review at Gate 2.
- Rules files: `qr-specs.json`
- Research date: 12 Nov 2026

## A. Market

- Working keyword: qr code generator for packaging (secondary: QR code size for print, GS1 QR code generator).
- Gap (build plan section 5): the current Pack Legacy generator is PNG only, 4 fixed colours, no logo, no GS1 Digital Link, no print-size guidance.
- Our edge: vector SVG and exact-size PDF, 10:1 size check, GS1 module minimum, contrast check, GS1 Digital Link builder, and a decode check before download.

## B. Inputs

| Input | Type | Default | Validation |
|-------|------|---------|------------|
| Content type | url, text, email, phone, sms, wifi, vcard, gs1 | url | per type |
| URL + UTM | absolute http(s) URL; utm_source / medium / campaign | https://packlegacy.com/ | must parse, host has a dot |
| GS1 Digital Link | domain, GTIN (8/12/13/14), lot, serial, expiry YYMMDD | id.gs1.org | GTIN check digit; expiry date format |
| Error correction | L, M, Q, H | M | logo forces H |
| Colours | foreground, background | #000 on #FFF | inverted = error; contrast < 40% = warning |
| Logo | PNG/JPG ≤ 2 MB | none | stays in the browser |
| Printed size / scan distance | cm | 3 / 30 | > 0 |
| Quiet zone | modules | 4 | ≥ 4 |

## Logic

1. Payload: URL with UTM; `mailto:`; `tel:`; `SMSTO:num:body`; `WIFI:T:..;S:..;P:..;H:true;;` with `\ ; , : "` escaped; vCard 3.0 (CRLF); GS1 Digital Link `https://domain/01/{GTIN-14}[/10/lot][/21/serial][?17=YYMMDD]`.
2. Encode with node-qrcode (smallest version for data + level).
3. Quiet zone 4 modules (ISO/IEC 18004), never less.
4. Minimum size = max(2 cm, distance ÷ 10). Module = size ÷ (modules + 2 × quiet zone). Warn below the GS1 minimum X 0.396 mm (target 0.495).
5. Contrast = background − foreground relative luminance; ≤ 0 error, < 0.40 warning (ISO/IEC 15415 grade C).
6. Logo: level H, centred square of whole modules ≈ 20% of the width, cleared to background.
7. Scan check in the browser: the code as drawn (logo included) is decoded with jsQR; downloads are blocked unless it decodes to the payload.
8. Export: SVG (mm units), PDF (pdf-lib, exact size), PNG (300/600/1200 dpi). API: `?format=svg|pdf`.

## Rules used

| Rule | Value | Source | Verified |
|------|-------|--------|----------|
| GS1 Digital Link syntax | GTIN as 14 digits; path order 01/10/21; expiry `?17=` | GS1 Digital Link URI Syntax 1.7.0, §4.5, 4.9, 4.10 | 2026-11-12 |
| Module minimum | X 0.396 min, 0.495 target | GS1 2D readiness page (GenSpecs 2025 fig 5.12.3.1-3) | 2026-11-12 |
| Quiet zone | 4 modules | ISO/IEC 18004 (paywalled; GS1's 2D table says 1X, so 4X satisfies both) | not read |
| 10:1 rule, 2 cm floor | | Scanova (secondary) | not primary |
| Contrast threshold | 40% | ISO/IEC 15415 grades via vendor manual | not primary |

## Golden cases

| # | Input | Expected | Test |
|---|-------|----------|------|
| 1 | distance 30 cm | min size 3.0 cm | ✔ |
| 2 | https://packlegacy.com/ at M, 3 cm | version 2 (25 × 25), module 0.91 mm | ✔ |
| 3 | same at 2 cm | module 0.61 mm, no module warning | ✔ |
| 4 | white on black | error INVERTED | ✔ |
| 5 | GTIN 0036000291452 | https://example.com/01/00036000291452 | ✔ |
| 6 | fixed input | SVG snapshot | ✔ |
| 7 | GS1 example | https://id.gs1.org/01/09520123456788/10/ABC1/21/12345?17=180426 | ✔ |
| 8 | every content type | decodes back to its payload (jsQR) | ✔ |

## Decisions (Claude's recommendations, applied; review at Gate 2)

| # | Decision |
|---|----------|
| D1 | Generate a 4-module quiet zone even though GS1's 2D table says 1X (safe under both). |
| D2 | Use GS1's 0.396 mm minimum module (primary source) instead of the plan's unverified 0.5 mm. |
| D3 | The Wi-Fi password is never written to the shareable URL, the quote form, the file title or PDF metadata. Only http(s) links are named outside the code. |
| D4 | The API serves SVG and PDF; PNG is browser-only (needs a canvas). |
| D5 | Logo is limited to PNG/JPG (formats pdf-lib can embed) and stays in the browser. |

## Quote hand-off

Details: "Print a QR code at 3 x 3 cm (version 2, level M) for https://…". No size fields (the code goes on a box of any size).

## Build status (12 Nov 2026)

| Step | Status |
|------|--------|
| Engine, schema, rules | Done |
| Golden + property tests | 15, all pass (decode-tested) |
| Widget, content, FAQ (6), API files | Done |
| e2e (6, incl. decode of the on-screen preview and axe) | Pass, 3 runs |
| Mobile 390 px | No page overflow |
| Lighthouse, Rich Results Test | Not run |
| Gate 2 | Needs a Vercel preview |

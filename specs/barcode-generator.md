# Spec: Barcode Generator (UPC, EAN, ITF-14, GS1-128, DataMatrix)

- Slug: `/tools/barcode-generator/`
- Status: **Built 12 Nov 2026; awaiting Gate 2.** Spec and build in one pass on the owner's instruction ("make the qr code and barcode in one go"); decisions D1–D5 below use Claude's recommendations and are open for review at Gate 2.
- Rules files: `barcode-specs.json`
- Research date: 12 Nov 2026

## A. Market

- Working keyword: barcode generator for packaging (secondary: UPC barcode size, free UPC barcode generator SVG).
- Gap (build plan section 5): the current generator is PNG only, has no magnification or physical size, and lacks UPC-E, EAN-8, GS1-128 and DataMatrix.
- Our edge: exact-size vector files, GS1 magnification and quiet zones, check-digit validation, red-bar and contrast warnings, and an honest GS1 licensing note.

## B. Inputs

| Input | Default | Validation |
|-------|---------|------------|
| Symbology: UPC-A, UPC-E, EAN-13, EAN-8, ITF-14, GS1-128, Code 128, Code 39, GS1 DataMatrix | UPC-A | |
| Data | 03600029145 | digits and lengths per symbology; check digit computed when missing, error when wrong; UPC-E accepts a suppressible UPC-A; GS1 element strings `(AI)value` with the (01) GTIN checked |
| Magnification (EAN/UPC) | 100% | 80–200% |
| X-dimension (others) | per symbology | GS1 min/max |
| Bar height | 100% | 25–400%; below nominal/minimum = TRUNCATED warning |
| Human-readable text, bearer bars (ITF-14) | on | |
| Colours | #000 on #FFF | inverted = error; red bars / low contrast = warning |

## Logic

1. Validate data; GS1 mod-10 check digit (weights 3,1 from the right).
2. bwip-js produces the bar pattern only; the engine draws every bar so 1 module = X mm exactly.
3. EAN/UPC: X = 0.330 mm × magnification; bar height 22.85 mm (EAN-8 18.23) × magnification; guard bars extend 5X; overall height with digits 25.93 mm (EAN-8 21.31).
4. Quiet zones from `barcode-specs.json` (in X).
5. ITF-14: wide:narrow 2.5:1, 4.8 mm bearer-bar frame.
6. Contrast under red light (660 nm) for linear codes, white light for DataMatrix.
7. Export SVG / exact-size PDF / PNG (warns when X is not a whole number of pixels). API `?format=svg|pdf`.
8. Always shown: "A generator draws the code; retail GTINs must be licensed from GS1."

## Rules used

| Rule | Value | Source | Verified |
|------|-------|--------|----------|
| EAN/UPC X, magnification, quiet zones, heights | 0.330 mm; 80–200%; UPC-A 9/9, UPC-E 9/7, EAN-13 11/7, EAN-8 7/7; 22.85 / 18.23 mm; 25.93 / 21.31 mm | GS1 General Specifications v23 (GS1 Austria edition, figs 5.2.6.6-1 to -4) | 2026-11-12 |
| ITF-14 | X 0.495–1.016; height 31.75; 10X; ratio 2.5 | GSCN 16-434 table 2 (2016 text) | read, but current table not yet confirmed |
| ITF-14 bearer bar | 4.8 mm | GS1 Sweden | national GS1 page |
| GS1-128 | X 0.495–0.940; height 31.75; 10X; ≤ 165 mm | GSCN 16-434 table 5 | read (2016 text) |
| GS1 DataMatrix | X 0.396–0.990, default 0.495; 1X | GS1 2D readiness (GenSpecs 2025) | 2026-11-12 |
| Code 128 / Code 39 | quiet zone 10X | ISO/IEC 15417 / 16388 (paywalled) | not read |
| Contrast | 40% (grade C) at 660 nm | GSCN (660 nm); vendor manual (grades) | partly |

**Correction to the build plan:** EAN-8 overall height is 21.31 mm in the GS1 General Specifications, not 21.64 mm.

## Golden cases

| # | Input | Expected | Test |
|---|-------|----------|------|
| 1 | UPC-A 03600029145 | check digit 2 → 036000291452 | ✔ |
| 2 | EAN-13 400638133393 | check digit 1 → 4006381333931 | ✔ |
| 3 | UPC-A 80% | X 0.264 mm; width 29.83 mm | ✔ |
| 4 | UPC-A 100% | X 0.330 mm; 37.29 × 25.93 mm | ✔ |
| 5 | UPC-A 200% | X 0.660 mm; width 74.58 mm | ✔ |
| 6 | UPC-A 036000291453 | error: wrong check digit (expected 2) | ✔ |
| 7 | magnification 70% | error: below 80% minimum | ✔ |
| 8 | fixed input | SVG snapshot | ✔ |
| 9 | EAN-13 / EAN-8 / UPC-E at 100% | 37.29 × 25.93 / 26.73 × 21.31 / 22.11 × 25.93 mm | ✔ |
| 10 | ITF-14 | 10X quiet zones, 31.75 mm bars, 4.8 mm bearers | ✔ |

## Decisions (Claude's recommendations, applied; review at Gate 2)

| # | Decision |
|---|----------|
| D1 | Draw bars ourselves from bwip-js's pattern (bwip-js's own SVG is in pixel units). |
| D2 | Out-of-range magnification or X is an error (blocks the result), not a warning. |
| D3 | ITF-14 bearer bars drawn as a full frame (GS1 requires the horizontal bars; the frame is the common corrugated practice). |
| D4 | Human-readable digits use OCR-B where installed, else Helvetica (PDF uses Helvetica). |
| D5 | Barcode decode tests (zxing) deferred; bar patterns come from bwip-js, which is widely used, and sizes are golden-tested. |

## Quote hand-off

Details: "Print a UPC-A barcode (036000291452) at 37.29 mm x 25.93 mm, X 0.33 mm."

## Build status (12 Nov 2026)

| Step | Status |
|------|--------|
| Engine, schema, rules, GS1 helpers | Done |
| Golden + property tests | 20, all pass |
| Widget, content (3 tables, 7 FAQs), API files | Done |
| e2e (6 incl. axe) | Pass, 3 runs |
| Mobile 390 px | No page overflow |
| Lighthouse, Rich Results Test | Not run |
| Gate 2 | Needs a Vercel preview |

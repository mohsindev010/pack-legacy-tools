# Changelog

Every rules change gets an entry: what changed, why, the official source and the date (build plan, section 10.3).

## 2026-11-17: CI fix

- `pnpm typecheck` now runs `next typegen` first. CI type-checks before building, so the generated `PageProps`, `LayoutProps` and `RouteContext` helpers did not exist there and `tsc` failed.

## 2026-11-17: Tester review fixes (tools 1, 2, 3 and all widgets)

- `carriers.json`: removed `ruleUnit`. cm/kg input now uses the metric divisor 5,000 for UPS, FedEx and DHL Express (UPS/FedEx round up to whole kg, `minBillableKg` 1; UPS source: UPS metric dimensions and weight guide; FedEx whole-kg rounding not yet confirmed). DHL Express gains `dimDivisorIn` 139 and `minBillableLb` 1 (DHL rate-quote page). USPS stays inch-only.
- Tool 1: Mylar bag / pouch packaging (USPS soft packaging); size surcharges checked in inches for any input unit; Large Package minimum converted to kg (41 kg).
- Tool 3: replaced `paper-grades.json` and `boards.json` with `paper-conversion.json` (Custom Box Makers paper weight chart factors: pt × 6 / 14 / 15 / 16.5 by stock; lb × 1.48 text, × 2.71 cover/coated), at the tester's request.
- All tools: the working is always shown under the result ("How this result was calculated"). Tool 2: "Board" label renamed "Board type".
- ESLint ignores generated `coverage/`, `playwright-report/` and `test-results/`.

## 2026-11-12: Tool 6 built (box volume & CBM calculator)

- `containers.json`: replaced the build-plan seed (DHL / GoFreight articles) with Evergreen Line's container information page, read and **verified** 2026-11-12. Inside sizes now in mm (`insideMm`, `doorMm`). Changes: 20 ft inside height 2,393 mm (was 2,330), 40 ft capacity 67.5 m³ (was 67.7), tare/payload 2,120/28,360 (20 ft), 4,000/26,480 (40 ft), 4,200/26,280 (40 ft HC, the 30,480 kg MGW row; Gate 1 D1). Added `settings.roadWeightInfoKg` 20,000 (D3). Validated with zod (`schemas/containers.ts`), including payload = max gross − tare.
- Hub e2e: the "no engine yet" API check now uses `pallet-calculator`.

## 2026-11-12: Tools 4 and 5 built (QR code and barcode generators)

- `barcode-specs.json`: EAN/UPC X 0.330 mm, 80–200%, quiet zones (UPC-A 9/9, UPC-E 9/7, EAN-13 11/7, EAN-8 7/7), bar and symbol heights, **verified** in the GS1 General Specifications v23 (GS1 Austria edition). EAN-8 symbol height corrected to 21.31 mm (plan: 21.64). ITF-14 and GS1-128 from GS1 change notice GSCN 16-434 (2016 text; GS1-128 max X 0.940 mm for logistic labels); ITF-14 bearer bar 4.8 mm (GS1 Sweden). GS1 DataMatrix X 0.396 / 0.495 / 0.990, 1X quiet zone (verified, GS1 2D readiness). Code 128 / Code 39 quiet zones unverified (ISO paywalled).
- `qr-specs.json`: GS1 Digital Link syntax **verified** (URI Syntax 1.7.0: GTIN-14, path order 01/10/21, `?17=` expiry). Module minimum changed from the plan's unverified 0.5 mm to GS1's 0.396 mm (verified; target 0.495). Quiet zone stays 4 modules (ISO/IEC 18004) although GS1's 2D table says 1X.
- New libs: `gs1.ts` (mod-10, GTIN-14, UPC-E suppression), `color.ts` (contrast under white or red light), `drawing.ts` / `pdf.ts` / `raster.ts` (one mm drawing to SVG, exact-size PDF and pixels).
- API: code tools answer `?format=svg|pdf` with the file.
- Dependency: `jsqr` 1.4.0 (decode check in the browser and tests).
- Shared CSS: results column wraps long codes; colour inputs have a usable height.

## 2026-11-12: Tool 3 built (paper weight converter)

- `boards.json`: SBS (0.73 / 0.84 / 0.87 g/cm³; build plan mill calibration, Packwire, Ovanle) and CRB (0.77 / 0.80 / 0.83; computed from a WestRock CRB chart reproduced by Itempak). Both `verifiedOn: null` pending mill spec sheets. CUK, kraft and greyboard left out (Gate 1 decision D2).
- `paper-grades.json`: now validated with zod (`schemas/paper.ts`); gsm-per-lb factors derived from each basis ream (D1).
- `lib/units.ts`: added `G_PER_LB`, `M2_PER_IN2`, `M2_PER_FT2`, `UM_PER_MM` (exact constants).
- `form.module.css`: fields and selects may shrink in a grid row (long select labels overflowed at 390 px).

## 2026-11-12: Tool 2 built (standard box sizes and box finder)

- `box-sizes.json`: default list of 49 RSC and 15 mailer sizes from Uline stock pages (printed as inside dimensions, read 2026-11-12), plus the 4 USPS Flat Rate boxes. Added `settings` (clearance presets 1/8, 1/4, 1/2 in; exact-fit step 1/8 in; caliper layers 2 per side and 4 on RSC height, Gate 1 decision D2; top 5 results).
- `lib/round.ts`: `roundDisplay` caches one `Intl.NumberFormat` per precision (about 14x faster engines).

## 2026-11-12: Tool 1 built (dimensional weight calculator)

- `carriers.json`: added `ruleUnit` (DHL computes in cm/kg), `contractDivisorAllowed`, `minBillableLb` / `minBillableKg`, surcharge labels, and `suppressedByLargePackage` on Additional Handling (Gate 1 decision D3). DHL `dimDivisorIn` removed (DHL rules are metric).
- Rules files are now validated with zod at load (`schemas/carriers.ts`), so a malformed edit fails the build and tests.

## 2026-11-12: Tools 2 and 3 spec research

- `box-sizes.json`: added the four USPS Priority Mail Flat Rate boxes, inside and outside, verbatim from USPS Notice 123 (verified). The Large box is 12 x 11-3/4 x 5-1/2 inside (build plan had 12 x 12 x 5-1/2).
- `paper-grades.json`: basis reams for 8 grades, including paperboard (lb per 1,000 ft²), from Valmet and Wikipedia (they agree). Factors are derived from the ream size, not typed in. The exact cover factor is 2.7041 (not 2.708). Tag is 22.5 x 28.5 (not 24 x 36).
- `flutes.json`: sources added (US standard flute table, secondary). Still unverified pending corrugator spec sheets.

## 2026-11-12: Tool 1 spec research (rules corrections)

- **USPS verified against the primary source** (DMM 223, 283, 253; paragraphs tagged [7-12-26]; Notice 123). `carriers.json` → usps and `usps-cubic.json` now cite the DMM with `verifiedOn: 2026-11-12`.
- `usps-cubic.json`: softpack tiers corrected to length + width ≤ 21 / 27 / 31 / 34 / 36 in (seed had 36 and 41 for tiers 4 and 5); Priority Mail Cubic longest side 22 in.
- `carriers.json` → usps: added nonstandard thresholds (> 22 in, > 30 in, > 3,456 in³), the Ground Advantage 108–130 in oversized tier, and the nonrectangular (0.785) rules.
- `carriers.json` → ups: added the Additional Handling cubic trigger (> 10,368 in³). The build plan had it as FedEx-only; two secondary sources (Sifted, Loop) say both carriers. Still `verifiedOn: null` because ups.com blocks automated reads.
- `carriers.json` → fedex: `effectiveFrom` corrected to 2026-01-12 (secondary sources). Still unverified.

## 2026-11-12: Phase 0 foundation

- Seeded `carriers.json`, `usps-cubic.json`, `containers.json`, `pallets.json` and `flutes.json` with the values in the build plan. All entries are `verifiedOn: null` until each is checked against its primary source in the spec of the tool that uses it (verification register, section 23).
- Other rules files are placeholders, filled in each tool's step C.

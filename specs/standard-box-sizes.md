# Spec: Standard Box Sizes Chart & Box Finder

- Slug: `/tools/standard-box-sizes/`
- Status: **Gate 1 approved 12 Nov 2026** (owner: "use your recommendations"; default box list chosen by Claude on owner instruction).
- Rules files: `box-sizes.json`, `flutes.json`, `carriers.json` (via the tool 1 engine)
- Depends on: tool 1 engine (billable weight per box). Built after tool 1.
- Research date: 12 Nov 2026

---

## A. Market

**Primary keyword (working):** standard box sizes. Secondary: shipping box sizes chart, mailer box sizes, USPS flat rate box dimensions.

**Intent:** mostly informational ("what sizes exist?"), with a clear next action ("which one fits my product?"). Page 1 is static charts.

**Who ranks:** ParcelPath, Packwire (mailer sizes), XWprint, 4over4 (box size by product type), BlueBox, size-charts.com, plus supplier catalogs.

**Their gaps (our edge):**

| Gap | Note |
|-----|------|
| Charts only, no finder | Nobody fits *your* product with clearance and orientation |
| Inside vs outside not distinguished, or not used for DIM | Carriers bill on outside size; the caliper adds up to 1 lb |
| DIM weights shown as decimals, no 2026 round-up | Same error as Teal |
| USPS flat-rate sizes copied with errors | ParcelPath and others give Large as 12 × 12 × 5½ or 11⅞ × 11⅞ × 5½; USPS Notice 123 says **12 × 11¾ × 5½ inside** |
| No "exact-fit vs stock" comparison | Our custom-box row is the conversion point |

**FAQ seeds:**
1. What are the most common mailer box sizes?
2. What are the USPS flat rate box dimensions?
3. Are box sizes inside or outside dimensions?
4. How do I choose a box size for my product?
5. How much clearance should I leave?
6. Can I order a size that is not on the chart?

---

## B. Inputs

| Input | Type / unit | Default | Validation |
|-------|-------------|---------|------------|
| Product L, W, H | number; in or cm | 9 × 6 × 2.5 in | > 0; ≤ 48 in |
| Clearance per side | snug ⅛ \| standard ¼ \| protective ½ \| custom | standard ¼ in | 0–2 in |
| Insert thickness | number | 0 | 0–2 in; added per side |
| Orientation | free \| this side up | free | |
| Box family | all \| mailer \| RSC \| USPS flat rate \| Pack Legacy | all | |
| Board | E \| B \| C \| BC \| paperboard | E | caliper from `flutes.json` |
| Product weight | lb or kg | empty | enables billable weight |

## Logic

1. **Required inside size** = product + 2 × (clearance + insert) on every axis.
2. **Fit** (`geometry.fitsInside`):
   - Free orientation: sort both size triples and compare position by position.
   - This side up: product height must fit box height; length and width may swap.
3. **Waste %** = 1 − product volume ÷ box inside volume.
4. **Outside size** = inside + 2 × caliper on each axis.
   - USPS flat-rate boxes use USPS's published **outside** dimensions instead of computing them.
   - See decision D2 for RSC height.
5. **Billable weight** per carrier: the tool 1 engine, run on the outside size. Shown only when a product weight is entered; otherwise billable = DIM.
6. **Rank** fitting boxes by waste %, then by UPS billable weight. Return the top 5.
7. **Exact-fit row** (always last): required inside size rounded up to ⅛ in → outside → billable. Show the saving against the best stock box, with a Quote CTA.
8. Pack Legacy product boxes link to their product page.

## Outputs and flags

- Candidate table: box, family, inside, outside, waste %, billable per carrier.
- Exact-fit row with saving.
- Flags:
  - `NO_STOCK_FIT`: nothing fits, so only exact-fit is shown.
  - `FLAT_RATE_NOTE`: flat-rate price ignores weight and zone, but limits weight to 70 lb.
  - `CALIPER_NOMINAL`: outside size uses nominal caliper.

## Data: `box-sizes.json`

| Family | Source | Status |
|--------|--------|--------|
| USPS Priority Mail Flat Rate | USPS Notice 123 (eff. 4 Oct 2026), inside and outside both printed. See table below. | **Verified (primary) 12 Nov 2026** |
| Pack Legacy standard sizes | Pack Legacy (section 22.1 item 6) | **Needed from you** |
| Common stock mailers and RSCs | Uline stock pages, dimensions printed as INSIDE (decision D1) | **Read from source 12 Nov 2026** |

USPS Flat Rate (Notice 123, verbatim):

| Box | Inside (in) | Outside (in) |
|-----|-------------|--------------|
| Small | 8⅝ × 5⅜ × 1⅝ | 8 11⁄16 × 5 7⁄16 × 1¾ |
| Medium (top-loading) | 11 × 8½ × 5½ | 11¼ × 8¾ × 6 |
| Medium (side-loading) | 13⅝ × 11⅞ × 3⅜ | 14⅛ × 12 × 3½ |
| Large | **12 × 11¾ × 5½** | 12¼ × 12 × 6 |

> **Correction to the build plan:** the plan lists Large as 12 × 12 × 5½ in inside. USPS Notice 123 prints 12 × 11¾ × 5½ inside. Notice 123 does not label which Medium box is FRB-1 and which is FRB-2; the top/side-loading names follow the USPS store listings.

## Board calipers (`flutes.json`)

| Flute | Nominal caliper | Source | Status |
|-------|-----------------|--------|--------|
| E | 1/16 in (1.6 mm) | US standard flute table (Packaging Strategies; Wikipedia "Corrugated fiberboard") | Secondary; range 1.5–2.0 mm in EU supplier data |
| B | 1/8 in (3.2 mm) | same | Secondary |
| C | 5/32 in (4.0 mm) | same | Secondary; 3.6–4.2 mm range |
| BC | ≈ 1/4 in (6.1–6.7 mm) | supplier data (ranges disagree: 5–6 mm vs 6.1–6.7 mm) | Secondary, **least certain** |

Ask Pack Legacy's corrugator for its actual calipers. That is the authoritative source for its own boxes.

---

## Golden cases

| # | Input | Expected | Tests |
|---|-------|----------|-------|
| 1 | Product 9 × 6 × 2.5, ¼ in clearance, test mailer 10 × 8 × 4 | required 9.5 × 6.5 × 3.0; fits; waste 1 − 135/320 = **57.8 %** | fit + waste |
| 2 | Same box, E-flute | outside 10.125 × 8.125 × 4.125 → UPS sides 11 × 9 × 5 = 495 → 3.56 → **4 lb** | caliper + round-up |
| 3 | Exact-fit row | inside 9.5 × 6.5 × 3.0 → outside 9.625 × 6.625 × 3.125 → 10 × 7 × 4 = 280 → 2.01 → **3 lb; saves 1 lb** vs case 2 | value of custom |
| 4 | Product entered as 2.5 × 9 × 6 | identical to case 1 | order-independent |
| 5 | This side up, product 4 × 4 × 9 | required height 9.5; boxes with inside height < 9.5 are rejected even if they fit lying down | orientation lock |
| 6 | Product 8 × 5 × 1.25, snug ⅛ | required 8.25 × 5.25 × 1.5 → fits USPS Small (8⅝ × 5⅜ × 1⅝) | flat-rate fit |
| 7 | Product 11.5 × 11.5 × 5, ¼ in | required 12 × 12 × 5.5 → **does not** fit USPS Large (11¾ width) | proves the Large correction matters |
| 8 | Product 30 × 30 × 30 | no stock fit → `NO_STOCK_FIT`, exact-fit row only | empty result |

Property tests:
- Every returned box fits the required size.
- Waste % is between 0 and 1.
- The exact-fit row has waste ≤ every stock row.
- Swapping L/W/H never changes results in free mode.

---

## Quote hand-off

- **L / W / H / unit:** chosen box inside dims (or the exact-fit size).
- **Details:** "Product 9 x 6 x 2.5 in, 1/4 in clearance, E-flute. Exact fit 9.5 x 6.5 x 3 in, waste 57.8% in stock 10x8x4."
- **Material:** "Kraft corrugated" when a flute is chosen.

## Decisions needed at Gate 1

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | Which "common stock" list? There is no industry standard; every supplier differs. | Lead with **Pack Legacy's own sizes** (please send them). Add 15–25 common mailer and RSC sizes from **one** named distributor stock guide, cited as such. Never mix unsourced sizes in. |
| D2 | Outside size for an RSC: the flaps add extra layers on height | Use inside + 2 × caliper on L and W, and inside + 4 × caliper on height for RSCs. Mailers (die-cut) use + 2 × caliper on all sides. **Confirm with your corrugator.** |
| D3 | Paperboard (folding carton) family in a shipping-box finder? | Leave it out of the finder; keep it in tool 3. |
| D4 | Show flat-rate boxes when no weight is entered? | Yes, with `FLAT_RATE_NOTE`. Flat rate is about size only, up to 70 lb. |

## Gate 1 approval

- [x] D1: default list = Uline stock sizes printed as inside dimensions (49 RSC from "Best Selling Boxes", 15 mailers from "White Indestructo Mailers") + 4 USPS flat-rate boxes. Pack Legacy sizes to be added later as family `pl-product`. **Note:** the page names Uline as the source; replace with Pack Legacy sizes if naming a distributor is unwanted.
- [x] D2: RSC height + 4 board layers, L/W + 2; mailers + 2 on all sides.
- [x] D3: paperboard left out of the finder.
- [x] D4: flat-rate boxes shown, with a note.
- [x] Approved by Pack Legacy, 12 Nov 2026.

## Build status (Definition of Done, section 16.1)

| Item | Status |
|------|--------|
| Engine `tools/box-finder.ts`, schemas `schemas/box-finder.ts`, `schemas/boxes.ts` | Done; reuses the tool 1 engine for weights |
| Golden (8) and property (5) tests | Pass; engine 100 % line coverage |
| Widget: clearance presets, orientation, box type, board, weight, URL state, unit toggle | Done |
| Content: charts generated from `box-sizes.json` (USPS Flat Rate, mailers, RSCs with UPS DIM weight), method, examples, mistakes, 6 FAQs | Done |
| Quote pre-fill (exact-fit inside size, "Kraft corrugated") and API | Done; e2e verified |
| Accessibility | axe: 0 serious |
| Default box list | 49 RSC + 15 mailers (Uline, inside dims) + 4 USPS Flat Rate (68 boxes). **Pack Legacy sizes still to add.** |
| Flute calipers | Nominal, unverified (page shows a note). Needs corrugator spec sheets. |
| Gate 2 preview approval | Needs the Vercel preview |

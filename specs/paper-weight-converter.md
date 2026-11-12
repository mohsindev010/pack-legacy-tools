# Spec: Paper Weight Converter (GSM, lb, pt, mm)

- Slug: `/tools/paper-weight-converter/`
- Status: **Built 12 Nov 2026; awaiting Gate 2** (Gate 1 approved 12 Nov 2026, owner: "use your recommendations").
- Rules files: `paper-grades.json`, `boards.json`, `flutes.json`
- Research date: 12 Nov 2026

---

## A. Market

**Primary keyword (working):** gsm to lb converter. Secondary: paper weight chart, gsm to pt, 18 pt in gsm, cardstock weight chart, paperboard caliper chart.

**Intent:** quick conversion plus a reference chart. Packaging buyers arrive with a supplier quote in one unit ("16 pt C1S", "350 gsm") and need it in another.

**Who ranks:** printer and supplier pages (Jukebox, 4over4, OKI, Cloudprinter, Spicers, QinPrinting, DN Packaging), calculators (Omni, 4calculators, wtpbiz), Wikipedia "Grammage".

**Their gaps (our edge):**

| Gap | Seen on |
|-----|---------|
| Convert gsm ↔ pt with **one fixed number**, though caliper depends on board density. For 16 pt SBS, sources disagree: about 350 gsm (Packwire, ρ 0.87) vs 270–290 gsm (CustomPacka). | most |
| Single "lb" column without naming the grade (300 gsm = "80 lb", which is only true for *bond*) | Teal, several charts |
| Rounded factors (cover 2.708, index 1.813) presented as exact | 4over4, many converters |
| One source reverses text and cover basis sizes | a search-result chart |
| Tag listed at 24 × 36 (1.63); the ream tables say 22½ × 28½ (2.19) | some calculators |
| No paperboard basis (lb / 1,000 ft²), the unit packaging mills actually quote | almost all |

**FAQ seeds:**
1. How many gsm is 18 pt (or 14 pt / 16 pt / 24 pt)?
2. How do I convert gsm to lb?
3. What is 350 gsm in lb?
4. What does caliper (pt) mean?
5. Why does "80 lb" mean different papers?
6. What is a cardstock weight chart?

---

## B. Inputs

| Input | Type / unit | Default | Validation |
|-------|-------------|---------|------------|
| Value | number | 300 | > 0; ≤ 5,000 gsm equivalent |
| From unit | gsm \| lb \| pt \| mm \| µm | gsm | |
| Grade (when lb is in or out) | bond \| text \| cover \| index \| bristol/tag \| tissue \| newsprint \| paperboard (lb/1,000 ft²) | cover | **Required** when the from-unit is lb |
| Board type (for caliper) | SBS C1S \| SBS C2S \| CRB \| CUK \| kraft (uncoated) \| greyboard | SBS C1S | Selects the density range |

## Logic

1. **Basis weight ↔ gsm**, using exact factors derived from each grade's basis ream (no typed-in factors):
   - factor = 453.59237 g ÷ (sheet width × sheet length × sheets per ream × 0.00064516 m²/in²)
   - gsm = lb × factor
2. **Caliper:** 1 pt = 0.001 in = 0.0254 mm = 25.4 µm. These are exact constants in `units.ts`.
3. **gsm ↔ caliper needs density:**
   - thickness (µm) = gsm ÷ ρ (g/cm³)
   - pt = µm ÷ 25.4
4. Each board type stores ρ **min / typical / max**. Caliper is always shown as a range with the typical value highlighted, never a single number.
5. **All-grades table:** for any input, show the lb value in every grade side by side. This is why "80 lb" is ambiguous.
6. **Explain steps** show the factor's derivation (ream size → factor) and the density used.

## Outputs and flags

- Headline: the converted value. For caliper, 300 gsm SBS → "≈ 14.1 pt (13.6–16.2 pt)".
- An all-grades lb table and a caliper-by-board table.
- Flags:
  - `GRADE_REQUIRED`: lb without a grade (error).
  - `DENSITY_ESTIMATE`: caliper uses a density range.
  - `MILL_SPEC_WINS`: the mill's spec sheet beats any estimate.

---

## Rules data

### `paper-grades.json`: basis reams (verified, two sources agree)

| Grade | Basis sheet (in) | Sheets | Exact factor (gsm per lb) | Commonly printed |
|-------|------------------|--------|---------------------------|------------------|
| Bond / writing / ledger | 17 × 22 | 500 | **3.7597** | 3.76 |
| Text / book / offset | 25 × 38 | 500 | **1.4801** | 1.48 |
| Cover | 20 × 26 | 500 | **2.7041** | 2.71 / 2.708 ✗ |
| Index bristol | 25½ × 30½ | 500 | **1.8080** | 1.81 / 1.813 ✗ |
| Bristol and tag | 22½ × 28½ | 500 | **2.1928** | 2.19 |
| Tissue | 24 × 36 | 480 | **1.6953** | 1.70 |
| Newsprint (and bag/wrapping) | 24 × 36 | 500 | **1.6275** | 1.63 |
| Paperboard (all types) | 1,000 ft² | | **4.8824** | 4.88 |

Sources: Valmet "Ream sizes and conversion factors"; Wikipedia "Grammage" (ream table). Both agree on every size and count. Status: **verified across two independent references**; ream definitions are industry conventions, not a single owner's spec.

> **Corrections to the build plan:**
> 1. **Cover factor 2.708 is a rounding artefact.** Exact is 2.7041 (index: 1.8080, not 1.813).
>    - Golden case 1: 300 gsm = **110.9 lb cover**, not 110.8. Bond (79.8) and text (202.7) are unchanged.
>    - Golden case 3: 100 lb cover = **270.4 gsm**, not 270.8.
> 2. **Tag is 22½ × 28½ (2.19)**, the same as bristol, not 24 × 36. The plan's "tissue 24x36 (480)" and "newsprint 24x36" are correct.
> 3. **Add paperboard (lb per 1,000 ft², 4.8824).** It is how US board mills quote SBS/CRB/CUK, and it is the grade packaging buyers most need.

### `boards.json`: density ranges (g/cm³)

| Board | min | typical | max | Basis | Status |
|-------|-----|---------|-----|-------|--------|
| SBS C1S / C2S | 0.73 | **0.84** | 0.87 | Plan's mill calibration (10 pt ≈ 218, 12 pt ≈ 256, 14 pt ≈ 299 gsm → 0.84); Packwire assumes 0.87; Ovanle bulk 1.33 → 0.75 | **Mill sheet not yet read** (Billerud and Clearwater PDFs came back as unreadable binary) |
| CRB | 0.77 | **0.80** | 0.83 | Computed from a WestRock/RockTenn CRB chart reproduced by Itempak: 0.016 in = 69 lb/1,000 ft² → 0.83; 0.024 in = 96 lb → 0.77 | Secondary reproduction of mill data |
| CUK | ? | ? | ? | No numeric source found yet | **Open** |
| Kraft (uncoated) | ? | ≈ 0.61 | ? | Plan: about 0.73 × SBS (AICC) | **Open** |
| Greyboard (rigid) | ? | ? | ? | Packwire assumes chipboard 0.65 | **Open** |

The board data is the weak point of this tool. The best fix is **Pack Legacy's own board suppliers' spec sheets** (SBS, CRB, CUK, greyboard caliper vs basis weight). They make our numbers match what Pack Legacy actually sells.

---

## Golden cases

| # | Input | Expected | Tests |
|---|-------|----------|-------|
| 1 | 300 gsm | **110.9 lb cover; 79.8 lb bond; 202.7 lb text; 165.9 lb index; 61.4 lb/1,000 ft² board** | grade table; Teal's "80 lb" is bond only |
| 2 | 80 lb text | **118.4 gsm** | factor |
| 3 | 100 lb cover | **270.4 gsm** (plan's 270.8 used the rounded factor) | exact factor |
| 4 | 12 pt, SBS C1S | typical 304.8 µm × 0.84 = **256 gsm** | Teal shows 300 |
| 5 | 300 gsm → pt | ρ 0.70: **16.9 pt**; ρ 0.84: **14.1 pt**; ρ 1.00: **11.8 pt** | range output |
| 6 | 50 lb, no grade | error `GRADE_REQUIRED` | no ambiguity |
| 7 | 16 pt SBS | **297–354 gsm, typical 341** | explains the 270–350 disagreement between competitors |
| 8 | 69 lb/1,000 ft² paperboard | **337 gsm** | paperboard basis |
| 9 | 0.5 mm | **19.7 pt** = 500 µm | caliper units |

Property tests: gsm → lb → gsm round-trips for every grade; pt ↔ mm ↔ µm round-trip; a higher density always gives a thinner caliper.

---

## Quote hand-off

- **Details:** "Board spec: 16 pt SBS C1S (~341 gsm typical, 297–354 range)."
- **Material:** "Folding Paperboard" for SBS/CRB/CUK; "Rigid Board" for greyboard.

## Decisions needed at Gate 1

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | Exact factors (2.7041) or the commonly printed ones (2.708)? | **Exact**, with a FAQ line explaining why other charts differ by about 0.1 %. It is a quotable, citable difference. |
| D2 | Ship before CUK, kraft and greyboard densities are sourced? | Ship with SBS and CRB only. Hide the other boards until Pack Legacy's supplier sheets arrive. |
| D3 | Include corrugated flute calipers here (plan's content plan)? | Yes, as a reference table only (from `flutes.json`), not as a conversion. |

## Gate 1 approval

- [x] D1: exact factors. D2: ship SBS and CRB only until supplier sheets arrive. D3: flute caliper table as reference only.
- [x] Approved by Pack Legacy, 12 Nov 2026.

## Build status (12 Nov 2026)

| Step | Status |
|------|--------|
| Engine (`tools/paper-weight.ts`), schema (`schemas/paper-weight.ts`, `schemas/paper.ts`) | Done. Factors derived from the ream size (D1). |
| Rules: `boards.json` | SBS 0.73 / 0.84 / 0.87 and CRB 0.77 / 0.80 / 0.83 g/cm³; `verifiedOn: null` until a mill sheet is read. CUK, kraft and greyboard hidden (D2). |
| Golden cases 1-9 + property tests | 16 tests, all pass |
| Widget, content (5 charts incl. flute reference, D3), FAQ, quote hand-off | Done |
| e2e (6 tests incl. axe) | Pass, 3 runs |
| Mobile 390 px | No horizontal scroll (fixed shared `.select` / `.field` min-width) |
| Lighthouse, Rich Results Test | Not run yet |
| Gate 2 | Needs a Vercel preview |

Open: board densities need Pack Legacy's supplier spec sheets (SBS, CRB, CUK, greyboard).

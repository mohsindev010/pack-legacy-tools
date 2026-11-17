# Spec: Dimensional Weight & Shipping Surcharge Calculator

- Slug: `/tools/dimensional-weight-calculator/`
- Status: **Gate 1 approved 12 Nov 2026** (owner instruction "go with 1 tool", recommended answers to D1–D6 adopted). Built; awaiting Gate 2 (preview review).
- Rules files: `carriers.json`, `usps-cubic.json`
- Research date: 12 Nov 2026

---

## A. Market (search research)

**Primary keyword (working):** dimensional weight calculator. Secondary: DIM weight calculator UPS / FedEx / USPS, billable weight calculator, USPS cubic calculator.

**Intent:** transactional-informational. People want a number now ("what will I be billed?") and then the rule behind it. Page 1 is almost entirely calculators, so the page must lead with the tool and back it with the method.

**Who ranks (US, 12 Nov 2026):** carrier-agnostic calculators from fulfilment and shipping-software companies dominate: Calcurates, Packwire, ShipMonk, ParcelPath, Red Stag, ShippingEasy, Rollo, Omni Calculator, Inch Calculator, FitSmallBusiness. FedEx has its own calculator. A wave of 2026 pages (3PL Guys, dimweigh.com, warehousingcosts.com, dimmath.com) targets "2026" and "139" specifically.

**What they get wrong or miss (our gap):**

| Gap | Seen on |
|-----|---------|
| One carrier at a time; no side-by-side | most calculators |
| No whole-inch round-up of each side (rule since Aug 2025) | Teal, several generic calculators |
| Apply DIM to USPS parcels of 1 cu ft or less | Teal and others |
| Still show USPS at 166 | older pages |
| No surcharge check, or no 2026 cubic triggers (10,368 / 17,280 in³) | most |
| No USPS cubic tier | almost all; separate "USPS cubic calculator" pages exist (dimmath, westnet) |
| No "what if I cut the box 1 in" right-sizing | none found |
| Working not shown, no rule dates or sources | almost all |
| At least one competitor page states the wrong threshold in its own worked example (Loop: "36 × 17 × 17 = 10,404 in³ … exceeds 17,280") | Loop |

**Questions to answer (FAQ seeds).** This is a live People Also Ask list, refreshed when step G content is written:
1. What is dimensional weight and how is it calculated?
2. What is the DIM divisor for UPS, FedEx and USPS in 2026?
3. Does USPS use dimensional weight? (Yes, above 1 cu ft, divisor 139 since 12 Jul 2026.)
4. Do carriers round dimensions up? (Yes, to the next whole inch.)
5. What is length plus girth?
6. What triggers the UPS/FedEx Additional Handling surcharge in 2026?
7. What is USPS cubic pricing and does my box qualify?
8. How do I reduce dimensional weight?

---

## B. Inputs

| Input | Type / unit | Default | Validation | Notes |
|-------|-------------|---------|------------|-------|
| Length, width, height | number; in or cm | 12 × 9 × 4 in | > 0; ≤ 200 in (508 cm) | Any order; the engine sorts |
| Unit | `in` \| `cm` | `in` | | See decision D1 |
| Actual weight | number; lb or kg | 2.5 lb | ≥ 0; ≤ 300 lb (136 kg) | |
| Carriers | multi: UPS, FedEx, USPS, DHL Express | all | ≥ 1 | |
| Packaging | `box` \| `softpack` \| `tube` | `box` | | Drives USPS cubic eligibility and measurement |
| Contract divisor | number | empty | 100–400 | Overrides published divisor for UPS/FedEx/DHL; labelled "your contract" |
| Product size + clearance | 3 numbers + clearance | empty | product < box | Enables right-size suggester floor |

URL query keys (principle 8): `l, w, h, u, wt, c` (comma list), `p`, `div`, `pl, pw, ph`.

---

## Logic (per carrier, in order)

1. **Normalise.** Convert to the carrier's rule unit (decision D1).
2. **Round each side up** to the next whole inch (whole cm for metric). An exact whole number stays as is (12.0 → 12, 12.01 → 13). Float guard: subtract 1e-9 before ceil.
   - UPS and FedEx: since 18 Aug 2025.
   - USPS: since 12 Jul 2026 (DMM 223 1.4.2 / 283 1.4.2: "Round up … each measurement to the nearest whole inch").
3. **Volume** = L × W × H using the rounded sides.
4. **USPS gate.** DIM applies only when volume **exceeds 1,728 in³** (DMM 223 1.4.1). A 12 × 12 × 12 box (exactly 1,728) is billed on actual weight.
5. **DIM weight** = volume ÷ divisor, rounded up to the next whole lb (DHL: next 0.5 kg).
6. **Actual weight** rounded up to the next whole lb (DHL: next 0.5 kg).
7. **Billable** = max(DIM, actual).
8. **Length + girth** = L + 2W + 2H, with L the longest rounded side.
9. **Surcharge flags (UPS, FedEx).** All comparisons are strictly greater than ("exceeds").
   - **Additional Handling (AHS):** longest > 48 in, or second-longest > 30 in, or L+G > 105 in, or actual weight > 50 lb, or **volume > 10,368 in³ (both carriers, 2026)**.
   - **Large Package (UPS) / Oversize (FedEx):** longest > 96 in, or L+G > 130 in, or volume > 17,280 in³, or weight > 110 lb. Billable becomes max(billable, 90 lb).
   - When Large Package / Oversize applies, AHS is not shown as a separate charge (decision D3).
   - **Over maximum:** longest > 108 in, or L+G > 165 in, or weight > 150 lb. The tool returns an error flag and no billable weight (principle 10).
10. **USPS limits and fee flags** (weight only, no prices):
    - Weight > 70 lb → error, not mailable.
    - L+G > 108 in → Ground Advantage "oversized" price tier, up to 130 in (DMM 283 1.1). L+G > 130 in → error.
    - Nonstandard fees: longest > 22 in; longest > 30 in; volume > 2 cu ft (3,456 in³). Source: DMM 223 1.10, 283 1.7.
11. **USPS cubic eligibility** (separate measuring rule):
    - **Box:** round each side **down** to the nearest ¼ in, multiply, ÷ 1,728. Tier = that value rounded up to the next 0.1 cu ft.
      - Priority Mail Cubic: ≤ 0.5 cu ft (5 tiers).
      - Ground Advantage Cubic: ≤ 1.0 cu ft (10 tiers).
      - Both require ≤ 20 lb and longest ≤ 22 in.
    - **Softpack:** length + width, each rounded down to ¼ in. Tiers are ≤ 21 / 27 / 31 / 34 / 36 in → 0.1–0.5. Maximum 36 in.
    - **Tube:** not eligible.
    - Source: DMM 223 1.3, 283 1.3.
12. **Right-size suggester.** For each side, recompute with that side 1 unit shorter (never below product + clearance, never below 1). Report the billable saving per carrier, e.g. "Cut height 4 → 3 in: UPS 4 → 3 lb".
13. **Explain steps** for every rounding and rule, each with a `ruleRef` and effective date.

## Outputs and flags

- **Headline:** lowest billable weight and which carrier gives it. Weight only, never prices.
- **Comparison table per carrier:**
  - rounded dims
  - volume
  - DIM weight (or "not applied")
  - actual (rounded)
  - billable
  - L+G
  - surcharge flags
  - USPS cubic tier
- **Right-size list.**
- **Flags:** `USPS_DIM_NOT_APPLIED`, `AHS_*` (one per trigger), `LARGE_PACKAGE`, `LARGE_PACKAGE_MIN_APPLIED`, `OVER_MAX`, `USPS_NONSTANDARD_*`, `USPS_OVERSIZED_TIER`, `CONTRACT_DIVISOR`, `RULE_UNVERIFIED` (while any rule used has `verifiedOn: null`).

---

## Rules used

| # | Rule | Value | Source | Status |
|---|------|-------|--------|--------|
| R1 | USPS divisor, gate, side round-up, DIM round-up | 139; > 1,728 in³; up to whole in; up to whole lb | USPS DMM 223 1.4, 283 1.4, 253 1.2 ([pe.usps.com](https://pe.usps.com/text/dmm300/223.htm)), tagged [7-12-26] | **Verified (primary) 12 Nov 2026** |
| R2 | USPS cubic: ¼ in round-down, tiers, 20 lb, 22 in, no tubes, softpack tiers 21/27/31/34/36 | as stated | DMM 223 1.3, 283 1.3 | **Verified (primary)** |
| R3 | USPS max 70 lb; GA oversized 108–130 in L+G; nonstandard > 22 in, > 30 in, > 3,456 in³ | as stated | DMM 223 3.1, 283 1.1/1.7, Notice 123 | **Verified (primary)**, except Priority Mail's 130 in L+G maximum (only in the summarised Notice 123 quick reference) |
| R4 | UPS / FedEx divisor 139 (daily/commercial), whole-inch round-up since 18 Aug 2025 | as stated | Sifted (23 Oct 2025); several 2026 secondary guides | Secondary only: ups.com and fedex.com block automated reads |
| R5 | UPS / FedEx AHS incl. > 10,368 in³; LPS/Oversize incl. > 17,280 in³ and > 110 lb; FedEx from 12 Jan 2026, UPS from 26 Jan 2026 | as stated | Sifted; Loop (20 Mar 2026) | Secondary only |
| R6 | AHS 48 / 30 / 105 / 50 lb; LPS 96 / 130 / 90 lb minimum; over max 108 / 165 / 150 | as stated | build plan; Red Stag | Secondary only, **needs carrier check** |
| R7 | DHL Express 5,000 cm³/kg, 0.5 kg steps | as stated | DHL Discover pages (country guides) | Secondary/country-specific; dimension rounding unclear |

**Corrections to the build plan found in this research:**
1. The 10,368 in³ AHS cubic trigger applies to **UPS and FedEx**, not FedEx only.
2. Golden case 10 (36 × 30 × 10) also exceeds 105 in L+G (L+G 116), so it never tested the cubic trigger. It is replaced below.
3. FedEx's cubic triggers took effect **12 Jan 2026**; UPS's on 26 Jan 2026.
4. USPS softpack cubic tiers end at **34 and 36 in** (plan seed had 36 and 41). This is already fixed in `usps-cubic.json`.
5. USPS has nonstandard-length and > 2 cu ft fees, plus a 108–130 in "oversized" tier for Ground Advantage. The plan said "VERIFY"; these are now sourced.

---

## Edge cases

- Fractional sides that are already whole (12.0) do not round up. Float noise (11.999999999) is treated as 12.
- Zero weight is allowed: billable is DIM (or 0 → 1 lb minimum, decision D5).
- Above the over-max limits, no billable number is shown, only an error flag.
- Contract divisor never applies to USPS (published-rate rule).
- A side shorter than 1 unit after right-sizing is never suggested.
- `cm` with USPS: converted to inches first (USPS publishes no metric rule).

---

## Golden cases

All values were computed from the rules above and recomputed for this spec. Sides are inches and weights pounds unless stated.

| # | Input | Expected | Tests |
|---|-------|----------|-------|
| 1 | 12×9×4, 2.5 lb, UPS & FedEx | vol 432; 432/139 = 3.108 → DIM 4; actual 3; **billable 4** | round-up of DIM |
| 2 | same, USPS | 432 ≤ 1,728 → DIM not applied; **billable 3** | USPS gate |
| 3 | 16×12×8, 2 lb, UPS | 1,536/139 = 11.05 → **12** | Teal shows 11.1 / 9.3 |
| 4 | 16×12×8, 2 lb, USPS | gate → **2** | gate |
| 5 | 12.2×9×4, 2.5 lb, UPS | sides 13×9×4 = 468 → 3.37 → **4** | side round-up |
| 6 | 18×14×10, 5 lb, all four | 2,520/139 = 18.13 → **19** for UPS, FedEx, USPS | USPS DIM active above 1 cu ft |
| 7 | 40×30×25 cm, 4.2 kg, DHL | 30,000/5,000 = 6.0 kg; actual 4.5 kg; **billable 6 kg** | metric divisor, 0.5 kg step |
| 8 | 40×20×20, 10 lb, UPS | L+G 120 > 105 and vol 16,000 > 10,368 → AHS (2 triggers); no Large Package | AHS |
| 9 | 31×24×24, 20 lb, UPS | vol 17,856 > 17,280 → Large Package though L+G 127; AHS not separate | 2026 LPS cubic |
| 10 | **36×17×17, 10 lb, UPS & FedEx** | L+G 104 (no), vol 10,404 > 10,368 → **AHS by volume only, both carriers** | replaces plan case 10 |
| 11 | 110×10×10 | longest 110 > 108 → OVER_MAX error, no billable | honest output |
| 12 | 97×10×10, 20 lb, UPS | DIM 9,700/139 = 69.8 → 70; Large Package (longest > 96) → **billable 90** | 90 lb minimum |
| 13 | 12×12×12, 3 lb, USPS | vol exactly 1,728 → not "exceeding" → **billable 3** | boundary |
| 14 | 12×9×4, 2.5 lb, UPS, contract divisor 166 | 432/166 = 2.60 → 3; **billable 3**; CONTRACT_DIVISOR flag | contract override |
| 15 | 6⅛×5⅞×6⅜ box, 2 lb, USPS cubic | ¼ in round-down to 6×5.75×6.25 = 215.6 in³ = 0.1248 cu ft → **tier 0.2** (PM and GA) | DMM worked example |
| 16 | softpack 12×10, 1 lb | L+W 22 → **tier 0.2** | softpack tiers |
| 17 | 24×10×6, 5 lb, USPS | longest 24 > 22 → USPS_NONSTANDARD_22 flag; vol 1,440 ≤ 1,728 → billable 5 | nonstandard flag |
| 18 | 12×9×4, 2.5 lb, right-size | cut height 4 → 3: 324/139 = 2.33 → 3; **UPS saves 1 lb** | suggester |

Property tests: billable ≥ actual (rounded); billable never decreases when any side grows; results are identical for any input order of L/W/H; cm and in inputs of the same physical box agree within one rounding step.

---

## Quote hand-off (section 14)

- **L / W / H / unit:** rounded outside dims; unit `inches` (or `cm`).
- **Project Details:** "Tool: DIM calculator. 16 x 12 x 8 in, 2 lb. UPS billable 12 lb. Lowest: USPS 2 lb."
- **Material:** none.

---

## Decisions needed at Gate 1

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | When the user enters cm, which rules apply? | **Convert to inches for UPS/FedEx/USPS (US domestic), and use the 5,000 cm³/kg rule for DHL Express only.** The plan's "keep the user's unit" gives different answers for the same box, which buyers will read as a bug. |
| D2 | Is DHL Express worth keeping in a US-focused tool? | Keep it, labelled "international". It is the main metric example and the plan lists it. |
| D3 | When Large Package applies, also show AHS? | No. Show Large Package only, and note that AHS is not added on top (stated for UPS; FedEx assumed the same, **verify**). |
| D4 | AHS minimum billable weight (one secondary source cites 40 lb, carrier unnamed) | Do **not** apply it until you or I can confirm it on the UPS/FedEx surcharge pages. |
| D5 | Zero or sub-1 lb weight | Treat as 1 lb minimum billable, with a note. |
| D6 | USPS nonrectangular (tube) DIM: Priority uses 0.785 × volume ÷ 166 with round-off; Ground Advantage uses 0.785 ÷ 139 with round-up | Model both exactly as the DMM states, with an explain step quoting the paragraph. |

## Still open before engine code

- **UPS and FedEx primary check.** Their sites block automated reads. Please open these in a browser and paste or screenshot the size and surcharge sections:
  - UPS: <https://www.ups.com/us/en/support/shipping-support/shipping-dimensions-weight> and the "Additional Handling" / "Large Package" surcharge pages
  - FedEx: <https://www.fedex.com/en-us/shipping/dimensional-weight.html> and the 2026 Service Guide surcharge section

  I will then mark R4–R6 verified, or correct them.
- **Priority Mail 130 in L+G maximum:** confirm on the Notice 123 quick reference.
- **DHL dimension rounding** (whole cm before dividing, or not): check the DHL Express rate guide.

## Gate 1 approval

- [x] Decisions D1–D6: recommendations adopted (cm converted to inches for UPS/FedEx/USPS; DHL kept as "international"; AHS not added on top of Large Package; no 40 lb AHS minimum; 1 lb minimum billable; USPS tube rules modelled from the DMM).
- [x] Approved by Pack Legacy, 12 Nov 2026.

## Build status (Definition of Done, section 16.1)

| Item | Status |
|------|--------|
| Engine, schema, explain steps, flags (steps D) | Done: `src/tools-core/tools/dim-weight.ts`, `schemas/dim-weight.ts`, `schemas/carriers.ts` |
| Golden (18), property (6) and schema tests (step E) | Pass; engine 98 % line coverage |
| Widget: live result, URL state, unit toggle, field errors, keyboard (step F) | Done |
| Content: answer, key takeaway, method, 2025–26 changes, examples, tables, mistakes, 8 FAQs, sources (step G) | Done; every number read from rules or computed by the engine |
| SEO: title, meta, canonical, WebApplication + BreadcrumbList + FAQPage JSON-LD, OG image with engine example (step H) | Done |
| Quote pre-fill (step I) and API (step J) | Done; e2e verifies both |
| Default result, working, tables and FAQ in HTML without JS | Verified (e2e) |
| Accessibility | axe: 0 serious; Lighthouse 100 |
| SEO / best practices (production mode) | Lighthouse 100 / 100 |
| Performance (mobile) | **81–82 locally, target 95.** The blocker is framework JS (react-dom, ~1 s simulated boot), not this tool: an empty tool page scores 76. Re-measure on the Vercel preview. |
| Rich Results Test | **Not run** (Google tool, needs a public URL). JSON-LD structure is checked in e2e. |
| Manual cross-check against official calculators | USPS: DMM cubic worked example matches. **UPS/FedEx: blocked** until their pages are supplied. |
| UPS/FedEx rules verified against carrier pages | **Open.** The page shows a "not yet verified" note for both. |
| Gate 2 preview approval | Needs the Vercel preview (GitHub repo + Vercel project). |

---

## Tester review, 17 Nov 2026

- **cm / kg input** now uses each carrier's metric rule: UPS, FedEx and DHL Express divide by 5,000 cm³/kg after rounding each side up to a whole cm. UPS and FedEx round up to the next whole kg (UPS metric dimensions guide; FedEx assumed to match, not yet confirmed); DHL to the next 0.5 kg. USPS has no metric rule, so it stays in inches/lb and the widget shows the kg equivalent. Size surcharges and limits are still checked in inches; the 90 lb Large Package minimum becomes 41 kg.
- **in / lb input**: DHL Express now uses its published 139 in³/lb (previously always metric).
- **Packaging**: Box, Poly mailer / envelope, Mylar bag / pouch (Mylar is USPS soft packaging for cubic). Tube stays available in the API only.
- **How it works**: the step-by-step working is always visible under the result (all tools).
- New golden cases #19–#25.

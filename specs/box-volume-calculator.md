# Spec: Box Volume & CBM Calculator

- Slug: `/tools/box-volume-calculator/`
- Status: **Gate 1 approved 12 Nov 2026** (owner: "approved", all six recommendations accepted)
- Rules files: `containers.json`
- Shared code: `lib/units.ts` (conversions), `lib/geometry.ts` (`orientations`, `volume`)
- Research date: 12 Nov 2026

---

## A. Market

**Primary keyword (working):** box volume calculator. Secondary: CBM calculator, cubic feet calculator for boxes, how many boxes fit in a 20ft container.

**Intent:** a quick calculation ("how many cubic feet / CBM is this carton or this order?"), often followed by a planning question ("how many will fit in a container?").

**Who ranks (SERP 12 Nov 2026):** AMZ Prep (CBM and cubic feet calculators), Inch Calculator, ZIK Analytics, GetOneCart, Shipping Solutions blog, Alibaba trade tools (multi-carton), Golocad, Cogoport, Freight Sidekick, InventoryHero.

**Likely gaps (our edge), to be confirmed page by page before launch:**

| Gap | Note |
|-----|------|
| Container fit estimated as container CBM ÷ carton CBM | That ignores whole-carton stacking. A 24 × 18 × 12 in carton gives 33.2 ÷ 0.085 = 390 cartons in a 20 ft container by volume, but only **315** fit as whole cartons (golden case 3) |
| No weight check | Heavy cartons hit the payload limit before the space limit (golden case 6) |
| No "this side up" | Upright-only cartons fit fewer (golden case 8) |
| Container sizes not sourced | Most pages give unsourced round numbers; we cite a shipping line |
| One unit system | We show in³, ft³, L and m³ together for any input unit |

**FAQ seeds:**
1. How do I calculate the volume of a box?
2. How do I convert cubic inches to cubic feet?
3. What is CBM and how is it calculated?
4. How many cubic feet are in a 20 ft container?
5. How many boxes fit in a 40 ft container?
6. Why does my freight forwarder's carton count differ from the CBM estimate?

---

## B. Inputs

| Input | Type / unit | Default | Min / max | Notes |
|-------|-------------|---------|-----------|-------|
| Carton L, W, H | number; in, cm or mm | 24 × 18 × 12 in | > 0; ≤ 120 in (3,048 mm) | **Outside** dimensions, labelled as such |
| Quantity | integer | 1 | 1 – 1,000,000 | |
| Carton gross weight | number; lb with in, kg with cm/mm | empty | 0 – 2,000 lb (907 kg) | Optional; turns on the payload check |
| Orientation | free \| this side up | free | | Upright locks carton height to vertical |
| Containers | 20 ft, 40 ft, 40 ft HC (multi) | all three | ≥ 1 | |

## Logic

1. **Normalise** sides to mm (exact: 1 in = 25.4 mm). No rounding.
2. **Volume per carton**: L × W × H in the input unit, then shown as in³, ft³ (÷ 1,728), litres and m³ (CBM). Exact constants from `lib/units.ts`.
3. **Totals**: per-carton volume × quantity, plus total weight when a weight is entered.
4. **Container fit (per container)**, uniform stacking:
   - For each carton orientation (6 in free mode; 2 in upright mode, height fixed), count = ⌊Lc ÷ l⌋ × ⌊Wc ÷ w⌋ × ⌊Hc ÷ h⌋ using container **inside** dimensions.
   - Keep the orientation with the highest count (ties: first in a fixed order, so results are stable).
   - A carton must also pass through the door: two of its sides (one being the height in upright mode) must be ≤ door width and door height. If not, fit = 0 with `NO_DOOR_FIT`.
5. **Payload check**: when weight is entered, weight cap = ⌊payload ÷ carton weight⌋. Fit = min(space count, weight cap). Report which limit decides.
6. **Containers needed** for the quantity = ⌈quantity ÷ fit⌉ for each container type; show remaining space in the last container.
7. **Utilisation** = fit × carton volume ÷ container inside volume (computed from the inside dimensions, not the nominal capacity).
8. **Nominal comparison**: container capacity ÷ carton volume, shown only in the explanation to show why the simple CBM method overcounts.

Display rounding happens last: in³ 2 dp, ft³ 3 dp, L 2 dp, m³ 4 dp; counts are whole numbers.

## Rules used

Source: **Evergreen Line, Container Information** (shipping-line page), https://www.evergreen-line.com/container/jsp/CNTR_ContainerInformation.jsp, read 12 Nov 2026. The page says the dimensions are "for guidance only since individual containers can vary slightly."

| Rule | 20 ft dry | 40 ft dry | 40 ft HC dry |
|------|-----------|-----------|--------------|
| Inside L × W × H (mm) | 5,898 × 2,352 × 2,393 | 12,032 × 2,352 × 2,385 | 12,032 × 2,352 × 2,690 |
| Door W × H (mm) | 2,340 × 2,280 | 2,343 × 2,280 | 2,343 × 2,585 |
| Capacity (m³) | 33.2 | 67.5 | 76.4 |
| Tare (kg) | 2,120 | 4,000 | 4,200 (see D1) |
| Max payload (kg) | 28,360 | 26,480 | 26,280 (see D1) |
| Max gross (kg) | 30,480 | 30,480 | 30,480 (see D1) |

Each row checks: payload = max gross − tare.

> **Correction to the current seed data** (`containers.json`, taken from DHL and GoFreight articles): the 20 ft inside height is 2,393 mm on Evergreen's page, not 2,330; the 40 ft capacity is 67.5 m³, not 67.7; tares and payloads differ on all three. The seed values will be replaced with the Evergreen figures after approval.

Other shipping lines (Hapag-Lloyd, Maersk, MSC, CMA CGM) block automated reading, so they could not be cross-checked.

## Outputs and flags

- Volume card: per carton and total, in in³, ft³, L and m³.
- Container table: fit per container, orientation used, limiting factor (space or weight), containers needed, utilisation %.
- Flags:
  - `WEIGHT_LIMITED`: payload, not space, sets the count.
  - `NO_DOOR_FIT`: the carton cannot pass the door.
  - `NO_CONTAINER_FIT`: a carton is larger than the inside of a container.
  - `UNIFORM_STACK`: always shown as info: "Count assumes all cartons stacked the same way. A load plan that mixes orientations can sometimes fit more."
  - `ROAD_WEIGHT`: info when total weight in a container exceeds 20,000 kg: "Road weight limits in many countries are lower than the container maximum. Check with your forwarder."
  - `CONTAINER_VARIES`: info: container sizes vary slightly by builder.

## Edge cases

- Cartons entered in any order (L/W/H swapped) give identical results in free mode.
- Upright mode: the entered H is the vertical side; swapping L and W changes nothing.
- A side exactly equal to the container dimension fits (float guard on the floor).
- Weight 0 or empty: no payload check.
- Quantity larger than one container: containers needed > 1; the last one shows its fill.
- mm input with very small cartons: counts stay exact integers, no overflow (max about 10⁹).

## Golden cases (container figures: Evergreen; conversions: exact definitions)

| # | Input | Expected output | Tests |
|---|-------|-----------------|-------|
| 1 | 24 × 18 × 12 in | 5,184 in³; **3.000 ft³**; 84.95 L; **0.0850 m³** | in → ft³ / CBM |
| 2 | 60 × 40 × 30 cm | 72,000 cm³ = **0.0720 m³**; 72.00 L; 4,393.71 in³; **2.543 ft³** | cm → all |
| 3 | 24 × 18 × 12 in, free, 20 ft | **315** (9 × 5 × 7, as entered); 80.6 % used. Nominal 33.2 ÷ 0.0850 = 390 would overcount | grid fit vs CBM shortcut |
| 4 | Same, 40 ft / 40 ft HC | 40 ft **665** (19 × 5 × 7); 40 HC **780** (39 × 5 × 4, carton on its 12 × 18 face) | best orientation differs per container |
| 5 | 24 × 18 × 12 in, qty 1,000 | total **3,000 ft³ / 84.95 m³**; 20 ft needs **4** (last holds 55); 40 HC needs **2** (last holds 220) | totals + containers needed |
| 6 | 60 × 40 × 30 cm, 120 kg each, 20 ft | space 315; weight ⌊28,360 ÷ 120⌋ = **236** → fit 236, `WEIGHT_LIMITED` | payload cap |
| 7 | Same, 40 ft | space 700; weight ⌊26,480 ÷ 120⌋ = **220** → 220, `WEIGHT_LIMITED` | payload cap |
| 8 | 16 × 12 × 10 in, 40 HC: free vs upright | free **2,106** (39 × 9 × 6, on its side); upright **2,030** (29 × 7 × 10) | orientation lock |
| 9 | 10 × 8 × 4 in, 20 ft | **6,003** (29 × 9 × 23); 94.8 % used | many small cartons |
| 10 | 100 × 100 × 50 in (2,540 × 2,540 × 1,270 mm) | 20 ft and 40 ft: inside height 2,393 / 2,385 mm < 2,540 and width 2,352 < 2,540 → **0, `NO_CONTAINER_FIT`**. 40 HC: **4** (4 × 1 × 1, standing on a 100 × 50 face; passes the 2,343 × 2,585 mm door) | rejection + HC-only fit |

Property tests:
- Free-mode fit never changes when L, W, H are permuted.
- Upright fit ≤ free fit.
- Fit × carton volume ≤ container inside volume.
- Fit with a weight entered ≤ fit without.

## Quote hand-off (section 14)

- **L / W / H / unit:** carton dimensions as entered.
- **Project Details:** "Carton 24 x 18 x 12 in, qty 1,000, 3,000 ft³ (84.95 CBM). Fits 780 per 40 ft HC (2 containers)."
- **Material:** blank (the user picks on the quote form).

## Decisions needed at Gate 1

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | Evergreen prints two weight rows for the 40 ft HC (MGW 30,480 kg / payload 26,280 kg, and MGW 32,500 kg / payload 28,750 kg) without labels. Which do we use? | Use **30,480 / 26,280**. It matches the other two containers and is the lower, safer figure. Mention in the FAQ that newer high cubes are rated up to 32,500 kg. |
| D2 | Packing method: uniform stacking (one orientation for the whole load) or mixed orientations? | **Uniform** for v1, with the `UNIFORM_STACK` note. It is simple to check by hand and matches what most people expect. Mixed packing can come later. |
| D3 | Road weight limits (they vary by country and state) | **Do not calculate them.** Show the `ROAD_WEIGHT` info flag above 20,000 kg instead. |
| D4 | Add air-freight volumetric weight (÷ 5000 / 6000)? | **No.** Link to the dimensional weight calculator (tool 1) for that. |
| D5 | Cartons on pallets inside the container? | **No**, that is tool 7 (pallet calculator). Link to it. |
| D6 | Container source: Evergreen only, or wait for a second line? | **Evergreen now**, cited by name with its "guidance only" note. Add a second line if you can download one (Maersk or Hapag-Lloyd PDF) into `research/`. |

## Gate 1 approval

- [x] D1: 40 ft HC uses MGW 30,480 kg / payload 26,280 kg.
- [x] D2: uniform stacking, with the UNIFORM_STACK note.
- [x] D3: no road-limit calculation; ROAD_WEIGHT info above 20,000 kg.
- [x] D4: no air volumetric weight; link to tool 1.
- [x] D5: no pallets; link to tool 7.
- [x] D6: Evergreen Line as the single cited source for now.
- [x] Approved by Pack Legacy, 12 Nov 2026.

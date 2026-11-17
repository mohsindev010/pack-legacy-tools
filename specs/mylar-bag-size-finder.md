# Spec: Mylar Bag Size Finder

- Slug: `/tools/mylar-bag-size-finder/`
- Status: **built 17 Nov 2026 on Claude's recommended decisions; confirm at Gate 2**
- Rules files: `mylar-presets.json`, `bulk-density.json`

## Inputs

Fill weight (lb, kg, oz, g; default 4 lb), product (11 densities, or "other" with g/L; default white rice), headspace % (default 10).

## Logic

1. Product volume (L) = weight (g) ÷ bulk density (g/L).
2. Required = product volume × (1 + headspace %).
3. Bag capacity = its sold size (US quart 0.946352946 L, gallon = 4 quarts).
4. Recommend the smallest bag that covers it (on a tie, the first listed: stand-up before flat). If none does, ⌈required ÷ largest⌉ × the 5 gallon bag (`SPLIT_INTO_BAGS`).
5. Table: every bag's fill % and how much of the product it holds with the headspace.

## Rules

- Bulk densities: The Engineering ToolBox, "bulk density of foods and materials" (rice 770, beans 700, peas 800, wheat 770, corn 720, oats 420, flour 600, sugar 800, whole milk powder 320, roasted coffee 368, ground coffee 400 g/L). Verified 17 Nov 2026.
- Bag sizes: 72 Hours listings (quart 6 × 8 × 2 zip, 6 × 10 flat; gallon 10 × 14 × 4 zip, 10 × 16 flat; 2 gallon 14 × 18 × 6 zip) and the Canadian Preparedness guide (5 gallon 20 × 30). Sizes differ between makers, so `verifiedOn` stays null.

## Decisions (recommendations applied)

| # | Question | Decision |
|---|---|---|
| D1 | Capacity basis | Sold (nominal) capacity, not a geometric pouch formula; flagged `NOMINAL_CAPACITY`. |
| D2 | Headspace | 10 % default, editable 0–50 %. An assumption, stated in the working. |
| D3 | Pack Legacy bag sizes | Add as presets when supplied. |

## Golden cases (tests/golden/storage-tools.test.ts)

4 lb rice → 2.356 L, 2.592 L required → 1 gallon (62 % full; holds 5.84 lb). 1 lb flour → quart. 30 lb rice → 2 × 5 gallon. A 5 gallon bag holds 29.21 lb of rice. Custom 500 g/L, 1 kg, 0 % → 2 L → gallon.

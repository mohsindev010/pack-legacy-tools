# Spec: Pallet & Container Load Calculator

- Slug: `/tools/pallet-calculator/`
- Status: **built 17 Nov 2026 on Claude's recommended decisions (owner asked to build the remaining tools); decisions below to confirm at Gate 2**
- Rules files: `pallets.json`, `containers.json`
- Shared code: `lib/packing.ts` (`bestLayer`), used for cartons on a layer and pallets on a container floor

## Inputs

| Input | Unit | Default | Notes |
|---|---|---|---|
| Carton L × W × H | in or cm | 12 × 10 × 8 in | outside size |
| Weight per carton | lb or kg | empty | optional; enables load limits |
| Quantity | cartons | 1 | pallets and containers needed |
| Pallet | preset | GMA 48 × 40 in | GMA, 48 × 48, EPAL 1, EPAL 2, EPAL 3 |
| Pallet height, weight, load limit, overhang | | preset / 0 | each editable |
| Maximum loaded height | in or cm | 60 in | includes the pallet |
| This side up | | off | carton height stays vertical |
| Containers / stacking | | all three / off | |

## Logic

1. Usable area = pallet footprint + 2 × overhang.
2. For each allowed vertical side: best layer = uniform grid either way, or a two-block pattern (a band of one orientation, the leftover band turned 90°, split along the length or width). Layers = ⌊(height limit − pallet height) ÷ carton height⌋. Keep the orientation with the most cartons.
3. Weight cap = ⌊load limit ÷ carton weight⌋ (the load limit is cargo only). Layers used = ⌈cartons ÷ per layer⌉; loaded height and gross weight follow.
4. Containers: the same packing places pallets on the floor (Evergreen inside sizes). A loaded pallet must be ≤ inside height and ≤ door height; stacking adds ⌊inside height ÷ loaded height⌋ levels when allowed; payload ÷ gross pallet weight can cap the count.

## Rules

| Pallet | Footprint | Height | Weight | Load limit | Source | Verified |
|---|---|---|---|---|---|---|
| EPAL 1 | 1200 × 800 mm | 144 mm | 25 kg | 1,500 kg | EPAL data sheet | 17 Nov 2026 |
| EPAL 2 | 1200 × 1000 mm | 162 mm | 35 kg | 1,250 kg | EPAL data sheet | 17 Nov 2026 |
| EPAL 3 | 1000 × 1200 mm | 144 mm | 30 kg | 1,500 kg | EPAL data sheet | 17 Nov 2026 |
| GMA | 48 × 40 in | 5.5 in | 40 lb | 2,500 lb | typical (sources disagree: 4.75–6.5 in, 30–55 lb) | no |
| 48 × 48 | 48 × 48 in | 5.5 in | 45 lb | 2,500 lb | typical | no |

## Decisions (recommendations applied)

| # | Question | Decision |
|---|---|---|
| D1 | Layer pattern | Uniform + two-block patterns; note that interlocked patterns from pallet software can fit more. |
| D2 | Default height limit | 60 in including the pallet, editable. |
| D3 | GMA / 48 × 48 values | Typical values flagged "check your supplier", every value editable. |
| D4 | Containers | Single tier by default; stacking is a checkbox. |

## Golden cases (tests/golden/pallet-calculator.test.ts)

12 × 10 × 8 in on GMA → 100 (20 × 5, on its side); upright 96. 16 × 12 footprint on 48 × 40 → 10 per layer (two-block; uniform 9). 40 × 30 × 25 cm upright on EPAL 1 → 8 × 5 = 40. 40 lb cartons → 62 (2,500 lb limit), 2,520 lb gross. GMA pallets: 9 in a 20 ft, 20 in a 40 ft; EPAL 1: 11 and 25. 95.5 in load → too tall for 20 ft and 40 ft, fits 40 ft HC. Stacked 37.5 in loads → 18 in a 20 ft.

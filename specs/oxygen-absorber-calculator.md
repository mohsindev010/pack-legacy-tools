# Spec: Oxygen Absorber Calculator

- Slug: `/tools/oxygen-absorber-calculator/`
- Status: **built 17 Nov 2026 on Claude's recommended decisions; confirm at Gate 2**
- Rules files: `o2-absorbers.json`, `mylar-presets.json`

## Inputs

Container (6 mylar bag sizes, #10 can, 5 and 6 gallon pails, or a custom volume in gal, qt, L, cc or in³), product weight (lb, kg, oz, g; empty = empty container), number of containers.

## Logic (Sorbent Systems method)

1. Container volume (cc).
2. Product volume = product weight in grams, counted as cc (1 g = 1 cc).
3. Residual air = container − product (headspace + voidspace). Below zero → `OVERFULL` error.
4. Oxygen = residual air × 0.21.
5. Packets: the fewest packets whose total ≥ oxygen, then the smallest total; above 3 × the largest packet, whole largest packets first. Also a one-size table.

## Rules

| Rule | Value | Source | Verified |
|---|---|---|---|
| Oxygen in air | 21 % | Sorbent Systems | 17 Nov 2026 |
| Product volume | 1 g = 1 cc | Sorbent Systems | 17 Nov 2026 |
| #10 can / 5 gal pail / 6 gal pail | 3,980 / 18,942 / 22,730.4 cc | Sorbent Systems | 17 Nov 2026 |
| Packet sizes | 50, 100, 300, 500, 750, 1000, 1500, 2000, 2500 cc | common retail sizes | no |

Note: the Sorbent Systems page prints 628.53 cc for its rice example, but 3,066 × 0.21 = 643.9 cc. The tool uses the correct product; the page's 750 cc recommendation still holds.

## Decisions (recommendations applied)

| # | Question | Decision |
|---|---|---|
| D1 | Product volume | Sorbent's 1 g = 1 cc (published, slightly conservative), not bulk density, which would hide the air between grains. |
| D2 | Safety margin | Rounding up to a packet size only; no extra multiplier. |
| D3 | Moist foods | Info note: absorbers are for dry, low-moisture foods. |

## Golden cases (tests/golden/storage-tools.test.ts)

5 gal pail + 35 lb rice → 3,066 cc air → 643.9 cc → 750 cc. Empty gallon bag → 794.9 → 1,000. Gallon + 4 lb rice → 413.9 → 500 (10 bags → 10 × 500). Empty #10 can → 835.8 → 1,000. 1,000 L → 84 × 2,500. 1,600 cc → one 2,000; 2,600 cc → 2,500 + 100.

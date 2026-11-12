// All unit conversions. Constants are exact by definition (international yard
// and pound agreement, 1959), so they live here rather than in rules JSON.

export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;
export const IN3_PER_FT3 = 1728;
export const L_PER_IN3 = 0.016387064;
export const M3_PER_FT3 = 0.028316846592;
export const M3_PER_IN3 = 0.000016387064;
export const G_PER_OZ = 28.349523125;
export const MM_PER_PT = 0.0254; // 1 pt (caliper) = 0.001 in
export const UM_PER_PT = 25.4;

export type LengthUnit = "in" | "cm" | "mm";
export type WeightUnit = "lb" | "kg" | "g" | "oz";

export const inToCm = (x: number) => x * CM_PER_IN;
export const cmToIn = (x: number) => x / CM_PER_IN;
export const mmToIn = (x: number) => x / (CM_PER_IN * 10);
export const inToMm = (x: number) => x * CM_PER_IN * 10;

export const lbToKg = (x: number) => x * KG_PER_LB;
export const kgToLb = (x: number) => x / KG_PER_LB;
export const ozToG = (x: number) => x * G_PER_OZ;
export const gToOz = (x: number) => x / G_PER_OZ;

export const in3ToFt3 = (x: number) => x / IN3_PER_FT3;
export const ft3ToIn3 = (x: number) => x * IN3_PER_FT3;
export const in3ToL = (x: number) => x * L_PER_IN3;
export const in3ToM3 = (x: number) => x * M3_PER_IN3;
export const ft3ToM3 = (x: number) => x * M3_PER_FT3;
export const cm3ToIn3 = (x: number) => x / CM_PER_IN ** 3;
export const in3ToCm3 = (x: number) => x * CM_PER_IN ** 3;

/** Convert a length in any supported unit to inches. */
export function toIn(x: number, unit: LengthUnit): number {
  if (unit === "in") return x;
  if (unit === "cm") return cmToIn(x);
  return mmToIn(x);
}

/** Convert inches to any supported length unit. */
export function fromIn(x: number, unit: LengthUnit): number {
  if (unit === "in") return x;
  if (unit === "cm") return inToCm(x);
  return inToMm(x);
}

/** Convert a weight in any supported unit to pounds. */
export function toLb(x: number, unit: WeightUnit): number {
  switch (unit) {
    case "lb":
      return x;
    case "kg":
      return kgToLb(x);
    case "g":
      return kgToLb(x / 1000);
    case "oz":
      return x / 16;
  }
}

/** Convert a weight in any supported unit to kilograms. */
export function toKg(x: number, unit: WeightUnit): number {
  return lbToKg(toLb(x, unit));
}

// Paper basis weights: grammage (g/m²) per pound of basis weight.
export const G_PER_LB = 453.59237;
export const M2_PER_IN2 = 0.00064516;
export const M2_PER_FT2 = 0.09290304;
export const UM_PER_MM = 1000;

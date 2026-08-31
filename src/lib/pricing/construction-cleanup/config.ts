import type { EstimateBasedPricingConfig } from "../estimate-shared";

export type ConstructionMaterialType =
  | "drywall"
  | "lumber"
  | "flooring"
  | "cabinets"
  | "roofing"
  | "other";

export const CONSTRUCTION_MATERIAL_OPTIONS: { value: ConstructionMaterialType; label: string }[] = [
  { value: "drywall", label: "Drywall" },
  { value: "lumber", label: "Lumber / Wood Scraps" },
  { value: "flooring", label: "Flooring" },
  { value: "cabinets", label: "Cabinets" },
  { value: "roofing", label: "Roofing Material" },
  { value: "other", label: "Other Construction Debris" },
];

export const CONSTRUCTION_MATERIAL_LABELS: Record<ConstructionMaterialType, string> = {
  drywall: "Drywall",
  lumber: "Lumber / Wood Scraps",
  flooring: "Flooring",
  cabinets: "Cabinets",
  roofing: "Roofing Material",
  other: "Other Construction Debris",
};

/**
 * PRICING NOT YET ESTABLISHED — see estimate-shared/calculate.ts's
 * EstimateBasedPricingConfig doc comment. `pricePerSeverityPointCents`
 * is intentionally left unset; every submission is currently priced as
 * "pending review" rather than an invented number. Construction debris
 * in particular may need weight-based pricing (drywall/roofing are
 * heavy relative to volume) that this generic severity-score engine
 * doesn't yet model — flagged as a decision needed, not assumed away.
 */
export const CONSTRUCTION_CLEANUP_PRICING_CONFIG: EstimateBasedPricingConfig = {
  serviceLabel: "Construction Cleanup",
};

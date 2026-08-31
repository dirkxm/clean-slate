import type { EstimateBasedPricingConfig } from "../estimate-shared";

export type PropertyArea =
  | "house"
  | "garage"
  | "basement"
  | "shed"
  | "yard"
  | "outbuilding"
  | "other";

export const PROPERTY_AREA_OPTIONS: { value: PropertyArea; label: string }[] = [
  { value: "house", label: "House" },
  { value: "garage", label: "Garage" },
  { value: "basement", label: "Basement" },
  { value: "shed", label: "Shed" },
  { value: "yard", label: "Yard" },
  { value: "outbuilding", label: "Outbuilding" },
  { value: "other", label: "Other" },
];

export const PROPERTY_AREA_LABELS: Record<PropertyArea, string> = {
  house: "House",
  garage: "Garage",
  basement: "Basement",
  shed: "Shed",
  yard: "Yard",
  outbuilding: "Outbuilding",
  other: "Other",
};

/**
 * PRICING NOT YET ESTABLISHED — see estimate-shared/calculate.ts's
 * EstimateBasedPricingConfig doc comment. `pricePerSeverityPointCents`
 * is intentionally left unset; every submission is currently priced as
 * "pending review" rather than an invented number.
 */
export const PROPERTY_CLEANOUT_PRICING_CONFIG: EstimateBasedPricingConfig = {
  serviceLabel: "Property Cleanout",
};

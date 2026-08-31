import type { EstimateBasedPricingConfig } from "../estimate-shared";

export type GarageSize = "oneCar" | "twoCar" | "threeCar" | "other";

export const GARAGE_SIZE_OPTIONS: { value: GarageSize; label: string }[] = [
  { value: "oneCar", label: "One-Car Garage" },
  { value: "twoCar", label: "Two-Car Garage" },
  { value: "threeCar", label: "Three-Car Garage" },
  { value: "other", label: "Other / Not Sure" },
];

export const GARAGE_SIZE_LABELS: Record<GarageSize, string> = {
  oneCar: "One-Car Garage",
  twoCar: "Two-Car Garage",
  threeCar: "Three-Car Garage",
  other: "Other / Not Sure",
};

/**
 * PRICING NOT YET ESTABLISHED — see estimate-shared/calculate.ts's
 * EstimateBasedPricingConfig doc comment. `pricePerSeverityPointCents`
 * is intentionally left unset; every submission is currently priced as
 * "pending review" rather than an invented number.
 */
export const GARAGE_CLEANOUT_PRICING_CONFIG: EstimateBasedPricingConfig = {
  serviceLabel: "Garage Cleanout",
};

import type { EstimateBasedPricingConfig } from "../estimate-shared";

export type HouseholdCleanoutScope = "oneToTwoRooms" | "threeToFiveRooms" | "sixPlusRooms" | "wholeHome";

export const HOUSEHOLD_SCOPE_OPTIONS: { value: HouseholdCleanoutScope; label: string }[] = [
  { value: "oneToTwoRooms", label: "1–2 Rooms" },
  { value: "threeToFiveRooms", label: "3–5 Rooms" },
  { value: "sixPlusRooms", label: "6+ Rooms" },
  { value: "wholeHome", label: "Whole Home" },
];

export const HOUSEHOLD_SCOPE_LABELS: Record<HouseholdCleanoutScope, string> = {
  oneToTwoRooms: "1–2 Rooms",
  threeToFiveRooms: "3–5 Rooms",
  sixPlusRooms: "6+ Rooms",
  wholeHome: "Whole Home",
};

/**
 * PRICING NOT YET ESTABLISHED — see estimate-shared/calculate.ts's
 * EstimateBasedPricingConfig doc comment. `pricePerSeverityPointCents`
 * is intentionally left unset; every submission is currently priced as
 * "pending review" rather than an invented number.
 */
export const HOUSEHOLD_CLEANOUT_PRICING_CONFIG: EstimateBasedPricingConfig = {
  serviceLabel: "Household Cleanout",
};

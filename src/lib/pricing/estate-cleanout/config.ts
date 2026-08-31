import type { EstimateBasedPricingConfig } from "../estimate-shared";

export type EstateCleanoutScope =
  | "oneToTwoRooms"
  | "threeToFiveRooms"
  | "sixPlusRooms"
  | "wholeHome"
  | "wholeHomePlusOutbuildings";

export const ESTATE_SCOPE_OPTIONS: { value: EstateCleanoutScope; label: string }[] = [
  { value: "oneToTwoRooms", label: "1–2 Rooms" },
  { value: "threeToFiveRooms", label: "3–5 Rooms" },
  { value: "sixPlusRooms", label: "6+ Rooms" },
  { value: "wholeHome", label: "Whole Home" },
  { value: "wholeHomePlusOutbuildings", label: "Whole Home + Garage/Outbuildings" },
];

export const ESTATE_SCOPE_LABELS: Record<EstateCleanoutScope, string> = {
  oneToTwoRooms: "1–2 Rooms",
  threeToFiveRooms: "3–5 Rooms",
  sixPlusRooms: "6+ Rooms",
  wholeHome: "Whole Home",
  wholeHomePlusOutbuildings: "Whole Home + Garage/Outbuildings",
};

/**
 * PRICING NOT YET ESTABLISHED — see estimate-shared/calculate.ts's
 * EstimateBasedPricingConfig doc comment. `pricePerSeverityPointCents`
 * is intentionally left unset; every submission is currently priced as
 * "pending review" rather than an invented number.
 */
export const ESTATE_CLEANOUT_PRICING_CONFIG: EstimateBasedPricingConfig = {
  serviceLabel: "Estate Cleanout",
};

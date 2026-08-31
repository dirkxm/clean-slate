export { calculateApplianceRemovalPrice } from "./calculate";
export { APPLIANCE_ITEMS, DISCONNECTION_LABELS, REFRIGERANT_RECOVERY_FEE_CENTS } from "./config";
export type {
  ApplianceItemConfig,
  ApplianceItemKey,
  ApplianceRemovalInput,
  ApplianceRemovalPricingResult,
  ApplianceSelection,
} from "./types";
// Job-modifier types/constants (access, disassembly/disconnection,
// heavy/oversized, additional location, minimum charge, review
// threshold) are shared, not duplicated — import from ../shared.
export {
  ACCESS_FEES_CENTS,
  ACCESS_LABELS,
  ADDITIONAL_LOCATION_FEE_CENTS,
  DISASSEMBLY_FEES_CENTS,
  HEAVY_OVERSIZED_FEE_CENTS,
  LARGE_JOB_REVIEW_THRESHOLD_CENTS,
  MINIMUM_JOB_CHARGE_CENTS,
} from "../shared";
export type { AccessType, DisassemblyType } from "../shared";

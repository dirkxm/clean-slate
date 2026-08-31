export { calculateGeneralJunkRemovalPrice } from "./calculate";
export { DISASSEMBLY_LABELS, GENERAL_JUNK_ITEMS } from "./config";
export type {
  GeneralJunkItemConfig,
  GeneralJunkItemKey,
  GeneralJunkRemovalInput,
  GeneralJunkRemovalPricingResult,
  GeneralJunkSelection,
} from "./types";
// Job-modifier types/constants are shared, not duplicated — import from ../shared.
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

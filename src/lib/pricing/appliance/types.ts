import type { AccessType, DisassemblyType, JobberLineItem } from "../shared";

export type ApplianceItemKey =
  | "refrigeratorStandard"
  | "refrigeratorLarge"
  | "miniFridge"
  | "freezer"
  | "washer"
  | "dryer"
  | "washerDryerStackable"
  | "stoveRange"
  | "wallOven"
  | "dishwasher"
  | "microwave"
  | "waterHeater"
  | "acUnitWindow"
  | "furnace";

export interface ApplianceItemConfig {
  label: string;
  /** Base price in integer cents. */
  priceCents: number;
  /**
   * True for items that legally require certified refrigerant recovery
   * before disposal (fridges, freezers, AC units) — each such item
   * selected triggers `REFRIGERANT_RECOVERY_FEE_CENTS`, once per unit.
   */
  requiresRefrigerantRecovery: boolean;
}

export interface ApplianceSelection {
  itemKey: ApplianceItemKey;
  quantity: number;
}

export interface ApplianceRemovalInput {
  items: ApplianceSelection[];
  access: AccessType;
  /** "Disassembly" reused as "disconnection" (gas/water/electrical) for appliances — same tiers/fees. */
  disassembly: DisassemblyType;
  /** Count of items the customer identifies as heavy/oversized — charged per item, not per job. */
  heavyOversizedItemCount: number;
  /** Number of locations beyond the first (first location is always free). */
  additionalLocations: number;
}

export interface ApplianceRemovalPricingResult {
  itemSubtotalCents: number;
  accessFeeCents: number;
  disassemblyFeeCents: number;
  heavyOversizedFeeCents: number;
  refrigerantRecoveryFeeCents: number;
  additionalLocationFeeCents: number;
  preMinimumTotalCents: number;
  minimumAdjustmentCents: number;
  finalTotalCents: number;
  /**
   * True once `finalTotalCents` exceeds `LARGE_JOB_REVIEW_THRESHOLD_CENTS`.
   * `finalTotalCents` is still the real calculated amount — this flag
   * only signals that it should be presented as needing review rather
   * than as a guaranteed bookable price.
   */
  requiresReview: boolean;
  lineItems: JobberLineItem[];
}

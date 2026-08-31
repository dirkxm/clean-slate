import type { AccessType, DisassemblyType, JobberLineItem } from "../shared";

export type GeneralJunkItemKey =
  | "bagSmall"
  | "bagLarge"
  | "boxMisc"
  | "yardWaste"
  | "tire"
  | "exerciseEquipment"
  | "electronics"
  | "carpetFlooring"
  | "constructionDebrisSmall"
  | "hotTub"
  | "piano"
  | "safe";

export interface GeneralJunkItemConfig {
  label: string;
  /** Base price in integer cents. */
  priceCents: number;
}

export interface GeneralJunkSelection {
  itemKey: GeneralJunkItemKey;
  quantity: number;
}

export interface GeneralJunkRemovalInput {
  items: GeneralJunkSelection[];
  access: AccessType;
  /** "Disassembly" reused for general junk too (e.g. breaking down a piano, safe, or hot tub) — same tiers/fees. */
  disassembly: DisassemblyType;
  /** Count of items the customer identifies as heavy/oversized — charged per item, not per job. */
  heavyOversizedItemCount: number;
  /** Number of locations beyond the first (first location is always free). */
  additionalLocations: number;
}

export interface GeneralJunkRemovalPricingResult {
  itemSubtotalCents: number;
  accessFeeCents: number;
  disassemblyFeeCents: number;
  heavyOversizedFeeCents: number;
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

export type FurnitureItemKey =
  | "chair"
  | "diningChair"
  | "recliner"
  | "loveseat"
  | "sofa"
  | "sectionalSmall"
  | "sectionalLarge"
  | "mattressTwinFull"
  | "mattressQueenKing"
  | "boxSpring"
  | "bedFrame"
  | "dresser"
  | "desk"
  | "diningTable"
  | "entertainmentCenter"
  | "tvStand"
  | "bookshelf"
  | "cabinet"
  | "largeHutch"
  | "patioFurniture";

export type AccessType =
  | "garage"
  | "outsideCurb"
  | "firstFloor"
  | "basement"
  | "upstairs"
  | "multipleFloorsDifficult";

export type DisassemblyType = "none" | "simple" | "difficult";

export interface FurnitureItemConfig {
  label: string;
  /** Base price in integer cents. */
  priceCents: number;
}

export interface FurnitureSelection {
  itemKey: FurnitureItemKey;
  quantity: number;
}

export interface FurnitureRemovalInput {
  items: FurnitureSelection[];
  access: AccessType;
  disassembly: DisassemblyType;
  heavyOversized: boolean;
  /** Number of locations beyond the first (first location is always free). */
  additionalLocations: number;
}

/**
 * A single structured line item suitable for handing to Jobber later.
 * `unitPrice` and `total` are integer cents, not dollars.
 */
export interface JobberLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface FurnitureRemovalPricingResult {
  itemSubtotalCents: number;
  accessFeeCents: number;
  disassemblyFeeCents: number;
  heavyOversizedFeeCents: number;
  additionalLocationFeeCents: number;
  preMinimumTotalCents: number;
  minimumAdjustmentCents: number;
  finalTotalCents: number;
  lineItems: JobberLineItem[];
}

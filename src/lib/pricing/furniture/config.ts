import type {
  AccessType,
  DisassemblyType,
  FurnitureItemConfig,
  FurnitureItemKey,
} from "./types";

/**
 * Centralized Furniture Removal pricing configuration.
 *
 * All monetary values are integer cents. This file is the single place to
 * change a price, fee, or the minimum job charge — calculation logic in
 * `calculate.ts` should never need to change when these values do.
 */

export const MINIMUM_JOB_CHARGE_CENTS = 9900;

/**
 * Charged per qualifying heavy/oversized item (not a flat per-job fee).
 * The customer declares how many items are heavy/oversized; there is no
 * per-catalog-item "this item is always heavy" classification — see
 * `FurnitureItemConfig` in types.ts, which only carries a label and price.
 */
export const HEAVY_OVERSIZED_FEE_CENTS = 5000;

export const ADDITIONAL_LOCATION_FEE_CENTS = 2500;

/**
 * If the calculated total exceeds this amount, the job is flagged for
 * manual review instead of being presented as a guaranteed online price.
 * The calculated amount itself is never discarded — see `requiresReview`
 * on FurnitureRemovalPricingResult.
 */
export const LARGE_JOB_REVIEW_THRESHOLD_CENTS = 100000;

export const FURNITURE_ITEMS: Record<FurnitureItemKey, FurnitureItemConfig> = {
  chair: { label: "Chair", priceCents: 3500 },
  diningChair: { label: "Dining Chair", priceCents: 1500 },
  recliner: { label: "Recliner", priceCents: 4500 },
  loveseat: { label: "Loveseat", priceCents: 5500 },
  sofa: { label: "Sofa / Couch", priceCents: 6500 },
  sectionalSmall: { label: "Sectional - Small", priceCents: 9500 },
  sectionalLarge: { label: "Sectional - Large", priceCents: 12500 },
  mattressTwinFull: { label: "Mattress - Twin/Full", priceCents: 4000 },
  mattressQueenKing: { label: "Mattress - Queen/King", priceCents: 5000 },
  boxSpring: { label: "Box Spring", priceCents: 3000 },
  bedFrame: { label: "Bed Frame", priceCents: 4000 },
  dresser: { label: "Dresser / Chest", priceCents: 4500 },
  desk: { label: "Desk", priceCents: 5000 },
  diningTable: { label: "Dining Table", priceCents: 5500 },
  entertainmentCenter: { label: "Entertainment Center", priceCents: 5000 },
  tvStand: { label: "TV Stand", priceCents: 3500 },
  bookshelf: { label: "Bookshelf", priceCents: 3500 },
  cabinet: { label: "Cabinet / Small Hutch", priceCents: 6000 },
  largeHutch: { label: "Large Hutch", priceCents: 10000 },
  patioFurniture: { label: "Patio Furniture Piece", priceCents: 2500 },
};

export const ACCESS_FEES_CENTS: Record<AccessType, number> = {
  garage: 0,
  outsideCurb: 0,
  firstFloor: 0,
  basement: 2500,
  upstairs: 2500,
  multipleFloorsDifficult: 5000,
};

export const ACCESS_LABELS: Record<AccessType, string> = {
  garage: "Garage Access",
  outsideCurb: "Outside / Curb Access",
  firstFloor: "First Floor Access",
  basement: "Basement Access",
  upstairs: "Upstairs Access",
  multipleFloorsDifficult: "Multiple Floors / Difficult Access",
};

export const DISASSEMBLY_FEES_CENTS: Record<DisassemblyType, number> = {
  none: 0,
  simple: 2500,
  difficult: 5000,
};

export const DISASSEMBLY_LABELS: Record<DisassemblyType, string> = {
  none: "No Disassembly",
  simple: "Simple Disassembly",
  difficult: "Difficult Disassembly",
};

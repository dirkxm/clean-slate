import type { AccessType, DisassemblyType } from "./types";

/**
 * Shared job-modifier fee values, reused across services. Values here
 * are identical to Furniture Removal's own (independent) copies in
 * `../furniture/config.ts` as of when this module was created — that
 * file is intentionally left untouched rather than migrated to import
 * from here, to avoid any risk to its already-verified pricing. New
 * services should import from here.
 */

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

export const ADDITIONAL_LOCATION_FEE_CENTS = 2500;

/**
 * Charged per qualifying heavy/oversized item (not a flat per-job fee).
 * Same value/concept as Furniture Removal's own independent copy.
 */
export const HEAVY_OVERSIZED_FEE_CENTS = 5000;

export const MINIMUM_JOB_CHARGE_CENTS = 9900;

/**
 * If a calculated total exceeds this amount, the job is flagged for
 * manual review instead of being presented as a guaranteed online price.
 */
export const LARGE_JOB_REVIEW_THRESHOLD_CENTS = 100000;

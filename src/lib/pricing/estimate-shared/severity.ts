import type { DisassemblyType } from "../shared";
import type { FillLevel } from "./types";

export const FILL_LEVELS: FillLevel[] = ["light", "moderate", "heavy", "veryHeavy"];

export const FILL_LEVEL_LABELS: Record<FillLevel, string> = {
  light: "Lightly Filled",
  moderate: "Moderately Filled",
  heavy: "Heavily Filled",
  veryHeavy: "Very Heavily Filled",
};

/** Plain-language description shown alongside each option — no cubic yards, no trailer fractions, no industry jargon. */
export const FILL_LEVEL_DESCRIPTIONS: Record<FillLevel, string> = {
  light: "A few items here and there — plenty of open space.",
  moderate: "About half full — a noticeable amount of stuff.",
  heavy: "Mostly full — packed with items throughout.",
  veryHeavy: "Completely full, floor to ceiling, wall to wall.",
};

/**
 * Internal severity weighting per fill level — translates the
 * customer's plain-language answer into the internal scoring this
 * engine (and, eventually, real pricing) is based on. Customers never
 * see these numbers.
 */
export const FILL_LEVEL_SEVERITY: Record<FillLevel, number> = {
  light: 1,
  moderate: 2,
  heavy: 3,
  veryHeavy: 4,
};

/**
 * Same three-tier concept/fees as Furniture Removal's "disassembly",
 * reused here as "extra labor" — the general concept of the job needing
 * more than a straightforward carry-out (breaking down a structure,
 * extra disconnection, awkward maneuvering), worded generically since a
 * single label has to fit cleanouts and construction/demolition alike.
 */
export const EXTRA_LABOR_LABELS: Record<DisassemblyType, string> = {
  none: "No Extra Labor Expected",
  simple: "Some Extra Labor Expected",
  difficult: "Significant Extra Labor Expected",
};

import type { AccessType, DisassemblyType, JobberLineItem } from "../shared";

/** How full/occupied a space or pile is — worded so an ordinary homeowner can judge it themselves. */
export type FillLevel = "light" | "moderate" | "heavy" | "veryHeavy";

/**
 * Structured input shared by every "estimate-based" service (cleanouts
 * and construction/demolition) — these are all priced by volume/scope
 * rather than a per-item catalog, so they share this input shape instead
 * of each duplicating it. A specific service's own module still defines
 * its own area/space options and question copy (see e.g.
 * ../garage-cleanout) — this is only the common structural shape.
 */
export interface EstimateBasedInput {
  /** e.g. "Two-Car Garage", "3 Rooms", "House + Garage + Yard" — produced by the specific service's own area/space selection. */
  areaDescription: string;
  fillLevel: FillLevel;
  /** Distinct large items called out by the customer (e.g. an old couch in a garage, a hot tub in a yard). */
  largeItemCount: number;
  /** Items needing special handling: extra-heavy, hazardous, or otherwise non-standard material. */
  heavyOrSpecialItemCount: number;
  access: AccessType;
  /** Reused across services as "extra labor" (disassembly, breakdown, disconnection) — same concept, same tiers as other services. */
  disassembly: DisassemblyType;
  /** Number of additional distinct areas/locations beyond the first. */
  additionalLocations: number;
  /** Optional customer-supplied size hint (e.g. approximate square footage) — informational only until dimension-based pricing is defined. */
  approximateSquareFootage?: number;
  /** Optional free-text notes the customer adds — supplementary context, never the primary structured record. */
  notes?: string;
  /** Small Demolition only: whether hauling away the resulting debris is included in this request, distinct from the demolition labor itself. Unused by other estimate-based services. */
  haulAwayIncluded?: boolean;
}

/**
 * Distinct from the item-catalog services' pricing results: no real
 * per-unit pricing has been established yet for ANY service built on
 * this engine (see calculate.ts's EstimateBasedPricingConfig doc
 * comment). Until a service's config supplies `pricePerSeverityPointCents`,
 * `finalTotalCents` is always 0 and `requiresReview` is always true —
 * never a fabricated number.
 */
export interface EstimateBasedPricingResult {
  /** Unitless internal size/complexity score — for staff reference and as the basis for pricing once real numbers are configured. */
  severityScore: number;
  finalTotalCents: number;
  requiresReview: boolean;
  /** True once a service has real pricing configured — false means this result reflects "not yet priced", not a $0 job. */
  pricingConfigured: boolean;
  lineItems: JobberLineItem[];
}

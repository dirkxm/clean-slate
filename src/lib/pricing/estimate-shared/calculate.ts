import type { JobberLineItem } from "../shared";
import { FILL_LEVEL_SEVERITY } from "./severity";
import type { EstimateBasedInput, EstimateBasedPricingResult } from "./types";

/**
 * Pricing configuration a specific estimate-based service (Household/
 * Garage/Estate/Property Cleanouts, Construction Cleanup, Small
 * Demolition) supplies to this shared engine.
 *
 * PRICING NOT YET ESTABLISHED: as of this writing, no service using
 * this engine sets `pricePerSeverityPointCents` — that is a genuine
 * business decision (how much a unit of cleanout/demolition scope costs)
 * that has not been made, and this was deliberately NOT guessed, unlike
 * the item-catalog services (Appliance/General Junk Removal), where a
 * "best guess for now" was explicitly requested. Leaving it undefined is
 * intentional, not an oversight — `calculateEstimateBasedPrice` reads
 * that as "not yet priced" and returns a $0 total with `requiresReview:
 * true`, never a fabricated number.
 *
 * Once real numbers exist, setting these fields on a service's config is
 * the ONLY change needed to switch it from always-review to an instant
 * calculated price — this calculation logic does not need to change.
 */
export interface EstimateBasedPricingConfig {
  serviceLabel: string;
  /** Cents charged per severity point. Undefined = pricing not yet configured for this service — see doc comment above. */
  pricePerSeverityPointCents?: number;
  /** Flat minimum charge, once pricing is configured. */
  minimumJobChargeCents?: number;
  /** If the calculated total would exceed this, still requires review even with pricing configured. */
  largeJobReviewThresholdCents?: number;
  /** Severity points added per distinct large item called out. */
  largeItemSeverityPoints?: number;
  /** Flat fee per heavy/special-handling item, once pricing is configured. */
  heavyOrSpecialItemFeeCents?: number;
  /** Flat fee per additional location, once pricing is configured. */
  additionalLocationFeeCents?: number;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Unitless internal size/complexity score for an estimate-based job —
 * computed the same way regardless of whether real pricing is
 * configured yet, so it's available to staff (via the Jobber Request
 * form) even before this service has confirmed pricing.
 */
export function calculateEstimateBasedSeverity(
  input: EstimateBasedInput,
  config: EstimateBasedPricingConfig,
): number {
  const fillSeverity = FILL_LEVEL_SEVERITY[input.fillLevel];
  const largeItemSeverity = input.largeItemCount * (config.largeItemSeverityPoints ?? 1);
  return fillSeverity + largeItemSeverity;
}

/**
 * Pure, deterministic estimate-based pricing calculation, shared by
 * every cleanout/construction service. See EstimateBasedPricingConfig's
 * doc comment for why `pricePerSeverityPointCents` is currently unset
 * for every real service — that is the expected, intentional state
 * until real pricing is established, not a bug.
 */
export function calculateEstimateBasedPrice(
  input: EstimateBasedInput,
  config: EstimateBasedPricingConfig,
): EstimateBasedPricingResult {
  if (!isNonNegativeInteger(input.largeItemCount)) {
    throw new Error(
      `largeItemCount must be a non-negative integer, received: ${input.largeItemCount}`,
    );
  }
  if (!isNonNegativeInteger(input.heavyOrSpecialItemCount)) {
    throw new Error(
      `heavyOrSpecialItemCount must be a non-negative integer, received: ${input.heavyOrSpecialItemCount}`,
    );
  }
  if (!isNonNegativeInteger(input.additionalLocations)) {
    throw new Error(
      `additionalLocations must be a non-negative integer, received: ${input.additionalLocations}`,
    );
  }

  const severityScore = calculateEstimateBasedSeverity(input, config);

  if (config.pricePerSeverityPointCents === undefined) {
    return {
      severityScore,
      finalTotalCents: 0,
      requiresReview: true,
      pricingConfigured: false,
      lineItems: [],
    };
  }

  const lineItems: JobberLineItem[] = [];

  const volumeCents = severityScore * config.pricePerSeverityPointCents;
  lineItems.push({
    name: `${config.serviceLabel} — Estimated Scope (${input.areaDescription})`,
    quantity: severityScore,
    unitPrice: config.pricePerSeverityPointCents,
    total: volumeCents,
  });

  const heavyOrSpecialFeeCents =
    input.heavyOrSpecialItemCount * (config.heavyOrSpecialItemFeeCents ?? 0);
  if (heavyOrSpecialFeeCents > 0) {
    lineItems.push({
      name: "Heavy / Special-Handling Item Fee",
      quantity: input.heavyOrSpecialItemCount,
      unitPrice: config.heavyOrSpecialItemFeeCents ?? 0,
      total: heavyOrSpecialFeeCents,
    });
  }

  const additionalLocationFeeCents =
    input.additionalLocations * (config.additionalLocationFeeCents ?? 0);
  if (additionalLocationFeeCents > 0) {
    lineItems.push({
      name: "Additional Location Fee",
      quantity: input.additionalLocations,
      unitPrice: config.additionalLocationFeeCents ?? 0,
      total: additionalLocationFeeCents,
    });
  }

  const preMinimumTotalCents = volumeCents + heavyOrSpecialFeeCents + additionalLocationFeeCents;
  const minimumAdjustmentCents = Math.max(
    0,
    (config.minimumJobChargeCents ?? 0) - preMinimumTotalCents,
  );
  if (minimumAdjustmentCents > 0) {
    lineItems.push({
      name: `${config.serviceLabel} - Minimum Service Adjustment`,
      quantity: 1,
      unitPrice: minimumAdjustmentCents,
      total: minimumAdjustmentCents,
    });
  }

  const finalTotalCents = preMinimumTotalCents + minimumAdjustmentCents;
  const requiresReview =
    config.largeJobReviewThresholdCents !== undefined &&
    finalTotalCents > config.largeJobReviewThresholdCents;

  return {
    severityScore,
    finalTotalCents,
    requiresReview,
    pricingConfigured: true,
    lineItems,
  };
}

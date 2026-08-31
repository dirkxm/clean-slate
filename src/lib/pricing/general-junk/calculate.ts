import {
  ACCESS_FEES_CENTS,
  ACCESS_LABELS,
  ADDITIONAL_LOCATION_FEE_CENTS,
  DISASSEMBLY_FEES_CENTS,
  HEAVY_OVERSIZED_FEE_CENTS,
  LARGE_JOB_REVIEW_THRESHOLD_CENTS,
  MINIMUM_JOB_CHARGE_CENTS,
} from "../shared";
import type { JobberLineItem } from "../shared";
import { DISASSEMBLY_LABELS, GENERAL_JUNK_ITEMS } from "./config";
import type { GeneralJunkRemovalInput, GeneralJunkRemovalPricingResult } from "./types";

const MINIMUM_ADJUSTMENT_LABEL = "General Junk Removal - Minimum Service Adjustment";

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Pure, deterministic General Junk Removal pricing calculation. Mirrors
 * Furniture Removal's calculate.ts exactly in structure (integer cents,
 * same job-modifier fee mechanics). No browser, DOM, or Astro dependency.
 */
export function calculateGeneralJunkRemovalPrice(
  input: GeneralJunkRemovalInput,
): GeneralJunkRemovalPricingResult {
  if (!isNonNegativeInteger(input.additionalLocations)) {
    throw new Error(
      `additionalLocations must be a non-negative integer, received: ${input.additionalLocations}`,
    );
  }

  if (!isNonNegativeInteger(input.heavyOversizedItemCount)) {
    throw new Error(
      `heavyOversizedItemCount must be a non-negative integer, received: ${input.heavyOversizedItemCount}`,
    );
  }

  const lineItems: JobberLineItem[] = [];

  let itemSubtotalCents = 0;

  for (const selection of input.items) {
    const config = GENERAL_JUNK_ITEMS[selection.itemKey];
    if (!config) {
      throw new Error(`Unknown general junk item key: ${selection.itemKey}`);
    }
    if (!isNonNegativeInteger(selection.quantity)) {
      throw new Error(
        `Quantity for "${selection.itemKey}" must be a non-negative integer, received: ${selection.quantity}`,
      );
    }
    if (selection.quantity === 0) {
      continue;
    }

    const total = config.priceCents * selection.quantity;
    itemSubtotalCents += total;

    lineItems.push({
      name: config.label,
      quantity: selection.quantity,
      unitPrice: config.priceCents,
      total,
    });
  }

  const accessFeeCents = ACCESS_FEES_CENTS[input.access];
  if (accessFeeCents === undefined) {
    throw new Error(`Unknown access type: ${input.access}`);
  }
  if (accessFeeCents > 0) {
    lineItems.push({
      name: ACCESS_LABELS[input.access],
      quantity: 1,
      unitPrice: accessFeeCents,
      total: accessFeeCents,
    });
  }

  const disassemblyFeeCents = DISASSEMBLY_FEES_CENTS[input.disassembly];
  if (disassemblyFeeCents === undefined) {
    throw new Error(`Unknown disassembly type: ${input.disassembly}`);
  }
  if (disassemblyFeeCents > 0) {
    lineItems.push({
      name: DISASSEMBLY_LABELS[input.disassembly],
      quantity: 1,
      unitPrice: disassemblyFeeCents,
      total: disassemblyFeeCents,
    });
  }

  const heavyOversizedFeeCents = input.heavyOversizedItemCount * HEAVY_OVERSIZED_FEE_CENTS;
  if (heavyOversizedFeeCents > 0) {
    lineItems.push({
      name: "Heavy / Oversized Item Fee",
      quantity: input.heavyOversizedItemCount,
      unitPrice: HEAVY_OVERSIZED_FEE_CENTS,
      total: heavyOversizedFeeCents,
    });
  }

  const additionalLocationFeeCents = input.additionalLocations * ADDITIONAL_LOCATION_FEE_CENTS;
  if (additionalLocationFeeCents > 0) {
    lineItems.push({
      name: "Additional Location Fee",
      quantity: input.additionalLocations,
      unitPrice: ADDITIONAL_LOCATION_FEE_CENTS,
      total: additionalLocationFeeCents,
    });
  }

  const preMinimumTotalCents =
    itemSubtotalCents + accessFeeCents + disassemblyFeeCents + heavyOversizedFeeCents + additionalLocationFeeCents;

  const minimumAdjustmentCents = Math.max(0, MINIMUM_JOB_CHARGE_CENTS - preMinimumTotalCents);

  if (minimumAdjustmentCents > 0) {
    lineItems.push({
      name: MINIMUM_ADJUSTMENT_LABEL,
      quantity: 1,
      unitPrice: minimumAdjustmentCents,
      total: minimumAdjustmentCents,
    });
  }

  const finalTotalCents = preMinimumTotalCents + minimumAdjustmentCents;

  const requiresReview = finalTotalCents > LARGE_JOB_REVIEW_THRESHOLD_CENTS;

  return {
    itemSubtotalCents,
    accessFeeCents,
    disassemblyFeeCents,
    heavyOversizedFeeCents,
    additionalLocationFeeCents,
    preMinimumTotalCents,
    minimumAdjustmentCents,
    finalTotalCents,
    requiresReview,
    lineItems,
  };
}

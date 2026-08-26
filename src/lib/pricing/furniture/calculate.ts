import {
  ACCESS_FEES_CENTS,
  ACCESS_LABELS,
  ADDITIONAL_LOCATION_FEE_CENTS,
  DISASSEMBLY_FEES_CENTS,
  DISASSEMBLY_LABELS,
  FURNITURE_ITEMS,
  HEAVY_OVERSIZED_FEE_CENTS,
  MINIMUM_JOB_CHARGE_CENTS,
} from "./config";
import type {
  FurnitureRemovalInput,
  FurnitureRemovalPricingResult,
  JobberLineItem,
} from "./types";

const MINIMUM_ADJUSTMENT_LABEL =
  "Furniture Removal - Minimum Service Adjustment";

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Pure, deterministic Furniture Removal pricing calculation.
 *
 * Accepts a customer's selections and returns a structured breakdown plus
 * Jobber-ready line items. All monetary math is done in integer cents to
 * avoid floating point rounding. Has no browser, DOM, or Astro dependency.
 */
export function calculateFurnitureRemovalPrice(
  input: FurnitureRemovalInput,
): FurnitureRemovalPricingResult {
  if (!isNonNegativeInteger(input.additionalLocations)) {
    throw new Error(
      `additionalLocations must be a non-negative integer, received: ${input.additionalLocations}`,
    );
  }

  const lineItems: JobberLineItem[] = [];

  let itemSubtotalCents = 0;

  for (const selection of input.items) {
    const config = FURNITURE_ITEMS[selection.itemKey];
    if (!config) {
      throw new Error(`Unknown furniture item key: ${selection.itemKey}`);
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

  const heavyOversizedFeeCents = input.heavyOversized
    ? HEAVY_OVERSIZED_FEE_CENTS
    : 0;
  if (heavyOversizedFeeCents > 0) {
    lineItems.push({
      name: "Heavy / Oversized Item Fee",
      quantity: 1,
      unitPrice: heavyOversizedFeeCents,
      total: heavyOversizedFeeCents,
    });
  }

  const additionalLocationFeeCents =
    input.additionalLocations * ADDITIONAL_LOCATION_FEE_CENTS;
  if (additionalLocationFeeCents > 0) {
    lineItems.push({
      name: "Additional Location Fee",
      quantity: input.additionalLocations,
      unitPrice: ADDITIONAL_LOCATION_FEE_CENTS,
      total: additionalLocationFeeCents,
    });
  }

  const preMinimumTotalCents =
    itemSubtotalCents +
    accessFeeCents +
    disassemblyFeeCents +
    heavyOversizedFeeCents +
    additionalLocationFeeCents;

  const minimumAdjustmentCents = Math.max(
    0,
    MINIMUM_JOB_CHARGE_CENTS - preMinimumTotalCents,
  );

  if (minimumAdjustmentCents > 0) {
    lineItems.push({
      name: MINIMUM_ADJUSTMENT_LABEL,
      quantity: 1,
      unitPrice: minimumAdjustmentCents,
      total: minimumAdjustmentCents,
    });
  }

  const finalTotalCents = preMinimumTotalCents + minimumAdjustmentCents;

  return {
    itemSubtotalCents,
    accessFeeCents,
    disassemblyFeeCents,
    heavyOversizedFeeCents,
    additionalLocationFeeCents,
    preMinimumTotalCents,
    minimumAdjustmentCents,
    finalTotalCents,
    lineItems,
  };
}

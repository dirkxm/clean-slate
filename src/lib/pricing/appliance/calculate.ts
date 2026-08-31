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
import {
  APPLIANCE_ITEMS,
  DISCONNECTION_LABELS,
  REFRIGERANT_RECOVERY_FEE_CENTS,
} from "./config";
import type { ApplianceRemovalInput, ApplianceRemovalPricingResult } from "./types";

const MINIMUM_ADJUSTMENT_LABEL = "Appliance Removal - Minimum Service Adjustment";

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Pure, deterministic Appliance Removal pricing calculation. Mirrors
 * Furniture Removal's calculate.ts exactly in structure (integer cents,
 * same job-modifier fee mechanics), plus a refrigerant recovery fee for
 * items that require it. No browser, DOM, or Astro dependency.
 */
export function calculateApplianceRemovalPrice(
  input: ApplianceRemovalInput,
): ApplianceRemovalPricingResult {
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
  let refrigerantRecoveryUnitCount = 0;

  for (const selection of input.items) {
    const config = APPLIANCE_ITEMS[selection.itemKey];
    if (!config) {
      throw new Error(`Unknown appliance item key: ${selection.itemKey}`);
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

    if (config.requiresRefrigerantRecovery) {
      refrigerantRecoveryUnitCount += selection.quantity;
    }
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
      name: DISCONNECTION_LABELS[input.disassembly],
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

  const refrigerantRecoveryFeeCents =
    refrigerantRecoveryUnitCount * REFRIGERANT_RECOVERY_FEE_CENTS;
  if (refrigerantRecoveryFeeCents > 0) {
    lineItems.push({
      name: "Refrigerant Recovery Fee",
      quantity: refrigerantRecoveryUnitCount,
      unitPrice: REFRIGERANT_RECOVERY_FEE_CENTS,
      total: refrigerantRecoveryFeeCents,
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
    itemSubtotalCents +
    accessFeeCents +
    disassemblyFeeCents +
    heavyOversizedFeeCents +
    refrigerantRecoveryFeeCents +
    additionalLocationFeeCents;

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
    refrigerantRecoveryFeeCents,
    additionalLocationFeeCents,
    preMinimumTotalCents,
    minimumAdjustmentCents,
    finalTotalCents,
    requiresReview,
    lineItems,
  };
}

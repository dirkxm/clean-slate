import { createEstimateBasedOrderHandler } from "../../_lib/orders/estimate-based-handler";
import { CONSTRUCTION_CLEANUP_PRICING_CONFIG } from "../../../src/lib/pricing/construction-cleanup";

/**
 * POST /api/orders/construction-cleanup
 * See estimate-based-handler.ts for the full validate → price → save →
 * sync → respond flow.
 */
export const onRequestPost = createEstimateBasedOrderHandler({
  service: "construction-cleanup",
  serviceLabel: "Construction Cleanup",
  pricingConfig: CONSTRUCTION_CLEANUP_PRICING_CONFIG,
});

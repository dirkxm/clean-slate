import { createEstimateBasedOrderHandler } from "../../_lib/orders/estimate-based-handler";
import { SMALL_DEMOLITION_PRICING_CONFIG } from "../../../src/lib/pricing/small-demolition";

/**
 * POST /api/orders/small-demolition
 * See estimate-based-handler.ts for the full validate → price → save →
 * sync → respond flow.
 */
export const onRequestPost = createEstimateBasedOrderHandler({
  service: "small-demolition",
  serviceLabel: "Small Demolition",
  pricingConfig: SMALL_DEMOLITION_PRICING_CONFIG,
});

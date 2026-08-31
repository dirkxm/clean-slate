import { createEstimateBasedOrderHandler } from "../../_lib/orders/estimate-based-handler";
import { ESTATE_CLEANOUT_PRICING_CONFIG } from "../../../src/lib/pricing/estate-cleanout";

/**
 * POST /api/orders/estate-cleanout
 * See estimate-based-handler.ts for the full validate → price → save →
 * sync → respond flow.
 */
export const onRequestPost = createEstimateBasedOrderHandler({
  service: "estate-cleanout",
  serviceLabel: "Estate Cleanout",
  pricingConfig: ESTATE_CLEANOUT_PRICING_CONFIG,
});

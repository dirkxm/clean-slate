import { createEstimateBasedOrderHandler } from "../../_lib/orders/estimate-based-handler";
import { GARAGE_CLEANOUT_PRICING_CONFIG } from "../../../src/lib/pricing/garage-cleanout";

/**
 * POST /api/orders/garage-cleanout
 * See estimate-based-handler.ts for the full validate → price → save →
 * sync → respond flow — this file only supplies Garage Cleanout's own
 * service identity and pricing config.
 */
export const onRequestPost = createEstimateBasedOrderHandler({
  service: "garage-cleanout",
  serviceLabel: "Garage Cleanout",
  pricingConfig: GARAGE_CLEANOUT_PRICING_CONFIG,
});

import { createEstimateBasedOrderHandler } from "../../_lib/orders/estimate-based-handler";
import { HOUSEHOLD_CLEANOUT_PRICING_CONFIG } from "../../../src/lib/pricing/household-cleanout";

/**
 * POST /api/orders/household-cleanout
 * See estimate-based-handler.ts for the full validate → price → save →
 * sync → respond flow.
 */
export const onRequestPost = createEstimateBasedOrderHandler({
  service: "household-cleanout",
  serviceLabel: "Household Cleanout",
  pricingConfig: HOUSEHOLD_CLEANOUT_PRICING_CONFIG,
});

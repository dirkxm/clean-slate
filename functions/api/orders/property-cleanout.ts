import { createEstimateBasedOrderHandler } from "../../_lib/orders/estimate-based-handler";
import { PROPERTY_CLEANOUT_PRICING_CONFIG } from "../../../src/lib/pricing/property-cleanout";

/**
 * POST /api/orders/property-cleanout
 * See estimate-based-handler.ts for the full validate → price → save →
 * sync → respond flow.
 */
export const onRequestPost = createEstimateBasedOrderHandler({
  service: "property-cleanout",
  serviceLabel: "Property Cleanout",
  pricingConfig: PROPERTY_CLEANOUT_PRICING_CONFIG,
});

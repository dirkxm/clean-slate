import { describe, expect, it } from "vitest";
import { GARAGE_CLEANOUT_PRICING_CONFIG } from "../garage-cleanout";
import { HOUSEHOLD_CLEANOUT_PRICING_CONFIG } from "../household-cleanout";
import { ESTATE_CLEANOUT_PRICING_CONFIG } from "../estate-cleanout";
import { PROPERTY_CLEANOUT_PRICING_CONFIG } from "../property-cleanout";
import { CONSTRUCTION_CLEANUP_PRICING_CONFIG } from "../construction-cleanup";
import { SMALL_DEMOLITION_PRICING_CONFIG } from "../small-demolition";
import { calculateEstimateBasedPrice } from "./calculate";
import type { EstimateBasedInput } from "./types";

const CONFIGS = [
  ["Garage Cleanout", GARAGE_CLEANOUT_PRICING_CONFIG],
  ["Household Cleanout", HOUSEHOLD_CLEANOUT_PRICING_CONFIG],
  ["Estate Cleanout", ESTATE_CLEANOUT_PRICING_CONFIG],
  ["Property Cleanout", PROPERTY_CLEANOUT_PRICING_CONFIG],
  ["Construction Cleanup", CONSTRUCTION_CLEANUP_PRICING_CONFIG],
  ["Small Demolition", SMALL_DEMOLITION_PRICING_CONFIG],
] as const;

const sampleInput: EstimateBasedInput = {
  areaDescription: "Test Area",
  fillLevel: "moderate",
  largeItemCount: 1,
  heavyOrSpecialItemCount: 0,
  access: "garage",
  disassembly: "none",
  additionalLocations: 0,
};

describe("estimate-based service pricing configs — no invented pricing", () => {
  it.each(CONFIGS)(
    "%s has no pricePerSeverityPointCents set (real business pricing has not been established)",
    (_label, config) => {
      expect(config.pricePerSeverityPointCents).toBeUndefined();
    },
  );

  it.each(CONFIGS)("%s has a real customer-facing serviceLabel", (_label, config) => {
    expect(config.serviceLabel).toBeTruthy();
    expect(typeof config.serviceLabel).toBe("string");
  });

  it.each(CONFIGS)(
    "%s: calculating a price never fabricates a dollar amount — always $0 + requiresReview until configured",
    (_label, config) => {
      const result = calculateEstimateBasedPrice(sampleInput, config);
      expect(result.pricingConfigured).toBe(false);
      expect(result.finalTotalCents).toBe(0);
      expect(result.requiresReview).toBe(true);
      expect(result.lineItems).toEqual([]);
    },
  );
});

import { describe, expect, it } from "vitest";
import { calculateEstimateBasedPrice, calculateEstimateBasedSeverity } from "./calculate";
import type { EstimateBasedPricingConfig } from "./calculate";
import type { EstimateBasedInput } from "./types";

const baseInput: EstimateBasedInput = {
  areaDescription: "Two-Car Garage",
  fillLevel: "moderate",
  largeItemCount: 0,
  heavyOrSpecialItemCount: 0,
  access: "garage",
  disassembly: "none",
  additionalLocations: 0,
};

const unconfiguredConfig: EstimateBasedPricingConfig = {
  serviceLabel: "Garage Cleanout",
};

describe("calculateEstimateBasedPrice — unconfigured (current real state for every cleanout/construction service)", () => {
  it("1. never fabricates a price when pricePerSeverityPointCents is unset", () => {
    const result = calculateEstimateBasedPrice(baseInput, unconfiguredConfig);
    expect(result.pricingConfigured).toBe(false);
    expect(result.finalTotalCents).toBe(0);
    expect(result.requiresReview).toBe(true);
    expect(result.lineItems).toEqual([]);
  });

  it("2. still computes a severity score even when unpriced, for staff reference", () => {
    const result = calculateEstimateBasedPrice(
      { ...baseInput, fillLevel: "veryHeavy", largeItemCount: 2 },
      unconfiguredConfig,
    );
    expect(result.severityScore).toBeGreaterThan(0);
    expect(result.pricingConfigured).toBe(false);
  });

  it("3. throws on a negative largeItemCount regardless of pricing configuration", () => {
    expect(() =>
      calculateEstimateBasedPrice({ ...baseInput, largeItemCount: -1 }, unconfiguredConfig),
    ).toThrow(/non-negative integer/);
  });
});

describe("calculateEstimateBasedSeverity", () => {
  it("4. higher fill levels produce a higher severity score", () => {
    const light = calculateEstimateBasedSeverity({ ...baseInput, fillLevel: "light" }, unconfiguredConfig);
    const moderate = calculateEstimateBasedSeverity({ ...baseInput, fillLevel: "moderate" }, unconfiguredConfig);
    const heavy = calculateEstimateBasedSeverity({ ...baseInput, fillLevel: "heavy" }, unconfiguredConfig);
    const veryHeavy = calculateEstimateBasedSeverity({ ...baseInput, fillLevel: "veryHeavy" }, unconfiguredConfig);
    expect(light).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(heavy);
    expect(heavy).toBeLessThan(veryHeavy);
  });

  it("5. large items add severity on top of the fill level", () => {
    const withoutLargeItems = calculateEstimateBasedSeverity(baseInput, unconfiguredConfig);
    const withLargeItems = calculateEstimateBasedSeverity(
      { ...baseInput, largeItemCount: 3 },
      unconfiguredConfig,
    );
    expect(withLargeItems).toBeGreaterThan(withoutLargeItems);
  });
});

describe("calculateEstimateBasedPrice — configured (proves the formula works once real numbers exist)", () => {
  const testConfig: EstimateBasedPricingConfig = {
    serviceLabel: "Test Cleanout",
    pricePerSeverityPointCents: 5000,
    minimumJobChargeCents: 9900,
    largeJobReviewThresholdCents: 100000,
    largeItemSeverityPoints: 1,
    heavyOrSpecialItemFeeCents: 5000,
    additionalLocationFeeCents: 2500,
  };

  it("6. computes a real total once pricePerSeverityPointCents is set", () => {
    const result = calculateEstimateBasedPrice(baseInput, testConfig);
    expect(result.pricingConfigured).toBe(true);
    // moderate fill = severity 2, 2 x $50 = $100 -> below $99 minimum? no, $100 > $99.
    expect(result.finalTotalCents).toBe(10000);
    expect(result.requiresReview).toBe(false);
  });

  it("7. applies the minimum charge when the computed total is below it", () => {
    const result = calculateEstimateBasedPrice({ ...baseInput, fillLevel: "light" }, testConfig);
    // light fill = severity 1, 1 x $50 = $50, below $99 minimum.
    expect(result.finalTotalCents).toBe(9900);
  });

  it("8. heavy/special item fee and additional location fee apply per unit", () => {
    const result = calculateEstimateBasedPrice(
      { ...baseInput, heavyOrSpecialItemCount: 2, additionalLocations: 1 },
      testConfig,
    );
    const heavyLine = result.lineItems.find((li) => li.name === "Heavy / Special-Handling Item Fee");
    const locationLine = result.lineItems.find((li) => li.name === "Additional Location Fee");
    expect(heavyLine?.total).toBe(10000);
    expect(locationLine?.total).toBe(2500);
  });

  it("9. flags requiresReview when the total exceeds the configured threshold", () => {
    const result = calculateEstimateBasedPrice(
      { ...baseInput, fillLevel: "veryHeavy", largeItemCount: 40 },
      testConfig,
    );
    expect(result.finalTotalCents).toBeGreaterThan(100000);
    expect(result.requiresReview).toBe(true);
  });

  it("10. line item totals reconcile to the final total", () => {
    const result = calculateEstimateBasedPrice(
      { ...baseInput, heavyOrSpecialItemCount: 1, additionalLocations: 1 },
      testConfig,
    );
    const sum = result.lineItems.reduce((acc, li) => acc + li.total, 0);
    expect(sum).toBe(result.finalTotalCents);
  });
});

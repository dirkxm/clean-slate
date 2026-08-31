import { describe, expect, it } from "vitest";
import { calculateApplianceRemovalPrice } from "./calculate";
import type { ApplianceRemovalInput, ApplianceSelection } from "./types";

const baseInput: ApplianceRemovalInput = {
  items: [],
  access: "garage",
  disassembly: "none",
  heavyOversizedItemCount: 0,
  additionalLocations: 0,
};

function withItems(items: ApplianceSelection[]): ApplianceRemovalInput {
  return { ...baseInput, items };
}

function reconcileLineItems(result: ReturnType<typeof calculateApplianceRemovalPrice>) {
  const lineItemTotal = result.lineItems.reduce((sum, lineItem) => sum + lineItem.total, 0);
  expect(lineItemTotal).toBe(result.finalTotalCents);

  for (const lineItem of result.lineItems) {
    expect(lineItem.total).toBe(lineItem.quantity * lineItem.unitPrice);
  }
}

describe("calculateApplianceRemovalPrice", () => {
  it("1. one dishwasher hits the $99 minimum", () => {
    const result = calculateApplianceRemovalPrice(withItems([{ itemKey: "dishwasher", quantity: 1 }]));
    expect(result.itemSubtotalCents).toBe(5000);
    expect(result.preMinimumTotalCents).toBe(5000);
    expect(result.minimumAdjustmentCents).toBe(4900);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("2. washer + dryer = $120, above minimum", () => {
    const result = calculateApplianceRemovalPrice(
      withItems([
        { itemKey: "washer", quantity: 1 },
        { itemKey: "dryer", quantity: 1 },
      ]),
    );
    expect(result.finalTotalCents).toBe(12000);
    expect(result.minimumAdjustmentCents).toBe(0);
    reconcileLineItems(result);
  });

  it("3. a single refrigerator includes the refrigerant recovery fee, crossing the minimum", () => {
    const result = calculateApplianceRemovalPrice(
      withItems([{ itemKey: "refrigeratorStandard", quantity: 1 }]),
    );
    expect(result.itemSubtotalCents).toBe(7500);
    expect(result.refrigerantRecoveryFeeCents).toBe(3500);
    expect(result.preMinimumTotalCents).toBe(11000);
    expect(result.minimumAdjustmentCents).toBe(0);
    expect(result.finalTotalCents).toBe(11000);
    reconcileLineItems(result);
  });

  it("4. an item with no refrigerant requirement never adds the recovery fee", () => {
    const result = calculateApplianceRemovalPrice(withItems([{ itemKey: "microwave", quantity: 1 }]));
    expect(result.refrigerantRecoveryFeeCents).toBe(0);
    expect(result.finalTotalCents).toBe(9900); // 3000 item -> minimum applies
    reconcileLineItems(result);
  });

  it("5. refrigerant recovery fee is charged per qualifying unit, across different item types", () => {
    const result = calculateApplianceRemovalPrice(
      withItems([
        { itemKey: "refrigeratorStandard", quantity: 2 },
        { itemKey: "freezer", quantity: 1 },
      ]),
    );
    expect(result.itemSubtotalCents).toBe(7500 * 2 + 6500);
    expect(result.refrigerantRecoveryFeeCents).toBe(3 * 3500);
    expect(result.finalTotalCents).toBe(7500 * 2 + 6500 + 3 * 3500);
    reconcileLineItems(result);
  });

  it("6. access fee applies and can trigger the minimum adjustment", () => {
    const result = calculateApplianceRemovalPrice({
      ...withItems([{ itemKey: "dryer", quantity: 1 }]),
      access: "basement",
    });
    expect(result.accessFeeCents).toBe(2500);
    expect(result.preMinimumTotalCents).toBe(8500);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("7. difficult disconnection fee is labeled for appliances, not furniture wording", () => {
    const result = calculateApplianceRemovalPrice({
      ...withItems([{ itemKey: "stoveRange", quantity: 1 }]),
      disassembly: "difficult",
    });
    expect(result.disassemblyFeeCents).toBe(5000);
    expect(result.finalTotalCents).toBe(11500);
    const disconnectionLine = result.lineItems.find((item) => item.name.includes("Disconnection"));
    expect(disconnectionLine?.name).toBe("Difficult Disconnection");
    reconcileLineItems(result);
  });

  it("8. heavy/oversized fee is charged per declared item, same as Furniture Removal", () => {
    const result = calculateApplianceRemovalPrice({
      ...withItems([{ itemKey: "furnace", quantity: 1 }]),
      heavyOversizedItemCount: 1,
    });
    expect(result.heavyOversizedFeeCents).toBe(5000);
    expect(result.finalTotalCents).toBe(13500);
    reconcileLineItems(result);
  });

  it("9. additional location fee applies per extra location", () => {
    const result = calculateApplianceRemovalPrice({
      ...withItems([{ itemKey: "washer", quantity: 1 }]),
      additionalLocations: 2,
    });
    expect(result.additionalLocationFeeCents).toBe(5000);
    expect(result.finalTotalCents).toBe(11000);
    reconcileLineItems(result);
  });

  it("10. a large order is flagged for review, without discarding the calculated total", () => {
    const result = calculateApplianceRemovalPrice(
      withItems([{ itemKey: "refrigeratorLarge", quantity: 10 }]),
    );
    expect(result.finalTotalCents).toBe(9500 * 10 + 3500 * 10);
    expect(result.requiresReview).toBe(true);
  });

  it("11. exactly at the review threshold does not require review (strictly greater-than)", () => {
    const result = calculateApplianceRemovalPrice(withItems([{ itemKey: "dishwasher", quantity: 20 }]));
    expect(result.finalTotalCents).toBe(100000);
    expect(result.requiresReview).toBe(false);
  });

  it("12. one cent over the review threshold requires review", () => {
    const result = calculateApplianceRemovalPrice(
      withItems([
        { itemKey: "dishwasher", quantity: 20 },
        { itemKey: "microwave", quantity: 1 },
      ]),
    );
    expect(result.finalTotalCents).toBe(103000);
    expect(result.requiresReview).toBe(true);
  });

  it("13. throws on an unknown item key", () => {
    expect(() =>
      calculateApplianceRemovalPrice(
        withItems([{ itemKey: "notARealAppliance" as never, quantity: 1 }]),
      ),
    ).toThrow(/Unknown appliance item key/);
  });

  it("14. throws on a negative quantity", () => {
    expect(() =>
      calculateApplianceRemovalPrice(withItems([{ itemKey: "washer", quantity: -1 }])),
    ).toThrow(/non-negative integer/);
  });

  it("15. throws on a negative additionalLocations", () => {
    expect(() =>
      calculateApplianceRemovalPrice({
        ...withItems([{ itemKey: "washer", quantity: 1 }]),
        additionalLocations: -1,
      }),
    ).toThrow(/non-negative integer/);
  });

  it("16. skips zero-quantity selections entirely", () => {
    const result = calculateApplianceRemovalPrice(
      withItems([
        { itemKey: "washer", quantity: 1 },
        { itemKey: "dryer", quantity: 0 },
      ]),
    );
    expect(result.lineItems.some((item) => item.name === "Dryer")).toBe(false);
  });

  it("17. line items always reconcile to the final total across a mixed order", () => {
    const result = calculateApplianceRemovalPrice({
      items: [
        { itemKey: "refrigeratorStandard", quantity: 1 },
        { itemKey: "washer", quantity: 1 },
        { itemKey: "dryer", quantity: 1 },
      ],
      access: "upstairs",
      disassembly: "simple",
      heavyOversizedItemCount: 1,
      additionalLocations: 1,
    });
    reconcileLineItems(result);
  });
});

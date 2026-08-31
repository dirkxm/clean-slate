import { describe, expect, it } from "vitest";
import { calculateGeneralJunkRemovalPrice } from "./calculate";
import type { GeneralJunkRemovalInput, GeneralJunkSelection } from "./types";

const baseInput: GeneralJunkRemovalInput = {
  items: [],
  access: "garage",
  disassembly: "none",
  heavyOversizedItemCount: 0,
  additionalLocations: 0,
};

function withItems(items: GeneralJunkSelection[]): GeneralJunkRemovalInput {
  return { ...baseInput, items };
}

function reconcileLineItems(result: ReturnType<typeof calculateGeneralJunkRemovalPrice>) {
  const lineItemTotal = result.lineItems.reduce((sum, lineItem) => sum + lineItem.total, 0);
  expect(lineItemTotal).toBe(result.finalTotalCents);

  for (const lineItem of result.lineItems) {
    expect(lineItem.total).toBe(lineItem.quantity * lineItem.unitPrice);
  }
}

describe("calculateGeneralJunkRemovalPrice", () => {
  it("1. a single small bag hits the $99 minimum", () => {
    const result = calculateGeneralJunkRemovalPrice(withItems([{ itemKey: "bagSmall", quantity: 1 }]));
    expect(result.itemSubtotalCents).toBe(2500);
    expect(result.minimumAdjustmentCents).toBe(7400);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("2. a piano alone is well above the minimum, no adjustment", () => {
    const result = calculateGeneralJunkRemovalPrice(withItems([{ itemKey: "piano", quantity: 1 }]));
    expect(result.finalTotalCents).toBe(20000);
    expect(result.minimumAdjustmentCents).toBe(0);
    reconcileLineItems(result);
  });

  it("3. multiple bags/boxes sum correctly", () => {
    const result = calculateGeneralJunkRemovalPrice(
      withItems([
        { itemKey: "bagSmall", quantity: 3 },
        { itemKey: "boxMisc", quantity: 2 },
      ]),
    );
    expect(result.itemSubtotalCents).toBe(2500 * 3 + 3000 * 2);
    reconcileLineItems(result);
  });

  it("4. access fee applies and can trigger the minimum adjustment", () => {
    const result = calculateGeneralJunkRemovalPrice({
      ...withItems([{ itemKey: "tire", quantity: 1 }]),
      access: "basement",
    });
    expect(result.accessFeeCents).toBe(2500);
    expect(result.preMinimumTotalCents).toBe(4500);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("5. difficult disassembly fee applies (e.g. breaking down a hot tub)", () => {
    const result = calculateGeneralJunkRemovalPrice({
      ...withItems([{ itemKey: "hotTub", quantity: 1 }]),
      disassembly: "difficult",
    });
    expect(result.disassemblyFeeCents).toBe(5000);
    expect(result.finalTotalCents).toBe(30000);
    reconcileLineItems(result);
  });

  it("6. heavy/oversized fee is charged per declared item", () => {
    const result = calculateGeneralJunkRemovalPrice({
      ...withItems([{ itemKey: "safe", quantity: 1 }]),
      heavyOversizedItemCount: 1,
    });
    expect(result.heavyOversizedFeeCents).toBe(5000);
    expect(result.finalTotalCents).toBe(20000);
    reconcileLineItems(result);
  });

  it("7. additional location fee applies per extra location", () => {
    const result = calculateGeneralJunkRemovalPrice({
      ...withItems([{ itemKey: "bagLarge", quantity: 1 }]),
      additionalLocations: 2,
    });
    expect(result.additionalLocationFeeCents).toBe(5000);
    expect(result.finalTotalCents).toBe(9900); // 4000 + 5000 = 9000, still under minimum
    reconcileLineItems(result);
  });

  it("8. a large order is flagged for review, without discarding the calculated total", () => {
    const result = calculateGeneralJunkRemovalPrice(withItems([{ itemKey: "hotTub", quantity: 5 }]));
    expect(result.finalTotalCents).toBe(125000);
    expect(result.requiresReview).toBe(true);
  });

  it("9. exactly at the review threshold does not require review (strictly greater-than)", () => {
    const result = calculateGeneralJunkRemovalPrice(withItems([{ itemKey: "piano", quantity: 5 }]));
    expect(result.finalTotalCents).toBe(100000);
    expect(result.requiresReview).toBe(false);
  });

  it("10. throws on an unknown item key", () => {
    expect(() =>
      calculateGeneralJunkRemovalPrice(withItems([{ itemKey: "notARealItem" as never, quantity: 1 }])),
    ).toThrow(/Unknown general junk item key/);
  });

  it("11. throws on a negative quantity", () => {
    expect(() =>
      calculateGeneralJunkRemovalPrice(withItems([{ itemKey: "bagSmall", quantity: -1 }])),
    ).toThrow(/non-negative integer/);
  });

  it("12. skips zero-quantity selections entirely", () => {
    const result = calculateGeneralJunkRemovalPrice(
      withItems([
        { itemKey: "bagSmall", quantity: 1 },
        { itemKey: "tire", quantity: 0 },
      ]),
    );
    expect(result.lineItems.some((item) => item.name === "Tire (each)")).toBe(false);
  });

  it("13. line items always reconcile to the final total across a mixed order", () => {
    const result = calculateGeneralJunkRemovalPrice({
      items: [
        { itemKey: "bagLarge", quantity: 2 },
        { itemKey: "electronics", quantity: 1 },
        { itemKey: "yardWaste", quantity: 3 },
      ],
      access: "upstairs",
      disassembly: "simple",
      heavyOversizedItemCount: 1,
      additionalLocations: 1,
    });
    reconcileLineItems(result);
  });
});

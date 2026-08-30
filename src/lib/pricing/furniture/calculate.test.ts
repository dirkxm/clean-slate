import { describe, expect, it } from "vitest";
import { calculateFurnitureRemovalPrice } from "./calculate";
import type { FurnitureRemovalInput, FurnitureSelection } from "./types";

const baseInput: FurnitureRemovalInput = {
  items: [],
  access: "garage",
  disassembly: "none",
  heavyOversizedItemCount: 0,
  additionalLocations: 0,
};

function withItems(items: FurnitureSelection[]): FurnitureRemovalInput {
  return { ...baseInput, items };
}

function reconcileLineItems(result: ReturnType<typeof calculateFurnitureRemovalPrice>) {
  const lineItemTotal = result.lineItems.reduce(
    (sum, lineItem) => sum + lineItem.total,
    0,
  );
  expect(lineItemTotal).toBe(result.finalTotalCents);

  for (const lineItem of result.lineItems) {
    expect(lineItem.total).toBe(lineItem.quantity * lineItem.unitPrice);
  }
}

describe("calculateFurnitureRemovalPrice", () => {
  it("1. one sofa hits the $99 minimum", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([{ itemKey: "sofa", quantity: 1 }]),
    );
    expect(result.itemSubtotalCents).toBe(6500);
    expect(result.preMinimumTotalCents).toBe(6500);
    expect(result.minimumAdjustmentCents).toBe(3400);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("2. one sofa + one dresser = $110", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([
        { itemKey: "sofa", quantity: 1 },
        { itemKey: "dresser", quantity: 1 },
      ]),
    );
    expect(result.finalTotalCents).toBe(11000);
    expect(result.minimumAdjustmentCents).toBe(0);
    reconcileLineItems(result);
  });

  it("3. one sofa + basement = $99", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([{ itemKey: "sofa", quantity: 1 }]),
      access: "basement",
    });
    expect(result.preMinimumTotalCents).toBe(9000);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("4. one sofa + dresser + basement = $135", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([
        { itemKey: "sofa", quantity: 1 },
        { itemKey: "dresser", quantity: 1 },
      ]),
      access: "basement",
    });
    expect(result.finalTotalCents).toBe(13500);
    reconcileLineItems(result);
  });

  it("5. four dining chairs hit the $99 minimum", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([{ itemKey: "diningChair", quantity: 4 }]),
    );
    expect(result.itemSubtotalCents).toBe(6000);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("6. small sectional hits the $99 minimum", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([{ itemKey: "sectionalSmall", quantity: 1 }]),
    );
    expect(result.itemSubtotalCents).toBe(9500);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("7. large sectional + difficult disassembly = $175", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([{ itemKey: "sectionalLarge", quantity: 1 }]),
      disassembly: "difficult",
    });
    expect(result.finalTotalCents).toBe(17500);
    reconcileLineItems(result);
  });

  it("8. sofa + one heavy/oversized item = $115", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([{ itemKey: "sofa", quantity: 1 }]),
      heavyOversizedItemCount: 1,
    });
    expect(result.finalTotalCents).toBe(11500);
    reconcileLineItems(result);
  });

  it("9. sofa + basement + simple disassembly = $115", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([{ itemKey: "sofa", quantity: 1 }]),
      access: "basement",
      disassembly: "simple",
    });
    expect(result.finalTotalCents).toBe(11500);
    reconcileLineItems(result);
  });

  it("10. sofa + additional location hits the $99 minimum", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([{ itemKey: "sofa", quantity: 1 }]),
      additionalLocations: 1,
    });
    expect(result.preMinimumTotalCents).toBe(9000);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("11. two sofas = $130", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([{ itemKey: "sofa", quantity: 2 }]),
    );
    expect(result.finalTotalCents).toBe(13000);
    reconcileLineItems(result);
  });

  it("12. sofa + dresser + four dining chairs = $170", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([
        { itemKey: "sofa", quantity: 1 },
        { itemKey: "dresser", quantity: 1 },
        { itemKey: "diningChair", quantity: 4 },
      ]),
    );
    expect(result.finalTotalCents).toBe(17000);
    reconcileLineItems(result);
  });

  it("never applies a minimum adjustment line item when already above minimum", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([{ itemKey: "sofa", quantity: 2 }]),
    );
    expect(
      result.lineItems.some((item) =>
        item.name.includes("Minimum Service Adjustment"),
      ),
    ).toBe(false);
  });

  it("adds an exact minimum adjustment line item that reconciles to $99", () => {
    const result = calculateFurnitureRemovalPrice(
      withItems([{ itemKey: "chair", quantity: 1 }]),
    );
    const adjustment = result.lineItems.find((item) =>
      item.name.includes("Minimum Service Adjustment"),
    );
    expect(adjustment).toBeDefined();
    expect(adjustment?.total).toBe(6400);
    expect(result.finalTotalCents).toBe(9900);
    reconcileLineItems(result);
  });

  it("throws on an unknown furniture item key", () => {
    expect(() =>
      calculateFurnitureRemovalPrice(
        withItems([{ itemKey: "notAnItem" as never, quantity: 1 }]),
      ),
    ).toThrow();
  });

  it("is deterministic across repeated calls with identical input", () => {
    const input = withItems([
      { itemKey: "sofa", quantity: 1 },
      { itemKey: "recliner", quantity: 2 },
    ]);
    const first = calculateFurnitureRemovalPrice(input);
    const second = calculateFurnitureRemovalPrice(input);
    expect(second).toEqual(first);
  });

  it("throws when heavyOversizedItemCount is negative or non-integer", () => {
    expect(() =>
      calculateFurnitureRemovalPrice({
        ...withItems([{ itemKey: "sofa", quantity: 1 }]),
        heavyOversizedItemCount: -1,
      }),
    ).toThrow();

    expect(() =>
      calculateFurnitureRemovalPrice({
        ...withItems([{ itemKey: "sofa", quantity: 1 }]),
        heavyOversizedItemCount: 1.5,
      }),
    ).toThrow();
  });

  describe("heavy/oversized pricing (per item, not per job)", () => {
    it("no heavy items adds no heavy/oversized fee", () => {
      const result = calculateFurnitureRemovalPrice(
        withItems([{ itemKey: "sofa", quantity: 1 }]),
      );
      expect(result.heavyOversizedFeeCents).toBe(0);
      expect(
        result.lineItems.some((item) => item.name.includes("Heavy")),
      ).toBe(false);
      reconcileLineItems(result);
    });

    it("one heavy/oversized item = $50", () => {
      const result = calculateFurnitureRemovalPrice({
        ...withItems([{ itemKey: "sofa", quantity: 1 }]),
        heavyOversizedItemCount: 1,
      });
      expect(result.heavyOversizedFeeCents).toBe(5000);
      reconcileLineItems(result);
    });

    it("two heavy/oversized items = $100", () => {
      const result = calculateFurnitureRemovalPrice({
        ...withItems([{ itemKey: "sofa", quantity: 1 }]),
        heavyOversizedItemCount: 2,
      });
      expect(result.heavyOversizedFeeCents).toBe(10000);
      reconcileLineItems(result);
    });

    it("three heavy/oversized items = $150", () => {
      const result = calculateFurnitureRemovalPrice({
        ...withItems([{ itemKey: "sofa", quantity: 1 }]),
        heavyOversizedItemCount: 3,
      });
      expect(result.heavyOversizedFeeCents).toBe(15000);
      reconcileLineItems(result);
    });

    it("the heavy/oversized line item's quantity and unit price reflect the count", () => {
      const result = calculateFurnitureRemovalPrice({
        ...withItems([{ itemKey: "sofa", quantity: 1 }]),
        heavyOversizedItemCount: 3,
      });
      const heavyLine = result.lineItems.find((item) =>
        item.name.includes("Heavy"),
      );
      expect(heavyLine).toEqual({
        name: "Heavy / Oversized Item Fee",
        quantity: 3,
        unitPrice: 5000,
        total: 15000,
      });
    });

    it("selecting furniture items never triggers a heavy fee on its own — it's independent of item selection", () => {
      const result = calculateFurnitureRemovalPrice(
        withItems([
          { itemKey: "sofa", quantity: 1 },
          { itemKey: "dresser", quantity: 1 },
          { itemKey: "sectionalLarge", quantity: 2 },
        ]),
      );
      expect(result.heavyOversizedFeeCents).toBe(0);
      reconcileLineItems(result);
    });
  });

  describe("large-job review threshold", () => {
    it("a calculated price below $1,000 remains automatically priced", () => {
      const result = calculateFurnitureRemovalPrice(
        withItems([{ itemKey: "sofa", quantity: 2 }]),
      );
      expect(result.finalTotalCents).toBe(13000);
      expect(result.requiresReview).toBe(false);
    });

    it("a calculated price of exactly $1,000 does not require review (must exceed, not just reach, the threshold)", () => {
      const result = calculateFurnitureRemovalPrice({
        ...baseInput,
        heavyOversizedItemCount: 20, // 20 x $50 = $1,000.00 exactly
      });
      expect(result.finalTotalCents).toBe(100000);
      expect(result.requiresReview).toBe(false);
    });

    it("a calculated price above $1,000 enters the quote-review state", () => {
      const result = calculateFurnitureRemovalPrice({
        ...baseInput,
        heavyOversizedItemCount: 21, // 21 x $50 = $1,050.00
      });
      expect(result.finalTotalCents).toBe(105000);
      expect(result.requiresReview).toBe(true);
    });

    it("does not discard the calculated amount when review is required", () => {
      const result = calculateFurnitureRemovalPrice(
        withItems([{ itemKey: "sectionalLarge", quantity: 9 }]), // 9 x $125 = $1,125.00
      );
      expect(result.requiresReview).toBe(true);
      expect(result.finalTotalCents).toBe(112500);
    });
  });
});

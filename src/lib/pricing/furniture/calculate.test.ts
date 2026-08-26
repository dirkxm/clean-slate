import { describe, expect, it } from "vitest";
import { calculateFurnitureRemovalPrice } from "./calculate";
import type { FurnitureRemovalInput, FurnitureSelection } from "./types";

const baseInput: FurnitureRemovalInput = {
  items: [],
  access: "garage",
  disassembly: "none",
  heavyOversized: false,
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

  it("8. sofa + heavy/oversized = $115", () => {
    const result = calculateFurnitureRemovalPrice({
      ...withItems([{ itemKey: "sofa", quantity: 1 }]),
      heavyOversized: true,
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
});

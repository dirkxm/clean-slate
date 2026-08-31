import type { DisassemblyType } from "../shared";
import type { ApplianceItemConfig, ApplianceItemKey } from "./types";

/**
 * Centralized Appliance Removal pricing configuration.
 *
 * All monetary values are integer cents. This file is the single place
 * to change a price or fee — calculation logic in `calculate.ts` should
 * never need to change when these values do.
 *
 * BEST-GUESS PRICING: every dollar value in this file (item prices and
 * the refrigerant recovery fee) is a placeholder estimate, not a
 * business-confirmed price — explicitly requested as a starting point
 * pending real pricing decisions. Scaled to sit in a similar range to
 * Furniture Removal's catalog. Confirm/replace before this is treated
 * as final.
 */

/**
 * Charged once per item requiring certified EPA refrigerant recovery
 * before disposal (refrigerators, freezers, AC units) — a real,
 * separate cost most haulers pass through, not an invented one, though
 * the dollar amount itself is a placeholder pending confirmation.
 */
export const REFRIGERANT_RECOVERY_FEE_CENTS = 3500;

/**
 * Same three-tier concept/fees as Furniture Removal's "disassembly", but
 * appliances need disconnection (gas/water/electrical), not assembly
 * work — customer-facing wording reflects that.
 */
export const DISCONNECTION_LABELS: Record<DisassemblyType, string> = {
  none: "No Disconnection",
  simple: "Simple Disconnection",
  difficult: "Difficult Disconnection",
};

export const APPLIANCE_ITEMS: Record<ApplianceItemKey, ApplianceItemConfig> = {
  refrigeratorStandard: {
    label: "Refrigerator (Standard)",
    priceCents: 7500,
    requiresRefrigerantRecovery: true,
  },
  refrigeratorLarge: {
    label: "Refrigerator (Large / Side-by-Side)",
    priceCents: 9500,
    requiresRefrigerantRecovery: true,
  },
  miniFridge: {
    label: "Mini Fridge",
    priceCents: 4000,
    requiresRefrigerantRecovery: true,
  },
  freezer: {
    label: "Freezer (Chest or Upright)",
    priceCents: 6500,
    requiresRefrigerantRecovery: true,
  },
  washer: { label: "Washer", priceCents: 6000, requiresRefrigerantRecovery: false },
  dryer: { label: "Dryer", priceCents: 6000, requiresRefrigerantRecovery: false },
  washerDryerStackable: {
    label: "Stackable Washer/Dryer Unit",
    priceCents: 9000,
    requiresRefrigerantRecovery: false,
  },
  stoveRange: { label: "Stove / Range", priceCents: 6500, requiresRefrigerantRecovery: false },
  wallOven: { label: "Wall Oven", priceCents: 6000, requiresRefrigerantRecovery: false },
  dishwasher: { label: "Dishwasher", priceCents: 5000, requiresRefrigerantRecovery: false },
  microwave: {
    label: "Microwave (Built-In / Over-Range)",
    priceCents: 3000,
    requiresRefrigerantRecovery: false,
  },
  waterHeater: { label: "Water Heater", priceCents: 6500, requiresRefrigerantRecovery: false },
  acUnitWindow: {
    label: "Window / Portable AC Unit",
    priceCents: 4000,
    requiresRefrigerantRecovery: true,
  },
  furnace: { label: "Furnace", priceCents: 8500, requiresRefrigerantRecovery: false },
};

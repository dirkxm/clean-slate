import type { DisassemblyType } from "../shared";
import type { GeneralJunkItemConfig, GeneralJunkItemKey } from "./types";

/**
 * Centralized General Junk Removal pricing configuration.
 *
 * All monetary values are integer cents.
 *
 * BEST-GUESS PRICING: every dollar value in this file is a placeholder
 * estimate, not a business-confirmed price — explicitly requested as a
 * starting point pending real pricing decisions.
 *
 * ALSO UNCONFIRMED: this whole file assumes General Junk Removal is
 * priced per-item, the same model as Furniture/Appliance Removal. Many
 * junk removal businesses instead price "general junk" by truckload/
 * volume fraction (e.g. 1-800-GOT-JUNK-style), since it's meant to
 * cover miscellaneous items that don't fit a clean catalog. Per-item was
 * chosen here because it reuses the already-working architecture safely
 * tonight — but this may be the wrong pricing MODEL for this specific
 * service, not just wrong prices. Flagging this explicitly rather than
 * assuming it's right.
 */

export const DISASSEMBLY_LABELS: Record<DisassemblyType, string> = {
  none: "No Disassembly",
  simple: "Simple Disassembly",
  difficult: "Difficult Disassembly",
};

export const GENERAL_JUNK_ITEMS: Record<GeneralJunkItemKey, GeneralJunkItemConfig> = {
  bagSmall: { label: "Small Bag of Junk", priceCents: 2500 },
  bagLarge: { label: "Large Bag of Junk", priceCents: 4000 },
  boxMisc: { label: "Box of Miscellaneous Items", priceCents: 3000 },
  yardWaste: { label: "Yard Waste / Debris Pile", priceCents: 4500 },
  tire: { label: "Tire (each)", priceCents: 2000 },
  exerciseEquipment: { label: "Exercise Equipment (Treadmill, Elliptical, etc.)", priceCents: 6500 },
  electronics: { label: "Electronics / E-Waste (TV, Computer, etc.)", priceCents: 4000 },
  carpetFlooring: { label: "Carpet / Flooring (per room)", priceCents: 5500 },
  constructionDebrisSmall: { label: "Construction Debris (Small Amount)", priceCents: 6000 },
  hotTub: { label: "Hot Tub / Spa", priceCents: 25000 },
  piano: { label: "Piano", priceCents: 20000 },
  safe: { label: "Safe", priceCents: 15000 },
};

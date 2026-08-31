import type { EstimateBasedPricingConfig } from "../estimate-shared";

/**
 * Deliberately a conservative, common, residential-scale list — this
 * project makes no claim about structural safety (e.g. whether a wall
 * is load-bearing) and never should; that determination is Clean
 * Slate's crew's on-site judgment, not something this form decides.
 * "Other" exists specifically so a customer isn't forced to mis-select
 * something that doesn't fit.
 */
export type DemolitionTarget =
  | "shed"
  | "deck"
  | "fence"
  | "interiorWallNonStructural"
  | "flooring"
  | "smallStructure"
  | "other";

export const DEMOLITION_TARGET_OPTIONS: { value: DemolitionTarget; label: string }[] = [
  { value: "shed", label: "Shed" },
  { value: "deck", label: "Deck" },
  { value: "fence", label: "Fence" },
  { value: "interiorWallNonStructural", label: "Interior Wall (Non-Structural)" },
  { value: "flooring", label: "Flooring" },
  { value: "smallStructure", label: "Small Outbuilding / Structure" },
  { value: "other", label: "Other (describe in notes)" },
];

export const DEMOLITION_TARGET_LABELS: Record<DemolitionTarget, string> = {
  shed: "Shed",
  deck: "Deck",
  fence: "Fence",
  interiorWallNonStructural: "Interior Wall (Non-Structural)",
  flooring: "Flooring",
  smallStructure: "Small Outbuilding / Structure",
  other: "Other",
};

/**
 * PRICING NOT YET ESTABLISHED — see estimate-shared/calculate.ts's
 * EstimateBasedPricingConfig doc comment. `pricePerSeverityPointCents`
 * is intentionally left unset; every submission is currently priced as
 * "pending review" rather than an invented number. Demolition labor and
 * haul-away/disposal are genuinely separate cost components for this
 * service (see `haulAwayIncluded` on the shared input/order shape) —
 * whether/how to price them separately is also undecided.
 */
export const SMALL_DEMOLITION_PRICING_CONFIG: EstimateBasedPricingConfig = {
  serviceLabel: "Small Demolition",
};

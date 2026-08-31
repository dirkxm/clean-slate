/**
 * Minimal shape of a Cloudflare KV namespace binding — just the methods
 * this project actually uses. Mirrors `JobberKVNamespace` exactly, kept
 * as its own type (rather than shared) so the orders module has no
 * dependency on the Jobber module, or vice versa.
 */
export interface OrdersKVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare Pages Function environment binding for order/quote storage.
 *
 * This is a SEPARATE KV binding from `JOBBER_KV` — customer/order
 * submissions must never be mixed with the Jobber OAuth connection
 * record. `ORDERS_KV` needs to be bound in the Cloudflare Pages
 * dashboard the same way `JOBBER_KV` was (see project notes) before
 * this endpoint will work in production.
 */
export interface OrdersEnv {
  ORDERS_KV: OrdersKVNamespace;
}

export type CustomerType = "residential" | "commercial";

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  serviceAddress: string;
  city: string;
  zip: string;
  customerType: CustomerType;
}

/**
 * The raw shape a client submits — pricing is deliberately NOT included;
 * the server always recalculates it. Shared across every "items +
 * access + disassembly/disconnection + heavy/oversized + locations"
 * style service (Furniture Removal, Appliance Removal, ...) — each
 * service's endpoint validates/interprets `items` on its own terms.
 */
export interface RemovalOrderRequestBody {
  /**
   * Client-generated UUID, stable across retries of the same submission
   * attempt — the idempotency key. A malformed/missing value falls back
   * to a fresh server-generated ID (treated as a new submission).
   */
  orderId?: unknown;
  customer: unknown;
  items: unknown;
  access: unknown;
  disassembly: unknown;
  heavyOversizedItemCount: unknown;
  additionalLocations: unknown;
  photos?: unknown;
}

/** @deprecated Use `RemovalOrderRequestBody` — kept as an alias so existing imports don't need to change. */
export type FurnitureRemovalOrderRequestBody = RemovalOrderRequestBody;

export type OrderStatus = "booking_requested" | "quote_requested";

/** Mirrors `JobberLineItem` from the pricing engine (name/quantity/unitPrice/total, all integer cents). */
export interface OrderLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type JobberSyncStatus = "pending" | "synced" | "failed";

/**
 * Result of attempting to sync this order into Jobber. Kept separate
 * from `pricing`/`order` so it's obvious this is metadata ABOUT the
 * Jobber side-effect, not part of the order itself. Populated
 * incrementally (e.g. `clientId` can be set even if `requestId` isn't,
 * after a partial failure) so a retry can resume instead of starting over.
 *
 * `propertyId` is persisted even though nothing reads it back directly
 * outside this module — without it, a retry that reuses a stored
 * `clientId` (skipping the Client lookup/creation step entirely) would
 * have no way to create a Quote, since `QuoteCreateAttributes.propertyId`
 * is required and the property is only ever discovered/created as a
 * side effect of that Client step.
 */
export interface JobberSyncInfo {
  clientId?: string;
  propertyId?: string;
  requestId?: string;
  quoteId?: string;
  quoteStatus?: string;
  clientHubUri?: string;
  jobberWebUri?: string;
  syncStatus: JobberSyncStatus;
  syncError?: string;
  lastSyncedAt?: string;
}

/**
 * The full record persisted in KV for a submitted furniture removal
 * order/quote request. Pricing here is always server-calculated — never
 * trust-passed from the client. This is the audit/fallback record —
 * Jobber (once synced) is the operational source of truth.
 */
export interface FurnitureRemovalOrderRecord {
  id: string;
  service: "furniture-removal";
  status: OrderStatus;
  submittedAt: string;
  customer: CustomerInfo;
  order: {
    items: {
      itemKey: string;
      label: string;
      quantity: number;
      unitPriceCents: number;
    }[];
    access: string;
    accessLabel: string;
    disassembly: string;
    disassemblyLabel: string;
    heavyOversizedItemCount: number;
    additionalLocations: number;
    /**
     * Photo binaries are not uploaded/stored anywhere yet (no storage
     * decision has been made for that) — only filenames/count are
     * preserved as a placeholder until that's decided.
     */
    photoCount: number;
    photoFileNames: string[];
  };
  pricing: {
    itemSubtotalCents: number;
    accessFeeCents: number;
    disassemblyFeeCents: number;
    heavyOversizedFeeCents: number;
    additionalLocationFeeCents: number;
    preMinimumTotalCents: number;
    minimumAdjustmentCents: number;
    finalTotalCents: number;
    requiresReview: boolean;
    /** Preserved so a retry/resume can build Jobber line items without recalculating. */
    lineItems: OrderLineItem[];
  };
  jobber: JobberSyncInfo;
}

/**
 * The full record persisted in KV for a submitted appliance removal
 * order/quote request. Structurally mirrors `FurnitureRemovalOrderRecord`
 * (same customer/jobber shape, same job-modifier fee concepts) but is
 * its own interface rather than a shared generic — each service's order
 * details are its own, per the reusable-service-architecture design.
 */
export interface ApplianceRemovalOrderRecord {
  id: string;
  service: "appliance-removal";
  status: OrderStatus;
  submittedAt: string;
  customer: CustomerInfo;
  order: {
    items: {
      itemKey: string;
      label: string;
      quantity: number;
      unitPriceCents: number;
    }[];
    access: string;
    accessLabel: string;
    disassembly: string;
    disassemblyLabel: string;
    heavyOversizedItemCount: number;
    additionalLocations: number;
    photoCount: number;
    photoFileNames: string[];
  };
  pricing: {
    itemSubtotalCents: number;
    accessFeeCents: number;
    disassemblyFeeCents: number;
    heavyOversizedFeeCents: number;
    refrigerantRecoveryFeeCents: number;
    additionalLocationFeeCents: number;
    preMinimumTotalCents: number;
    minimumAdjustmentCents: number;
    finalTotalCents: number;
    requiresReview: boolean;
    /** Preserved so a retry/resume can build Jobber line items without recalculating. */
    lineItems: OrderLineItem[];
  };
  jobber: JobberSyncInfo;
}

/**
 * The full record persisted in KV for a submitted general junk removal
 * order/quote request. Structurally mirrors `FurnitureRemovalOrderRecord`.
 */
export interface GeneralJunkRemovalOrderRecord {
  id: string;
  service: "general-junk-removal";
  status: OrderStatus;
  submittedAt: string;
  customer: CustomerInfo;
  order: {
    items: {
      itemKey: string;
      label: string;
      quantity: number;
      unitPriceCents: number;
    }[];
    access: string;
    accessLabel: string;
    disassembly: string;
    disassemblyLabel: string;
    heavyOversizedItemCount: number;
    additionalLocations: number;
    photoCount: number;
    photoFileNames: string[];
  };
  pricing: {
    itemSubtotalCents: number;
    accessFeeCents: number;
    disassemblyFeeCents: number;
    heavyOversizedFeeCents: number;
    additionalLocationFeeCents: number;
    preMinimumTotalCents: number;
    minimumAdjustmentCents: number;
    finalTotalCents: number;
    requiresReview: boolean;
    /** Preserved so a retry/resume can build Jobber line items without recalculating. */
    lineItems: OrderLineItem[];
  };
  jobber: JobberSyncInfo;
}

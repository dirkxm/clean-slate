import {
  createJobberClient,
  createJobberProperty,
  createJobberQuote,
  createJobberRequest,
  findJobberClientsByEmail,
  findJobberClientsByPhone,
  getValidJobberAccessToken,
} from "../jobber/index";
import type {
  JobberAccessTokenEnv,
  JobberFormInput,
  JobberPropertySearchResult,
  JobberQuoteLineItemInput,
  JobberRequestLineItemInput,
} from "../jobber/index";
import type {
  ApplianceRemovalOrderRecord,
  CustomerInfo,
  FurnitureRemovalOrderRecord,
  GeneralJunkRemovalOrderRecord,
  JobberSyncInfo,
  OrderLineItem,
} from "./types";

export type JobberSyncResult =
  | {
      ok: true;
      clientId: string;
      requestId: string;
      propertyId?: string;
      quoteId?: string;
      quoteStatus?: string;
      clientHubUri?: string;
      jobberWebUri?: string;
    }
  | {
      ok: false;
      error: string;
      clientId?: string;
      propertyId?: string;
      requestId?: string;
    };

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** name/quantity/unitPrice/totalPrice, converted from our integer-cents engine output to Jobber's decimal-dollar fields. Field names verified against the connected Jobber schema; the dollars-vs-cents unit itself was not explicitly confirmed and should be checked against a real synced Request. */
export function buildJobberLineItems(
  lineItems: OrderLineItem[],
): JobberRequestLineItemInput[] {
  return lineItems.map((item, index) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: centsToDollars(item.unitPrice),
    totalPrice: centsToDollars(item.total),
    saveToProductsAndServices: false,
    sortOrder: index,
  }));
}

/** Same mapping as buildJobberLineItems, but to QuoteCreateLineItemAttributes' shape (no sortOrder field verified on it). */
export function buildJobberQuoteLineItems(
  lineItems: OrderLineItem[],
): JobberQuoteLineItemInput[] {
  return lineItems.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: centsToDollars(item.unitPrice),
    totalPrice: centsToDollars(item.total),
    saveToProductsAndServices: false,
  }));
}

export function buildRequestTitle(customer: CustomerInfo): string {
  return `Furniture Removal — ${customer.firstName} ${customer.lastName}`;
}

export function buildQuoteTitle(customer: CustomerInfo): string {
  return `Furniture Removal Quote — ${customer.firstName} ${customer.lastName}`;
}

/**
 * Customer-facing quote message. Deliberately never mentions the
 * internal $1,000 review threshold — only that the job's size/complexity
 * called for a closer look, and that the quote reflects the current
 * estimate.
 */
export function buildQuoteMessage(): string {
  return "Thanks for your furniture removal request. Because of the size or complexity of this job, we've taken a closer look and prepared this quote based on the details you submitted. It reflects our current estimate — let us know if you'd like to move forward.";
}

/**
 * A readable staff-facing summary of the order, kept on the Request
 * regardless of what did or didn't make it onto the Client/Property —
 * residential/commercial, order specifics, and photo filenames have no
 * Jobber field of their own at all, so this is their only home. Contact
 * info and address are also repeated here (even though they're now on
 * the Client/Property too) so staff never have to leave the Request to
 * see the full picture.
 */
export function buildRequestForm(record: FurnitureRemovalOrderRecord): JobberFormInput {
  const furnitureItems = record.order.items.map((item) => ({
    label: item.label,
    answerText: `Qty ${item.quantity} × ${formatUsd(item.unitPriceCents)}`,
  }));

  return {
    sections: [
      {
        label: "Furniture Removal",
        items:
          furnitureItems.length > 0
            ? furnitureItems
            : [{ label: "Items", answerText: "None selected" }],
      },
      {
        label: "Job Details",
        items: [
          { label: "Access", answerText: record.order.accessLabel },
          { label: "Disassembly", answerText: record.order.disassemblyLabel },
          {
            label: "Heavy/Oversized Items",
            answerText: String(record.order.heavyOversizedItemCount),
          },
          {
            label: "Additional Locations",
            answerText: String(record.order.additionalLocations),
          },
        ],
      },
      {
        label: "Order",
        items: [
          { label: "Calculated Total", answerText: formatUsd(record.pricing.finalTotalCents) },
          {
            label: "Classification",
            answerText: record.pricing.requiresReview
              ? "Needs Review / Quote"
              : "Auto-Priced Booking",
          },
          {
            label: "Photos Submitted",
            answerText:
              record.order.photoCount > 0
                ? `${record.order.photoCount} photo(s): ${record.order.photoFileNames.join(", ")}`
                : "None",
          },
        ],
      },
      {
        label: "Customer",
        items: [
          {
            label: "Customer Type",
            answerText: record.customer.customerType === "commercial" ? "Commercial" : "Residential",
          },
          { label: "Phone", answerText: record.customer.phone },
          { label: "Email", answerText: record.customer.email },
          { label: "Service Address", answerText: record.customer.serviceAddress },
          { label: "City", answerText: record.customer.city },
          { label: "ZIP", answerText: record.customer.zip },
        ],
      },
    ],
  };
}

export function buildApplianceRequestTitle(customer: CustomerInfo): string {
  return `Appliance Removal — ${customer.firstName} ${customer.lastName}`;
}

export function buildApplianceQuoteTitle(customer: CustomerInfo): string {
  return `Appliance Removal Quote — ${customer.firstName} ${customer.lastName}`;
}

/** Same customer-facing framing as Furniture Removal's quote message — never mentions the internal review threshold. */
export function buildApplianceQuoteMessage(): string {
  return "Thanks for your appliance removal request. Because of the size or complexity of this job, we've taken a closer look and prepared this quote based on the details you submitted. It reflects our current estimate — let us know if you'd like to move forward.";
}

/** Mirrors buildRequestForm's structure/sections, for an appliance removal order. */
export function buildApplianceRequestForm(record: ApplianceRemovalOrderRecord): JobberFormInput {
  const applianceItems = record.order.items.map((item) => ({
    label: item.label,
    answerText: `Qty ${item.quantity} × ${formatUsd(item.unitPriceCents)}`,
  }));

  return {
    sections: [
      {
        label: "Appliance Removal",
        items:
          applianceItems.length > 0
            ? applianceItems
            : [{ label: "Items", answerText: "None selected" }],
      },
      {
        label: "Job Details",
        items: [
          { label: "Access", answerText: record.order.accessLabel },
          { label: "Disconnection", answerText: record.order.disassemblyLabel },
          {
            label: "Heavy/Oversized Items",
            answerText: String(record.order.heavyOversizedItemCount),
          },
          {
            label: "Additional Locations",
            answerText: String(record.order.additionalLocations),
          },
        ],
      },
      {
        label: "Order",
        items: [
          { label: "Calculated Total", answerText: formatUsd(record.pricing.finalTotalCents) },
          {
            label: "Classification",
            answerText: record.pricing.requiresReview
              ? "Needs Review / Quote"
              : "Auto-Priced Booking",
          },
          {
            label: "Photos Submitted",
            answerText:
              record.order.photoCount > 0
                ? `${record.order.photoCount} photo(s): ${record.order.photoFileNames.join(", ")}`
                : "None",
          },
        ],
      },
      {
        label: "Customer",
        items: [
          {
            label: "Customer Type",
            answerText: record.customer.customerType === "commercial" ? "Commercial" : "Residential",
          },
          { label: "Phone", answerText: record.customer.phone },
          { label: "Email", answerText: record.customer.email },
          { label: "Service Address", answerText: record.customer.serviceAddress },
          { label: "City", answerText: record.customer.city },
          { label: "ZIP", answerText: record.customer.zip },
        ],
      },
    ],
  };
}

export function buildGeneralJunkRequestTitle(customer: CustomerInfo): string {
  return `General Junk Removal — ${customer.firstName} ${customer.lastName}`;
}

export function buildGeneralJunkQuoteTitle(customer: CustomerInfo): string {
  return `General Junk Removal Quote — ${customer.firstName} ${customer.lastName}`;
}

/** Same customer-facing framing as Furniture Removal's quote message — never mentions the internal review threshold. */
export function buildGeneralJunkQuoteMessage(): string {
  return "Thanks for your junk removal request. Because of the size or complexity of this job, we've taken a closer look and prepared this quote based on the details you submitted. It reflects our current estimate — let us know if you'd like to move forward.";
}

/** Mirrors buildRequestForm's structure/sections, for a general junk removal order. */
export function buildGeneralJunkRequestForm(
  record: GeneralJunkRemovalOrderRecord,
): JobberFormInput {
  const junkItems = record.order.items.map((item) => ({
    label: item.label,
    answerText: `Qty ${item.quantity} × ${formatUsd(item.unitPriceCents)}`,
  }));

  return {
    sections: [
      {
        label: "General Junk Removal",
        items:
          junkItems.length > 0 ? junkItems : [{ label: "Items", answerText: "None selected" }],
      },
      {
        label: "Job Details",
        items: [
          { label: "Access", answerText: record.order.accessLabel },
          { label: "Disassembly", answerText: record.order.disassemblyLabel },
          {
            label: "Heavy/Oversized Items",
            answerText: String(record.order.heavyOversizedItemCount),
          },
          {
            label: "Additional Locations",
            answerText: String(record.order.additionalLocations),
          },
        ],
      },
      {
        label: "Order",
        items: [
          { label: "Calculated Total", answerText: formatUsd(record.pricing.finalTotalCents) },
          {
            label: "Classification",
            answerText: record.pricing.requiresReview
              ? "Needs Review / Quote"
              : "Auto-Priced Booking",
          },
          {
            label: "Photos Submitted",
            answerText:
              record.order.photoCount > 0
                ? `${record.order.photoCount} photo(s): ${record.order.photoFileNames.join(", ")}`
                : "None",
          },
        ],
      },
      {
        label: "Customer",
        items: [
          {
            label: "Customer Type",
            answerText: record.customer.customerType === "commercial" ? "Commercial" : "Residential",
          },
          { label: "Phone", answerText: record.customer.phone },
          { label: "Email", answerText: record.customer.email },
          { label: "Service Address", answerText: record.customer.serviceAddress },
          { label: "City", answerText: record.customer.city },
          { label: "ZIP", answerText: record.customer.zip },
        ],
      },
    ],
  };
}

function describeJobberError(error: { type: string; [key: string]: unknown }): string {
  switch (error.type) {
    case "not_connected":
      return "Jobber is not connected.";
    case "refresh_failed":
      return `Jobber token refresh failed: ${error.message}`;
    case "missing_access_token":
      return "No Jobber access token available.";
    case "network_error":
      return `Network error calling Jobber: ${error.message}`;
    case "http_error":
      return `Jobber returned HTTP ${error.status}: ${error.body}`;
    case "invalid_response":
      return `Unexpected Jobber response: ${error.message}`;
    case "graphql_errors":
      return `Jobber GraphQL error: ${JSON.stringify(error.errors)}`;
    case "user_errors":
      return `Jobber rejected the request: ${JSON.stringify(error.userErrors)}`;
    default:
      return `Unknown Jobber error: ${JSON.stringify(error)}`;
  }
}

type ClientLookupResult =
  | { ok: true; clientId: string; propertyId?: string }
  | { ok: false; error: string };

/**
 * Normalizes one address component for comparison: trims, lowercases,
 * drops periods (so "St." and "St" are equal), and collapses internal
 * whitespace to single spaces. Never used for anything sent to Jobber —
 * comparison only.
 */
function normalizeAddressPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

/**
 * True when an existing Jobber property's address matches the current
 * order's service address closely enough to reuse rather than create a
 * duplicate. Matches on street1 + city + postalCode only — the fields
 * that actually distinguish one physical property from another here;
 * province is a fixed business-area constant and country is always
 * "US", so neither is discriminating.
 *
 * A property with no address at all (possible for a Property that
 * predates this system, or was created without one) is never a match —
 * it's treated the same as any other non-matching property, falling
 * through to creating a new one, rather than crashing.
 */
function propertyMatchesServiceAddress(
  property: JobberPropertySearchResult,
  customer: CustomerInfo,
): boolean {
  if (!property.address) return false;

  return (
    normalizeAddressPart(property.address.street1) ===
      normalizeAddressPart(customer.serviceAddress) &&
    normalizeAddressPart(property.address.city) === normalizeAddressPart(customer.city) &&
    normalizeAddressPart(property.address.postalCode) === normalizeAddressPart(customer.zip)
  );
}

/**
 * Resolves the Property ID to use for an existing Jobber Client: reuses
 * a property whose address matches the current order's service address
 * if one exists among the Client's known properties, otherwise creates a
 * new Property on that Client for this address. Never blindly reuses an
 * unrelated property (e.g. a different city) just because it happens to
 * be first in the list — this is the fix for a Client whose Jobber
 * record has a property for a different address than the current order.
 */
async function resolveJobberPropertyId(
  accessToken: string,
  clientId: string,
  existingProperties: JobberPropertySearchResult[],
  customer: CustomerInfo,
): Promise<{ ok: true; propertyId: string } | { ok: false; error: string }> {
  const match = existingProperties.find((property) =>
    propertyMatchesServiceAddress(property, customer),
  );
  if (match) {
    return { ok: true, propertyId: match.id };
  }

  const propertyResult = await createJobberProperty(accessToken, clientId, {
    properties: [
      {
        address: {
          street1: customer.serviceAddress,
          city: customer.city,
          // Same fixed business-area constant used when creating a new
          // Client's first property below — Clean Slate only serves the
          // Des Moines, Iowa metro.
          province: "IA",
          postalCode: customer.zip,
          country: "US",
        },
      },
    ],
  });

  if (!propertyResult.ok) {
    return {
      ok: false,
      error: `Jobber sync failed at: createJobberProperty — ${describeJobberError(propertyResult.error)}`,
    };
  }

  const createdPropertyId = propertyResult.data.propertyCreate.properties[0]?.id;
  if (!createdPropertyId) {
    return {
      ok: false,
      error: "Jobber sync failed at: createJobberProperty — no Property ID was returned.",
    };
  }

  return { ok: true, propertyId: createdPropertyId };
}

/**
 * Finds an existing Jobber Client by email, then by phone, before ever
 * creating a new one — avoids duplicate Clients across repeat
 * submissions from the same customer. Never guesses: if a search comes
 * back with more than one match, this fails outright rather than
 * picking one, so it can be resolved manually in Jobber.
 *
 * Also resolves a Property ID matching the current order's service
 * address (see `resolveJobberPropertyId`) — never just the first
 * property on the Client — needed for Quote creation on the
 * review-required path and now also attached to every Request.
 */
async function findOrCreateJobberClient(
  accessToken: string,
  customer: CustomerInfo,
): Promise<ClientLookupResult> {
  const emailSearch = await findJobberClientsByEmail(accessToken, customer.email);
  if (!emailSearch.ok) {
    return {
      ok: false,
      error: `Jobber sync failed at: findJobberClientsByEmail — ${describeJobberError(emailSearch.error)}`,
    };
  }

  const emailMatches = emailSearch.data.clients.nodes;
  if (emailMatches.length === 1) {
    const client = emailMatches[0];
    const propertyResult = await resolveJobberPropertyId(
      accessToken,
      client.id,
      client.clientProperties.nodes,
      customer,
    );
    if (!propertyResult.ok) {
      return { ok: false, error: propertyResult.error };
    }
    return { ok: true, clientId: client.id, propertyId: propertyResult.propertyId };
  }
  if (emailMatches.length > 1) {
    return {
      ok: false,
      error: `Multiple Jobber Clients matched email "${customer.email}" — manual review required; no Client was created or reused.`,
    };
  }

  const phoneSearch = await findJobberClientsByPhone(accessToken, customer.phone);
  if (!phoneSearch.ok) {
    return {
      ok: false,
      error: `Jobber sync failed at: findJobberClientsByPhone — ${describeJobberError(phoneSearch.error)}`,
    };
  }

  const phoneMatches = phoneSearch.data.clients.nodes;
  if (phoneMatches.length === 1) {
    const client = phoneMatches[0];
    const propertyResult = await resolveJobberPropertyId(
      accessToken,
      client.id,
      client.clientProperties.nodes,
      customer,
    );
    if (!propertyResult.ok) {
      return { ok: false, error: propertyResult.error };
    }
    return { ok: true, clientId: client.id, propertyId: propertyResult.propertyId };
  }
  if (phoneMatches.length > 1) {
    return {
      ok: false,
      error: `Multiple Jobber Clients matched phone "${customer.phone}" — manual review required; no Client was created or reused.`,
    };
  }

  // No match by email or phone — safe to create a new Client.
  const clientResult = await createJobberClient(accessToken, {
    firstName: customer.firstName,
    lastName: customer.lastName,
    // Never inferred as a company — the website only ever collects a
    // person's name, for both residential and commercial customers. The
    // residential/commercial distinction is preserved in the Request
    // form instead (see buildRequestForm).
    isCompany: false,
    emails: [{ address: customer.email, primary: true }],
    phones: [{ number: customer.phone, primary: true }],
    properties: [
      {
        address: {
          street1: customer.serviceAddress,
          city: customer.city,
          // The website has no state/province field — Clean Slate only
          // serves the Des Moines, Iowa metro, so this is a fixed
          // business-area constant, not per-order data. Confirm "IA"
          // (USPS 2-letter form) is what Jobber expects here.
          province: "IA",
          postalCode: customer.zip,
          country: "US",
        },
      },
    ],
  });

  if (!clientResult.ok) {
    return {
      ok: false,
      error: `Jobber sync failed at: createJobberClient — ${describeJobberError(clientResult.error)}`,
    };
  }

  return {
    ok: true,
    clientId: clientResult.data.clientCreate.client.id,
    propertyId: clientResult.data.clientCreate.client.clientProperties.nodes[0]?.id,
  };
}

/**
 * The minimal shape `syncOrderToJobber` needs from any service's order
 * record — every service's record structurally satisfies this (same
 * customer/jobber shape, same requiresReview/lineItems concepts), even
 * though each has its own, non-shared top-level interface.
 */
interface JobberSyncableRecord {
  customer: CustomerInfo;
  pricing: {
    requiresReview: boolean;
    lineItems: OrderLineItem[];
  };
  jobber: JobberSyncInfo;
}

/** The small set of customer-facing text/form generation each service supplies for itself. */
interface JobberSyncFormatters<TRecord> {
  buildRequestTitle: (customer: CustomerInfo) => string;
  buildQuoteTitle: (customer: CustomerInfo) => string;
  buildQuoteMessage: () => string;
  buildRequestForm: (record: TRecord) => JobberFormInput;
}

/**
 * Syncs any removal-style order into Jobber. Shared by every service —
 * see `syncFurnitureRemovalOrderToJobber`/`syncApplianceRemovalOrderToJobber`
 * below, which are thin per-service wrappers supplying only their own
 * title/message/form text. This is the one place the actual Client →
 * Property → Request → Quote orchestration is written.
 *
 * Auto-priced (`requiresReview: false`): Client → Request.
 *
 * Review-required (`requiresReview: true`): Client → Request → Quote,
 * with the Quote transitioned to AWAITING_RESPONSE (sent to the
 * customer) immediately. No Job is created automatically in either
 * case — that remains a manual step inside Jobber.
 *
 * Idempotent at every step: a record that already has a `clientId`,
 * `requestId`, and/or `quoteId` from a prior partial or full success
 * skips those steps and resumes from wherever it left off.
 */
async function syncOrderToJobber<TRecord extends JobberSyncableRecord>(
  env: JobberAccessTokenEnv,
  record: TRecord,
  formatters: JobberSyncFormatters<TRecord>,
): Promise<JobberSyncResult> {
  const alreadyDone = record.pricing.requiresReview
    ? Boolean(record.jobber.requestId && record.jobber.quoteId)
    : Boolean(record.jobber.requestId);

  if (alreadyDone) {
    return {
      ok: true,
      clientId: record.jobber.clientId!,
      requestId: record.jobber.requestId!,
      propertyId: record.jobber.propertyId,
      quoteId: record.jobber.quoteId,
      quoteStatus: record.jobber.quoteStatus,
      clientHubUri: record.jobber.clientHubUri,
      jobberWebUri: record.jobber.jobberWebUri,
    };
  }

  const tokenResult = await getValidJobberAccessToken(env);
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: describeJobberError(tokenResult.error),
      clientId: record.jobber.clientId,
      propertyId: record.jobber.propertyId,
      requestId: record.jobber.requestId,
    };
  }
  const accessToken = tokenResult.data;

  let clientId = record.jobber.clientId;
  let propertyId = record.jobber.propertyId;
  if (!clientId) {
    const clientLookup = await findOrCreateJobberClient(accessToken, record.customer);
    if (!clientLookup.ok) {
      return { ok: false, error: clientLookup.error };
    }
    clientId = clientLookup.clientId;
    propertyId = clientLookup.propertyId;
  }

  let requestId = record.jobber.requestId;
  if (!requestId) {
    const requestResult = await createJobberRequest(accessToken, {
      clientId,
      propertyId,
      title: formatters.buildRequestTitle(record.customer),
      lineItems: buildJobberLineItems(record.pricing.lineItems),
      requestDetails: { form: formatters.buildRequestForm(record) },
    });

    if (!requestResult.ok) {
      return {
        ok: false,
        error: `Jobber sync failed at: createJobberRequest — ${describeJobberError(requestResult.error)}`,
        clientId,
        propertyId,
      };
    }

    requestId = requestResult.data.requestCreate.request.id;
  }

  if (!record.pricing.requiresReview) {
    return { ok: true, clientId, requestId, propertyId };
  }

  if (!propertyId) {
    // This Client has no Property on file (e.g. an existing Client found
    // via search whose `clientProperties` connection is empty) — Quote
    // creation genuinely cannot proceed without one, and this is not a
    // case to guess around.
    return {
      ok: false,
      error: "Cannot create Quote: no Property ID is available for this Client.",
      clientId,
      requestId,
    };
  }

  const quoteResult = await createJobberQuote(accessToken, {
    clientId,
    propertyId,
    requestId,
    title: formatters.buildQuoteTitle(record.customer),
    message: formatters.buildQuoteMessage(),
    lineItems: buildJobberQuoteLineItems(record.pricing.lineItems),
    transitionQuoteTo: "AWAITING_RESPONSE",
  });

  if (!quoteResult.ok) {
    // Client + Request already succeeded — preserve both so a retry
    // resumes at the Quote step only.
    return {
      ok: false,
      error: `Jobber sync failed at: createJobberQuote — ${describeJobberError(quoteResult.error)}`,
      clientId,
      propertyId,
      requestId,
    };
  }

  const quote = quoteResult.data.quoteCreate.quote;

  return {
    ok: true,
    clientId,
    requestId,
    propertyId,
    quoteId: quote.id,
    quoteStatus: quote.quoteStatus,
    clientHubUri: quote.clientHubUri,
    jobberWebUri: quote.jobberWebUri,
  };
}

/** Syncs a furniture removal order into Jobber. See `syncOrderToJobber` for the actual orchestration. */
export async function syncFurnitureRemovalOrderToJobber(
  env: JobberAccessTokenEnv,
  record: FurnitureRemovalOrderRecord,
): Promise<JobberSyncResult> {
  return syncOrderToJobber(env, record, {
    buildRequestTitle,
    buildQuoteTitle,
    buildQuoteMessage,
    buildRequestForm,
  });
}

/** Syncs an appliance removal order into Jobber. See `syncOrderToJobber` for the actual orchestration. */
export async function syncApplianceRemovalOrderToJobber(
  env: JobberAccessTokenEnv,
  record: ApplianceRemovalOrderRecord,
): Promise<JobberSyncResult> {
  return syncOrderToJobber(env, record, {
    buildRequestTitle: buildApplianceRequestTitle,
    buildQuoteTitle: buildApplianceQuoteTitle,
    buildQuoteMessage: buildApplianceQuoteMessage,
    buildRequestForm: buildApplianceRequestForm,
  });
}

/** Syncs a general junk removal order into Jobber. See `syncOrderToJobber` for the actual orchestration. */
export async function syncGeneralJunkRemovalOrderToJobber(
  env: JobberAccessTokenEnv,
  record: GeneralJunkRemovalOrderRecord,
): Promise<JobberSyncResult> {
  return syncOrderToJobber(env, record, {
    buildRequestTitle: buildGeneralJunkRequestTitle,
    buildQuoteTitle: buildGeneralJunkQuoteTitle,
    buildQuoteMessage: buildGeneralJunkQuoteMessage,
    buildRequestForm: buildGeneralJunkRequestForm,
  });
}

import {
  ACCESS_FEES_CENTS,
  ACCESS_LABELS,
  calculateEstimateBasedPrice,
  DISASSEMBLY_FEES_CENTS,
  EXTRA_LABOR_LABELS,
  FILL_LEVELS,
  FILL_LEVEL_LABELS,
} from "../../../src/lib/pricing/estimate-shared";
import type {
  AccessType,
  DisassemblyType,
  EstimateBasedPricingConfig,
  FillLevel,
} from "../../../src/lib/pricing/estimate-shared";
import { validateCustomerInfo } from "./validate";
import { getEstimateBasedOrder, saveEstimateBasedOrder } from "./storage";
import { syncEstimateBasedOrderToJobber } from "./jobber-sync";
import type { JobberSyncResult } from "./jobber-sync";
import type {
  EstimateBasedOrderRecord,
  EstimateBasedServiceKey,
  OrderStatus,
  OrdersEnv,
} from "./types";
import type { JobberAccessTokenEnv } from "../jobber/index";

interface RequestContext {
  request: Request;
  env: OrdersEnv & JobberAccessTokenEnv;
}

const MAX_PHOTOS = 5;
const MAX_FILENAME_LENGTH = 200;
const MAX_AREA_DESCRIPTION_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_APPROXIMATE_SQUARE_FOOTAGE = 100000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EstimateBasedServiceDefinition {
  service: EstimateBasedServiceKey;
  /** Customer-facing name used in Jobber titles/messages (e.g. "Garage Cleanout"). */
  serviceLabel: string;
  pricingConfig: EstimateBasedPricingConfig;
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Builds a POST /api/orders/<service> handler for any estimate-based
 * service (cleanouts/construction) — same validate → price → save →
 * sync → respond shape as the item-catalog services'
 * furniture-removal.ts, generic over the service definition instead of
 * duplicated per service.
 */
export function createEstimateBasedOrderHandler(
  definition: EstimateBasedServiceDefinition,
): (context: RequestContext) => Promise<Response> {
  return async function onRequestPost(context: RequestContext): Promise<Response> {
    const { request, env } = context;

    if (!env.ORDERS_KV) {
      return jsonError(500, "server_misconfigured", "Order storage is not configured.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "Request body must be valid JSON.");
    }

    if (!body || typeof body !== "object") {
      return jsonError(400, "invalid_request", "Request body must be an object.");
    }

    const payload = body as Record<string, unknown>;

    const suppliedOrderId =
      typeof payload.orderId === "string" && UUID_PATTERN.test(payload.orderId)
        ? payload.orderId
        : null;

    let record: EstimateBasedOrderRecord | null = suppliedOrderId
      ? await getEstimateBasedOrder(env.ORDERS_KV, definition.service, suppliedOrderId)
      : null;

    if (!record) {
      const customerResult = validateCustomerInfo(payload.customer);
      if (!customerResult.ok) {
        return jsonError(
          400,
          "invalid_customer_info",
          "Please check the highlighted fields.",
          customerResult.errors,
        );
      }

      if (!isNonEmptyString(payload.areaDescription, MAX_AREA_DESCRIPTION_LENGTH)) {
        return jsonError(400, "invalid_order", "Please describe the area/space.");
      }
      if (
        typeof payload.fillLevel !== "string" ||
        !FILL_LEVELS.includes(payload.fillLevel as FillLevel)
      ) {
        return jsonError(400, "invalid_order", "Please select how full the space is.");
      }
      if (
        typeof payload.access !== "string" ||
        !(payload.access in ACCESS_FEES_CENTS)
      ) {
        return jsonError(400, "invalid_order", "Please select an access option.");
      }
      if (
        typeof payload.disassembly !== "string" ||
        !(payload.disassembly in DISASSEMBLY_FEES_CENTS)
      ) {
        return jsonError(400, "invalid_order", "Please answer the extra-labor question.");
      }
      if (!isNonNegativeInteger(payload.largeItemCount)) {
        return jsonError(400, "invalid_order", "Large item count must be a non-negative number.");
      }
      if (!isNonNegativeInteger(payload.heavyOrSpecialItemCount)) {
        return jsonError(
          400,
          "invalid_order",
          "Heavy/special item count must be a non-negative number.",
        );
      }
      if (!isNonNegativeInteger(payload.additionalLocations)) {
        return jsonError(
          400,
          "invalid_order",
          "Additional locations must be a non-negative number.",
        );
      }

      const approximateSquareFootage =
        typeof payload.approximateSquareFootage === "number" &&
        Number.isFinite(payload.approximateSquareFootage) &&
        payload.approximateSquareFootage > 0 &&
        payload.approximateSquareFootage <= MAX_APPROXIMATE_SQUARE_FOOTAGE
          ? payload.approximateSquareFootage
          : undefined;

      const notes = isNonEmptyString(payload.notes, MAX_NOTES_LENGTH)
        ? (payload.notes as string).trim()
        : undefined;

      const haulAwayIncluded =
        typeof payload.haulAwayIncluded === "boolean" ? payload.haulAwayIncluded : undefined;

      const photosInput = Array.isArray(payload.photos) ? payload.photos : [];
      if (photosInput.length > MAX_PHOTOS) {
        return jsonError(400, "invalid_order", `A maximum of ${MAX_PHOTOS} photos is allowed.`);
      }
      const photoFileNames = photosInput
        .map((photo) =>
          photo && typeof photo === "object" && typeof (photo as { name?: unknown }).name === "string"
            ? (photo as { name: string }).name.slice(0, MAX_FILENAME_LENGTH)
            : null,
        )
        .filter((name): name is string => name !== null);

      const areaDescription = (payload.areaDescription as string).trim();
      const fillLevel = payload.fillLevel as FillLevel;
      const access = payload.access as AccessType;
      const disassembly = payload.disassembly as DisassemblyType;
      const largeItemCount = payload.largeItemCount as number;
      const heavyOrSpecialItemCount = payload.heavyOrSpecialItemCount as number;
      const additionalLocations = payload.additionalLocations as number;

      let pricing;
      try {
        pricing = calculateEstimateBasedPrice(
          {
            areaDescription,
            fillLevel,
            largeItemCount,
            heavyOrSpecialItemCount,
            access,
            disassembly,
            additionalLocations,
            approximateSquareFootage,
            notes,
            haulAwayIncluded,
          },
          definition.pricingConfig,
        );
      } catch (cause) {
        return jsonError(
          400,
          "invalid_order",
          cause instanceof Error ? cause.message : "Invalid order details.",
        );
      }

      const status: OrderStatus = pricing.requiresReview ? "quote_requested" : "booking_requested";

      record = {
        id: suppliedOrderId ?? crypto.randomUUID(),
        service: definition.service,
        status,
        submittedAt: new Date().toISOString(),
        customer: customerResult.data,
        order: {
          areaDescription,
          fillLevel,
          fillLevelLabel: FILL_LEVEL_LABELS[fillLevel],
          largeItemCount,
          heavyOrSpecialItemCount,
          access,
          accessLabel: ACCESS_LABELS[access],
          disassembly,
          disassemblyLabel: EXTRA_LABOR_LABELS[disassembly],
          additionalLocations,
          approximateSquareFootage,
          notes,
          haulAwayIncluded,
          photoCount: photoFileNames.length,
          photoFileNames,
        },
        pricing: {
          severityScore: pricing.severityScore,
          finalTotalCents: pricing.finalTotalCents,
          requiresReview: pricing.requiresReview,
          pricingConfigured: pricing.pricingConfigured,
          lineItems: pricing.lineItems,
        },
        jobber: { syncStatus: "pending" },
      };

      try {
        await saveEstimateBasedOrder(env.ORDERS_KV, record);
      } catch {
        return jsonError(500, "storage_failed", "Failed to save the order. Please try again.");
      }
    }

    // From here on, the submission is already safely stored. Nothing
    // below this point may cause the customer's request to be lost.
    let syncResult: JobberSyncResult;
    try {
      syncResult = await syncEstimateBasedOrderToJobber(env, record, definition.serviceLabel);
    } catch (cause) {
      syncResult = {
        ok: false,
        error: cause instanceof Error ? cause.message : "Unexpected error syncing to Jobber.",
        clientId: record.jobber.clientId,
        propertyId: record.jobber.propertyId,
        requestId: record.jobber.requestId,
      };
    }

    record.jobber = syncResult.ok
      ? {
          clientId: syncResult.clientId,
          propertyId: syncResult.propertyId,
          requestId: syncResult.requestId,
          quoteId: syncResult.quoteId,
          quoteStatus: syncResult.quoteStatus,
          clientHubUri: syncResult.clientHubUri,
          jobberWebUri: syncResult.jobberWebUri,
          syncStatus: "synced",
          lastSyncedAt: new Date().toISOString(),
        }
      : {
          ...record.jobber,
          clientId: syncResult.clientId ?? record.jobber.clientId,
          propertyId: syncResult.propertyId ?? record.jobber.propertyId,
          requestId: syncResult.requestId ?? record.jobber.requestId,
          syncStatus: "failed",
          syncError: syncResult.error,
        };

    try {
      await saveEstimateBasedOrder(env.ORDERS_KV, record);
    } catch {
      // The submission itself was already saved before the sync attempt.
    }

    return json(200, {
      success: true,
      orderId: record.id,
      status: record.status,
      finalTotalCents: record.pricing.finalTotalCents,
      requiresReview: record.pricing.requiresReview,
      pricingConfigured: record.pricing.pricingConfigured,
      jobberSynced: syncResult.ok,
      ...(syncResult.ok ? {} : { jobberSyncError: syncResult.error }),
    });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return json(status, {
    success: false,
    error: code,
    message,
    ...(details ? { details } : {}),
  });
}

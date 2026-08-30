import { calculateFurnitureRemovalPrice } from "../../../src/lib/pricing/furniture";
import {
  ACCESS_LABELS,
  DISASSEMBLY_LABELS,
  FURNITURE_ITEMS,
} from "../../../src/lib/pricing/furniture";
import type {
  AccessType,
  DisassemblyType,
  FurnitureItemKey,
  FurnitureSelection,
} from "../../../src/lib/pricing/furniture";
import { validateCustomerInfo } from "../../_lib/orders/validate";
import {
  getFurnitureRemovalOrder,
  saveFurnitureRemovalOrder,
} from "../../_lib/orders/storage";
import { syncFurnitureRemovalOrderToJobber } from "../../_lib/orders/jobber-sync";
import type { JobberSyncResult } from "../../_lib/orders/jobber-sync";
import type {
  FurnitureRemovalOrderRecord,
  FurnitureRemovalOrderRequestBody,
  OrderStatus,
  OrdersEnv,
} from "../../_lib/orders/types";
import type { JobberAccessTokenEnv } from "../../_lib/jobber/index";

interface RequestContext {
  request: Request;
  env: OrdersEnv & JobberAccessTokenEnv;
}

const MAX_PHOTOS = 5;
const MAX_FILENAME_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/orders/furniture-removal
 *
 * 1. Validates customer/order data and recalculates pricing server-side
 *    (never trusting a client-sent total) — unless this is a retry of an
 *    already-stored submission (see idempotency below), in which case
 *    the stored record is reused as-is.
 * 2. Saves the order to ORDERS_KV — this happens BEFORE any Jobber call,
 *    so the customer's submission is never lost even if Jobber is down.
 * 3. Syncs the order into Jobber: find-or-create Client, then create a
 *    Request carrying pricing as native line items and everything else
 *    in the Request Form. Does not create a Quote or Job — that's an
 *    explicit human-in-the-loop step performed inside Jobber.
 * 4. Updates ORDERS_KV with the resulting Jobber IDs (or the failure
 *    reason) and returns the same customer-facing result either way —
 *    a Jobber outage never surfaces as a failed submission to the
 *    customer, since their data is already safely stored.
 *
 * Idempotency: the client generates and resends the same `orderId` UUID
 * on retry. If ORDERS_KV already has a record for that ID, it's reused
 * rather than re-validated/re-priced, and syncFurnitureRemovalOrderToJobber
 * skips any Jobber steps already completed (so retries never create a
 * duplicate Client or Request).
 */
export async function onRequestPost(context: RequestContext): Promise<Response> {
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

  const payload = body as Partial<FurnitureRemovalOrderRequestBody>;

  const suppliedOrderId =
    typeof payload.orderId === "string" && UUID_PATTERN.test(payload.orderId)
      ? payload.orderId
      : null;

  let record: FurnitureRemovalOrderRecord | null = suppliedOrderId
    ? await getFurnitureRemovalOrder(env.ORDERS_KV, suppliedOrderId)
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

    if (!Array.isArray(payload.items)) {
      return jsonError(400, "invalid_order", "Missing or invalid furniture item selections.");
    }

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

    let pricing;
    let furnitureSelections: FurnitureSelection[];
    try {
      furnitureSelections = payload.items as FurnitureSelection[];
      pricing = calculateFurnitureRemovalPrice({
        items: furnitureSelections,
        access: payload.access as AccessType,
        disassembly: payload.disassembly as DisassemblyType,
        heavyOversizedItemCount: payload.heavyOversizedItemCount as number,
        additionalLocations: payload.additionalLocations as number,
      });
    } catch (cause) {
      return jsonError(
        400,
        "invalid_order",
        cause instanceof Error ? cause.message : "Invalid order details.",
      );
    }

    const status: OrderStatus = pricing.requiresReview
      ? "quote_requested"
      : "booking_requested";

    const orderedItems = furnitureSelections
      .filter((selection) => selection.quantity > 0)
      .map((selection) => {
        const config = FURNITURE_ITEMS[selection.itemKey as FurnitureItemKey];
        return {
          itemKey: selection.itemKey,
          label: config.label,
          quantity: selection.quantity,
          unitPriceCents: config.priceCents,
        };
      });

    record = {
      id: suppliedOrderId ?? crypto.randomUUID(),
      service: "furniture-removal",
      status,
      submittedAt: new Date().toISOString(),
      customer: customerResult.data,
      order: {
        items: orderedItems,
        access: payload.access as string,
        accessLabel: ACCESS_LABELS[payload.access as AccessType],
        disassembly: payload.disassembly as string,
        disassemblyLabel: DISASSEMBLY_LABELS[payload.disassembly as DisassemblyType],
        heavyOversizedItemCount: payload.heavyOversizedItemCount as number,
        additionalLocations: payload.additionalLocations as number,
        photoCount: photoFileNames.length,
        photoFileNames,
      },
      pricing: {
        itemSubtotalCents: pricing.itemSubtotalCents,
        accessFeeCents: pricing.accessFeeCents,
        disassemblyFeeCents: pricing.disassemblyFeeCents,
        heavyOversizedFeeCents: pricing.heavyOversizedFeeCents,
        additionalLocationFeeCents: pricing.additionalLocationFeeCents,
        preMinimumTotalCents: pricing.preMinimumTotalCents,
        minimumAdjustmentCents: pricing.minimumAdjustmentCents,
        finalTotalCents: pricing.finalTotalCents,
        requiresReview: pricing.requiresReview,
        lineItems: pricing.lineItems,
      },
      jobber: { syncStatus: "pending" },
    };

    try {
      await saveFurnitureRemovalOrder(env.ORDERS_KV, record);
    } catch {
      return jsonError(500, "storage_failed", "Failed to save the order. Please try again.");
    }
  }

  // From here on, the submission is already safely stored. Nothing below
  // this point may cause the customer's request to be lost — any
  // unexpected failure just leaves it recorded as sync-failed for retry.
  let syncResult: JobberSyncResult;
  try {
    syncResult = await syncFurnitureRemovalOrderToJobber(env, record);
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
    await saveFurnitureRemovalOrder(env.ORDERS_KV, record);
  } catch {
    // The submission itself was already saved before the sync attempt —
    // only this follow-up status update failed to persist.
  }

  return json(200, {
    success: true,
    orderId: record.id,
    status: record.status,
    finalTotalCents: record.pricing.finalTotalCents,
    requiresReview: record.pricing.requiresReview,
    jobberSynced: syncResult.ok,
    ...(syncResult.ok ? {} : { jobberSyncError: syncResult.error }),
  });
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

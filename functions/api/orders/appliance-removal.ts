import { calculateApplianceRemovalPrice } from "../../../src/lib/pricing/appliance";
import {
  ACCESS_LABELS,
  APPLIANCE_ITEMS,
  DISCONNECTION_LABELS,
} from "../../../src/lib/pricing/appliance";
import type {
  AccessType,
  ApplianceItemKey,
  ApplianceSelection,
  DisassemblyType,
} from "../../../src/lib/pricing/appliance";
import { validateCustomerInfo } from "../../_lib/orders/validate";
import {
  getApplianceRemovalOrder,
  saveApplianceRemovalOrder,
} from "../../_lib/orders/storage";
import { syncApplianceRemovalOrderToJobber } from "../../_lib/orders/jobber-sync";
import type { JobberSyncResult } from "../../_lib/orders/jobber-sync";
import { finalizeSyncedOrder } from "../../_lib/orders/sync-finalize";
import type {
  ApplianceRemovalOrderRecord,
  OrderStatus,
  OrdersEnv,
  RemovalOrderRequestBody,
} from "../../_lib/orders/types";
import type { JobberAccessTokenEnv } from "../../_lib/jobber/index";
import type { OnlineBookingEnv } from "../../_lib/jobber/online-booking";
import type { StaffAlertEnv } from "../../_lib/notify/staff-alert";

interface RequestContext {
  request: Request;
  env: OrdersEnv & JobberAccessTokenEnv & StaffAlertEnv & OnlineBookingEnv;
}

const MAX_PHOTOS = 5;
const MAX_FILENAME_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/orders/appliance-removal
 *
 * Mirrors /api/orders/furniture-removal exactly — same validate → price
 * → save → sync → respond flow, same idempotency (client-generated
 * `orderId`), same "never lose the order even if Jobber fails"
 * guarantee. See that file's comment for the full rationale; not
 * repeated here to avoid drift between two copies of the same
 * explanation.
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

  const payload = body as Partial<RemovalOrderRequestBody>;

  const suppliedOrderId =
    typeof payload.orderId === "string" && UUID_PATTERN.test(payload.orderId)
      ? payload.orderId
      : null;

  let record: ApplianceRemovalOrderRecord | null = suppliedOrderId
    ? await getApplianceRemovalOrder(env.ORDERS_KV, suppliedOrderId)
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
      return jsonError(400, "invalid_order", "Missing or invalid appliance item selections.");
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
    let applianceSelections: ApplianceSelection[];
    try {
      applianceSelections = payload.items as ApplianceSelection[];
      pricing = calculateApplianceRemovalPrice({
        items: applianceSelections,
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

    const orderedItems = applianceSelections
      .filter((selection) => selection.quantity > 0)
      .map((selection) => {
        const config = APPLIANCE_ITEMS[selection.itemKey as ApplianceItemKey];
        return {
          itemKey: selection.itemKey,
          label: config.label,
          quantity: selection.quantity,
          unitPriceCents: config.priceCents,
        };
      });

    record = {
      id: suppliedOrderId ?? crypto.randomUUID(),
      service: "appliance-removal",
      status,
      submittedAt: new Date().toISOString(),
      customer: customerResult.data,
      order: {
        items: orderedItems,
        access: payload.access as string,
        accessLabel: ACCESS_LABELS[payload.access as AccessType],
        disassembly: payload.disassembly as string,
        disassemblyLabel: DISCONNECTION_LABELS[payload.disassembly as DisassemblyType],
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
        refrigerantRecoveryFeeCents: pricing.refrigerantRecoveryFeeCents,
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
      await saveApplianceRemovalOrder(env.ORDERS_KV, record);
    } catch {
      return jsonError(500, "storage_failed", "Failed to save the order. Please try again.");
    }
  }

  // From here on, the submission is already safely stored. Nothing below
  // this point may cause the customer's request to be lost — any
  // unexpected failure just leaves it recorded as sync-failed for retry.
  let syncResult: JobberSyncResult;
  try {
    syncResult = await syncApplianceRemovalOrderToJobber(env, record);
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
    await saveApplianceRemovalOrder(env.ORDERS_KV, record);
  } catch {
    // The submission itself was already saved before the sync attempt —
    // only this follow-up status update failed to persist.
  }

  const { onlineBookingUrl } = await finalizeSyncedOrder(env, {
    serviceLabel: "Appliance Removal",
    orderId: record.id,
    status: record.status,
    customer: record.customer,
    finalTotalCents: record.pricing.finalTotalCents,
    requiresReview: record.pricing.requiresReview,
    jobber: record.jobber,
  });

  return json(200, {
    success: true,
    orderId: record.id,
    status: record.status,
    finalTotalCents: record.pricing.finalTotalCents,
    requiresReview: record.pricing.requiresReview,
    jobberSynced: syncResult.ok,
    onlineBookingUrl,
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

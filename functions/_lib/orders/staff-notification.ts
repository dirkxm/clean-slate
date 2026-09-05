/**
 * Turns a just-synced order into a staff Slack alert.
 *
 * Stage 1 online-booking rollout (Pickup Scheduler Build Plan, Phase A):
 * once our detailed Jobber Request is created, staff get a heads-up so
 * they can reconcile it with the Job that Jobber's hosted Online Booking
 * form creates when the customer picks a pickup time, and send the
 * deposit request. Fires only on a successful sync — sync failures are
 * Phase 5's separate concern.
 *
 * Delivery is best-effort: `notifyStaffOfSyncedOrder` never throws and
 * its result is advisory. An order response must not depend on it.
 */

import {
  sendStaffAlert,
  type StaffAlert,
  type StaffAlertEnv,
  type StaffAlertResult,
} from "../notify/staff-alert";
import type { CustomerInfo, JobberSyncInfo, OrderStatus } from "./types";

export interface SyncedOrderAlertInput {
  /** Customer-facing service name, e.g. "Furniture Removal". */
  serviceLabel: string;
  /** Our internal order-record UUID (the KV key / idempotency key). */
  orderId: string;
  status: OrderStatus;
  customer: CustomerInfo;
  finalTotalCents: number;
  requiresReview: boolean;
  /**
   * Estimate-based services only: false when the service has no online
   * price configured yet, so the total is a placeholder, not a quote.
   */
  pricingConfigured?: boolean;
  jobber: JobberSyncInfo;
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Exposed for tests — the alert `notifyStaffOfSyncedOrder` would send for this input. */
export function buildSyncedOrderAlert(input: SyncedOrderAlertInput): StaffAlert {
  const { customer } = input;
  const isBooking = input.status === "booking_requested";

  const priceValue =
    input.pricingConfigured === false
      ? "Pending — online pricing not configured for this service"
      : `${formatUsd(input.finalTotalCents)}${input.requiresReview ? " (needs review)" : ""}`;

  const fields = [
    { label: "Customer", value: `${customer.firstName} ${customer.lastName}` },
    { label: "Phone", value: customer.phone },
    { label: "Email", value: customer.email },
    {
      label: "Address",
      value: `${customer.serviceAddress}, ${customer.city} ${customer.zip}`,
    },
    { label: "Calculated total", value: priceValue },
    { label: "Order ID", value: input.orderId },
  ];

  const action = isBooking
    ? "Next: match the Job that Jobber Online Booking creates when the customer picks a pickup time to this Request, then send the deposit request."
    : "Next: review the submitted details and send the customer their quote.";

  return {
    title: `New online ${isBooking ? "booking" : "quote request"} — ${input.serviceLabel}`,
    fields,
    action,
    link: input.jobber.jobberWebUri ?? input.jobber.clientHubUri,
  };
}

/**
 * Sends the staff alert for a synced order. A no-op (returning
 * `{ ok: true, delivered: false }`) when the order didn't sync or no
 * Slack webhook is configured. Never throws.
 */
export async function notifyStaffOfSyncedOrder(
  env: StaffAlertEnv,
  input: SyncedOrderAlertInput,
): Promise<StaffAlertResult> {
  if (input.jobber.syncStatus !== "synced") {
    return { ok: true, delivered: false };
  }

  try {
    return await sendStaffAlert(env, buildSyncedOrderAlert(input));
  } catch (cause) {
    // sendStaffAlert is already no-throw; this is belt-and-braces so a
    // caller can `void notifyStaffOfSyncedOrder(...)` with zero risk.
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

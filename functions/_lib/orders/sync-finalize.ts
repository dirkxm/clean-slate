/**
 * Shared tail end of the removal-order handlers (furniture / appliance /
 * general junk), run once the Jobber sync has completed and the order
 * record's `jobber` block has been updated.
 *
 * Two Stage 1 online-booking concerns live here so the three handlers
 * don't each carry their own copy:
 *  - fire the best-effort staff Slack alert for a synced order
 *  - resolve the Jobber Online Booking URL to hand back to the wizard so
 *    the customer can pick a pickup time (booking path only)
 */

import { getOnlineBookingUrl, type OnlineBookingEnv } from "../jobber/online-booking";
import type { StaffAlertEnv } from "../notify/staff-alert";
import {
  notifyStaffOfSyncedOrder,
  type SyncedOrderAlertInput,
} from "./staff-notification";

export interface FinalizeSyncedOrderResult {
  /**
   * The Jobber Online Booking form URL for the wizard to embed, or
   * `null` when this isn't an instant-booking order, the sync didn't
   * succeed, or Online Booking isn't configured on the account yet — in
   * every one of those cases the wizard shows its plain follow-up screen.
   */
  onlineBookingUrl: string | null;
}

export async function finalizeSyncedOrder(
  env: StaffAlertEnv & OnlineBookingEnv,
  input: SyncedOrderAlertInput,
): Promise<FinalizeSyncedOrderResult> {
  // Best-effort; never throws, never affects the customer response.
  await notifyStaffOfSyncedOrder(env, input);

  const eligibleForOnlineBooking =
    input.status === "booking_requested" && input.jobber.syncStatus === "synced";

  return {
    onlineBookingUrl: eligibleForOnlineBooking ? getOnlineBookingUrl(env) : null,
  };
}

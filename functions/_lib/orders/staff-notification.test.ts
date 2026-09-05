import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSyncedOrderAlert,
  notifyStaffOfSyncedOrder,
  type SyncedOrderAlertInput,
} from "./staff-notification";
import type { CustomerInfo } from "./types";

const customer: CustomerInfo = {
  firstName: "Jane",
  lastName: "Doe",
  phone: "(515) 202-3593",
  email: "jane@example.com",
  serviceAddress: "123 Main St",
  city: "Des Moines",
  zip: "50309",
  customerType: "residential",
};

function input(overrides: Partial<SyncedOrderAlertInput> = {}): SyncedOrderAlertInput {
  return {
    serviceLabel: "Furniture Removal",
    orderId: "11111111-1111-1111-1111-111111111111",
    status: "booking_requested",
    customer,
    finalTotalCents: 34000,
    requiresReview: false,
    jobber: {
      syncStatus: "synced",
      requestId: "req-1",
      jobberWebUri: "https://secure.getjobber.com/work_requests/1",
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSyncedOrderAlert", () => {
  it("titles a booking and includes the deposit-reconciliation action", () => {
    const alert = buildSyncedOrderAlert(input());
    expect(alert.title).toBe("New online booking — Furniture Removal");
    expect(alert.action).toContain("deposit request");
    expect(alert.link).toBe("https://secure.getjobber.com/work_requests/1");
    expect(alert.fields).toContainEqual({ label: "Customer", value: "Jane Doe" });
    expect(alert.fields).toContainEqual({ label: "Calculated total", value: "$340.00" });
    expect(alert.fields).toContainEqual({
      label: "Address",
      value: "123 Main St, Des Moines 50309",
    });
  });

  it("titles a quote request and asks staff to send the quote", () => {
    const alert = buildSyncedOrderAlert(input({ status: "quote_requested", requiresReview: true }));
    expect(alert.title).toBe("New online quote request — Furniture Removal");
    expect(alert.action).toContain("send the customer their quote");
    expect(alert.fields).toContainEqual({
      label: "Calculated total",
      value: "$340.00 (needs review)",
    });
  });

  it("shows a placeholder total when pricing is not configured", () => {
    const alert = buildSyncedOrderAlert(input({ pricingConfigured: false }));
    expect(alert.fields).toContainEqual({
      label: "Calculated total",
      value: "Pending — online pricing not configured for this service",
    });
  });

  it("falls back to the client hub link when there's no request web URI", () => {
    const alert = buildSyncedOrderAlert(
      input({ jobber: { syncStatus: "synced", clientHubUri: "https://clienthub/x" } }),
    );
    expect(alert.link).toBe("https://clienthub/x");
  });
});

describe("notifyStaffOfSyncedOrder", () => {
  it("does not send when the order did not sync", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyStaffOfSyncedOrder(
      { STAFF_ALERT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/x" },
      input({ jobber: { syncStatus: "failed", syncError: "boom" } }),
    );

    expect(result).toEqual({ ok: true, delivered: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the alert for a synced order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await notifyStaffOfSyncedOrder(
      { STAFF_ALERT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/x" },
      input(),
    );

    expect(result).toEqual({ ok: true, delivered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

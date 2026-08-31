import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./general-junk-removal";
import { getGeneralJunkRemovalOrder } from "../../_lib/orders/storage";
import { createMockOrdersKv } from "../../_lib/orders/test-support";
import { calculateGeneralJunkRemovalPrice } from "../../../src/lib/pricing/general-junk";
import { createMockKv } from "../../_lib/jobber/test-support";
import { putJobberConnection } from "../../_lib/jobber/connection";
import type { JobberConnection } from "../../_lib/jobber/types";
import type { OrdersEnv } from "../../_lib/orders/types";
import type { JobberAccessTokenEnv } from "../../_lib/jobber/index";

const validCustomer = {
  firstName: "Jane",
  lastName: "Doe",
  phone: "(515) 202-3593",
  email: "jane@example.com",
  serviceAddress: "123 Main St",
  city: "Des Moines",
  zip: "50309",
  customerType: "residential",
};

function makeEnv(): OrdersEnv {
  return { ORDERS_KV: createMockOrdersKv() };
}

async function makeConnectedEnv(): Promise<OrdersEnv & JobberAccessTokenEnv> {
  const jobberKv = createMockKv();
  const connection: JobberConnection = {
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    obtainedAt: new Date().toISOString(),
    scope: "clients:write jobs:write",
  };
  await putJobberConnection(jobberKv, connection);

  return {
    ORDERS_KV: createMockOrdersKv(),
    JOBBER_CLIENT_ID: "client-123",
    JOBBER_CLIENT_SECRET: "secret-123",
    JOBBER_KV: jobberKv,
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: "", text: async () => "", json: async () => body } as Response;
}

/** Full fresh-Client sync sequence: email search (miss), phone search (miss), clientCreate, requestCreate. */
function mockJobberSyncSuccess(
  clientId = "jobber-client-1",
  requestId = "jobber-request-1",
  propertyId = "jobber-property-1",
) {
  const fn = vi.fn();
  fn.mockResolvedValueOnce(jsonResponse({ data: { clients: { nodes: [] } } }));
  fn.mockResolvedValueOnce(jsonResponse({ data: { clients: { nodes: [] } } }));
  fn.mockResolvedValueOnce(
    jsonResponse({
      data: {
        clientCreate: {
          client: { id: clientId, clientProperties: { nodes: [{ id: propertyId }] } },
          userErrors: [],
        },
      },
    }),
  );
  fn.mockResolvedValueOnce(
    jsonResponse({ data: { requestCreate: { request: { id: requestId }, userErrors: [] } } }),
  );
  global.fetch = fn;
  return fn;
}

function makeRequest(body: unknown): Request {
  return new Request("https://clean-slate-dsm.com/api/orders/general-junk-removal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const smallOrderBody = {
  customer: validCustomer,
  items: [{ itemKey: "bagSmall", quantity: 1 }],
  access: "garage",
  disassembly: "none",
  heavyOversizedItemCount: 0,
  additionalLocations: 0,
  photos: [],
};

describe("POST /api/orders/general-junk-removal", () => {
  it("accepts a valid, low-value submission and classifies it as an instant booking", async () => {
    const env = makeEnv();
    const response = await onRequestPost({ request: makeRequest(smallOrderBody), env });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("booking_requested");
    expect(body.requiresReview).toBe(false);
    expect(body.finalTotalCents).toBe(9900); // one $25 bag hits the $99 minimum
  });

  it("classifies a high-value submission as a quote request", async () => {
    const env = makeEnv();
    const body = { ...smallOrderBody, items: [{ itemKey: "piano", quantity: 6 }] }; // 6 x $200 = $1,200
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("quote_requested");
    expect(json.requiresReview).toBe(true);
    expect(json.finalTotalCents).toBe(120000);
  });

  it("rejects a submission with missing customer information", async () => {
    const env = makeEnv();
    const body = { ...smallOrderBody, customer: { firstName: "Jane" } };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("invalid_customer_info");
  });

  it("rejects a submission with an invalid item key", async () => {
    const env = makeEnv();
    const body = { ...smallOrderBody, items: [{ itemKey: "notAnItem", quantity: 1 }] };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_order");
  });

  it("rejects malformed JSON", async () => {
    const env = makeEnv();
    const request = new Request("https://clean-slate-dsm.com/api/orders/general-junk-removal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const response = await onRequestPost({ request, env });
    expect(response.status).toBe(400);
  });

  it("recalculates price server-side rather than trusting any client-sent figure", async () => {
    const env = makeEnv();
    const body = {
      ...smallOrderBody,
      items: [
        { itemKey: "bagLarge", quantity: 1 },
        { itemKey: "tire", quantity: 2 },
      ],
      access: "basement",
    };
    const response = await onRequestPost({ request: makeRequest(body), env });
    const json = await response.json();

    const independent = calculateGeneralJunkRemovalPrice({
      items: [
        { itemKey: "bagLarge", quantity: 1 },
        { itemKey: "tire", quantity: 2 },
      ],
      access: "basement",
      disassembly: "none",
      heavyOversizedItemCount: 0,
      additionalLocations: 0,
    });

    expect(json.finalTotalCents).toBe(independent.finalTotalCents);
  });

  it("preserves the complete order in storage", async () => {
    const env = makeEnv();
    const body = {
      customer: validCustomer,
      items: [{ itemKey: "hotTub", quantity: 1 }],
      access: "basement",
      disassembly: "difficult",
      heavyOversizedItemCount: 1,
      additionalLocations: 1,
      photos: [{ name: "hottub.jpg" }],
    };

    const response = await onRequestPost({ request: makeRequest(body), env });
    const json = await response.json();
    expect(response.status).toBe(200);

    const stored = await getGeneralJunkRemovalOrder(env.ORDERS_KV, json.orderId);
    expect(stored).not.toBeNull();
    expect(stored?.customer).toEqual(validCustomer);
    expect(stored?.order.items).toEqual([
      { itemKey: "hotTub", label: "Hot Tub / Spa", quantity: 1, unitPriceCents: 25000 },
    ]);
    expect(stored?.order.disassemblyLabel).toBe("Difficult Disassembly");
    expect(stored?.pricing.finalTotalCents).toBe(json.finalTotalCents);
  });

  it("rejects more than the maximum allowed photos", async () => {
    const env = makeEnv();
    const body = {
      ...smallOrderBody,
      photos: Array.from({ length: 6 }, (_, i) => ({ name: `photo-${i}.jpg` })),
    };
    const response = await onRequestPost({ request: makeRequest(body), env });
    expect(response.status).toBe(400);
  });

  it("returns 500 when ORDERS_KV is not configured", async () => {
    const response = await onRequestPost({
      request: makeRequest(smallOrderBody),
      env: {} as OrdersEnv,
    });
    expect(response.status).toBe(500);
  });

  describe("Jobber sync", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("syncs a normal (auto-priced) submission to a Jobber Client + Request", async () => {
      const env = await makeConnectedEnv();
      mockJobberSyncSuccess("client-a", "request-a");

      const response = await onRequestPost({ request: makeRequest(smallOrderBody), env });
      const json = await response.json();

      expect(json.status).toBe("booking_requested");
      expect(json.jobberSynced).toBe(true);

      const stored = await getGeneralJunkRemovalOrder(env.ORDERS_KV, json.orderId);
      expect(stored?.jobber.clientId).toBe("client-a");
      expect(stored?.jobber.requestId).toBe("request-a");
      expect(stored?.jobber.syncStatus).toBe("synced");
    });

    it("does not create a duplicate Client/Request when the same orderId is retried", async () => {
      const env = await makeConnectedEnv();
      const orderId = "44444444-4444-4444-4444-444444444444";
      const body = { ...smallOrderBody, orderId };

      const fetchMock = mockJobberSyncSuccess("client-c", "request-c");
      const first = await onRequestPost({ request: makeRequest(body), env });
      const firstJson = await first.json();

      const second = await onRequestPost({ request: makeRequest(body), env });
      const secondJson = await second.json();

      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(secondJson.orderId).toBe(firstJson.orderId);
      expect(secondJson.jobberSynced).toBe(true);
    });

    it("still returns a normal success response when Jobber isn't connected at all", async () => {
      const env = makeEnv();
      const response = await onRequestPost({
        request: makeRequest(smallOrderBody),
        env: env as OrdersEnv & JobberAccessTokenEnv,
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.jobberSynced).toBe(false);
    });
  });
});

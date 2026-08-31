import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./garage-cleanout";
import { getEstimateBasedOrder } from "../../_lib/orders/storage";
import { createMockOrdersKv } from "../../_lib/orders/test-support";
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

function mockJobberRequestOnlySuccess(clientId = "client-1", requestId = "request-1", propertyId = "property-1") {
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
  return new Request("https://clean-slate-dsm.com/api/orders/garage-cleanout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validOrderBody = {
  customer: validCustomer,
  areaDescription: "Two-Car Garage",
  fillLevel: "moderate",
  largeItemCount: 1,
  heavyOrSpecialItemCount: 0,
  access: "garage",
  disassembly: "none",
  additionalLocations: 0,
  photos: [],
};

describe("POST /api/orders/garage-cleanout (generic estimate-based handler)", () => {
  it("accepts a valid submission and honestly reports pricing as not yet configured", async () => {
    const env = makeEnv();
    const response = await onRequestPost({ request: makeRequest(validOrderBody), env });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    // The core "do not invent pricing" guarantee, verified end-to-end
    // through the real API response a customer would actually receive.
    expect(body.pricingConfigured).toBe(false);
    expect(body.finalTotalCents).toBe(0);
    expect(body.requiresReview).toBe(true);
    expect(body.status).toBe("quote_requested");
  });

  it("rejects a submission with missing customer information", async () => {
    const env = makeEnv();
    const body = { ...validOrderBody, customer: { firstName: "Jane" } };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_customer_info");
  });

  it("rejects an invalid fillLevel", async () => {
    const env = makeEnv();
    const body = { ...validOrderBody, fillLevel: "overflowing" };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_order");
  });

  it("rejects an invalid access value", async () => {
    const env = makeEnv();
    const body = { ...validOrderBody, access: "teleport" };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
  });

  it("rejects a missing areaDescription", async () => {
    const env = makeEnv();
    const body = { ...validOrderBody, areaDescription: "" };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const env = makeEnv();
    const request = new Request("https://clean-slate-dsm.com/api/orders/garage-cleanout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const response = await onRequestPost({ request, env });
    expect(response.status).toBe(400);
  });

  it("preserves the complete order in storage", async () => {
    const env = makeEnv();
    const body = {
      ...validOrderBody,
      fillLevel: "veryHeavy",
      largeItemCount: 3,
      heavyOrSpecialItemCount: 1,
      approximateSquareFootage: 400,
      notes: "Old paint cans in the corner.",
      photos: [{ name: "garage.jpg" }],
    };

    const response = await onRequestPost({ request: makeRequest(body), env });
    const json = await response.json();
    expect(response.status).toBe(200);

    const stored = await getEstimateBasedOrder(env.ORDERS_KV, "garage-cleanout", json.orderId);
    expect(stored).not.toBeNull();
    expect(stored?.customer).toEqual(validCustomer);
    expect(stored?.order.areaDescription).toBe("Two-Car Garage");
    expect(stored?.order.fillLevelLabel).toBe("Very Heavily Filled");
    expect(stored?.order.largeItemCount).toBe(3);
    expect(stored?.order.approximateSquareFootage).toBe(400);
    expect(stored?.order.notes).toBe("Old paint cans in the corner.");
    expect(stored?.order.photoFileNames).toEqual(["garage.jpg"]);
    expect(stored?.pricing.pricingConfigured).toBe(false);
  });

  it("rejects more than the maximum allowed photos", async () => {
    const env = makeEnv();
    const body = {
      ...validOrderBody,
      photos: Array.from({ length: 6 }, (_, i) => ({ name: `photo-${i}.jpg` })),
    };
    const response = await onRequestPost({ request: makeRequest(body), env });
    expect(response.status).toBe(400);
  });

  it("returns 500 when ORDERS_KV is not configured", async () => {
    const response = await onRequestPost({
      request: makeRequest(validOrderBody),
      env: {} as OrdersEnv,
    });
    expect(response.status).toBe(500);
  });

  describe("Jobber sync", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("creates a Client + Request (never a Quote, since there's nothing priced yet to quote)", async () => {
      const env = await makeConnectedEnv();
      const fetchMock = mockJobberRequestOnlySuccess();

      const response = await onRequestPost({ request: makeRequest(validOrderBody), env });
      const json = await response.json();

      expect(json.jobberSynced).toBe(true);
      // search x2 + create + request = 4 calls; a 5th (quoteCreate) call
      // would mean the empty-lineItems guard regressed.
      expect(fetchMock).toHaveBeenCalledTimes(4);

      const stored = await getEstimateBasedOrder(env.ORDERS_KV, "garage-cleanout", json.orderId);
      expect(stored?.jobber.requestId).toBe("request-1");
      expect(stored?.jobber.quoteId).toBeUndefined();
      expect(stored?.jobber.syncStatus).toBe("synced");
    });

    it("does not create a duplicate Client/Request when the same orderId is retried", async () => {
      const env = await makeConnectedEnv();
      const orderId = "77777777-7777-7777-7777-777777777777";
      const body = { ...validOrderBody, orderId };

      const fetchMock = mockJobberRequestOnlySuccess();
      const first = await onRequestPost({ request: makeRequest(body), env });
      const firstJson = await first.json();

      const second = await onRequestPost({ request: makeRequest(body), env });
      const secondJson = await second.json();

      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(secondJson.orderId).toBe(firstJson.orderId);
    });

    it("still returns a normal success response when Jobber isn't connected at all", async () => {
      const env = makeEnv();
      const response = await onRequestPost({
        request: makeRequest(validOrderBody),
        env: env as OrdersEnv & JobberAccessTokenEnv,
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.jobberSynced).toBe(false);
    });
  });
});

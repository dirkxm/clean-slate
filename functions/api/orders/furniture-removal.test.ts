import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./furniture-removal";
import { getFurnitureRemovalOrder } from "../../_lib/orders/storage";
import { createMockOrdersKv } from "../../_lib/orders/test-support";
import { calculateFurnitureRemovalPrice } from "../../../src/lib/pricing/furniture";
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

function mockQuoteCreateSuccess(
  fn: ReturnType<typeof vi.fn>,
  quote: { id: string; clientHubUri?: string; jobberWebUri: string; quoteStatus: string },
) {
  fn.mockResolvedValueOnce(jsonResponse({ data: { quoteCreate: { quote, userErrors: [] } } }));
  return fn;
}

function makeRequest(body: unknown): Request {
  return new Request("https://clean-slate-dsm.com/api/orders/furniture-removal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const smallOrderBody = {
  customer: validCustomer,
  items: [{ itemKey: "sofa", quantity: 1 }],
  access: "garage",
  disassembly: "none",
  heavyOversizedItemCount: 0,
  additionalLocations: 0,
  photos: [],
};

describe("POST /api/orders/furniture-removal", () => {
  it("accepts a valid, low-value submission and classifies it as an instant booking", async () => {
    const env = makeEnv();
    const response = await onRequestPost({ request: makeRequest(smallOrderBody), env });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("booking_requested");
    expect(body.requiresReview).toBe(false);
    expect(body.finalTotalCents).toBe(9900); // one sofa hits the $99 minimum
  });

  it("classifies a high-value submission as a quote request", async () => {
    const env = makeEnv();
    const body = {
      ...smallOrderBody,
      items: [{ itemKey: "sectionalLarge", quantity: 9 }], // 9 x $125 = $1,125.00
    };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("quote_requested");
    expect(json.requiresReview).toBe(true);
    expect(json.finalTotalCents).toBe(112500);
  });

  it("rejects a submission with missing customer information", async () => {
    const env = makeEnv();
    const body = { ...smallOrderBody, customer: { firstName: "Jane" } };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("invalid_customer_info");
    expect(Array.isArray(json.details)).toBe(true);
  });

  it("rejects a submission with an invalid furniture item key", async () => {
    const env = makeEnv();
    const body = { ...smallOrderBody, items: [{ itemKey: "notAnItem", quantity: 1 }] };
    const response = await onRequestPost({ request: makeRequest(body), env });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_order");
  });

  it("rejects malformed JSON", async () => {
    const env = makeEnv();
    const request = new Request("https://clean-slate-dsm.com/api/orders/furniture-removal", {
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
        { itemKey: "sofa", quantity: 1 },
        { itemKey: "dresser", quantity: 1 },
      ],
      access: "basement",
      // A client has no way to send a price at all — this proves the
      // server's response matches an independent calculation from the
      // same raw inputs, not something echoed back from the request.
    };
    const response = await onRequestPost({ request: makeRequest(body), env });
    const json = await response.json();

    const independent = calculateFurnitureRemovalPrice({
      items: [
        { itemKey: "sofa", quantity: 1 },
        { itemKey: "dresser", quantity: 1 },
      ],
      access: "basement",
      disassembly: "none",
      heavyOversizedItemCount: 0,
      additionalLocations: 0,
    });

    expect(json.finalTotalCents).toBe(independent.finalTotalCents);
    expect(json.finalTotalCents).toBe(13500);
  });

  it("preserves the complete order in storage: items, access, disassembly, heavy count, locations, photos, pricing, and customer info", async () => {
    const env = makeEnv();
    const body = {
      customer: validCustomer,
      items: [
        { itemKey: "sofa", quantity: 1 },
        { itemKey: "dresser", quantity: 1 },
      ],
      access: "basement",
      disassembly: "simple",
      heavyOversizedItemCount: 2,
      additionalLocations: 1,
      photos: [{ name: "couch.jpg" }, { name: "dresser.jpg" }],
    };

    const response = await onRequestPost({ request: makeRequest(body), env });
    const json = await response.json();
    expect(response.status).toBe(200);

    const stored = await getFurnitureRemovalOrder(env.ORDERS_KV, json.orderId);
    expect(stored).not.toBeNull();
    expect(stored?.customer).toEqual(validCustomer);
    expect(stored?.order.items).toEqual([
      { itemKey: "sofa", label: "Sofa / Couch", quantity: 1, unitPriceCents: 6500 },
      { itemKey: "dresser", label: "Dresser / Chest", quantity: 1, unitPriceCents: 4500 },
    ]);
    expect(stored?.order.access).toBe("basement");
    expect(stored?.order.disassembly).toBe("simple");
    expect(stored?.order.heavyOversizedItemCount).toBe(2);
    expect(stored?.order.additionalLocations).toBe(1);
    expect(stored?.order.photoCount).toBe(2);
    expect(stored?.order.photoFileNames).toEqual(["couch.jpg", "dresser.jpg"]);
    expect(stored?.pricing.finalTotalCents).toBe(json.finalTotalCents);
    expect(stored?.status).toBe(json.status);
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

      const stored = await getFurnitureRemovalOrder(env.ORDERS_KV, json.orderId);
      expect(stored?.jobber).toEqual({
        clientId: "client-a",
        propertyId: "jobber-property-1",
        requestId: "request-a",
        quoteId: undefined,
        quoteStatus: undefined,
        clientHubUri: undefined,
        jobberWebUri: undefined,
        syncStatus: "synced",
        lastSyncedAt: expect.any(String),
      });
    });

    it("syncs a review-required submission to a Client + Request + Quote, put AWAITING_RESPONSE", async () => {
      const env = await makeConnectedEnv();
      const fetchMock = mockJobberSyncSuccess("client-b", "request-b", "property-b");
      mockQuoteCreateSuccess(fetchMock, {
        id: "quote-b",
        clientHubUri: "https://clienthub.getjobber.com/quote-b",
        jobberWebUri: "https://secure.getjobber.com/quote-b",
        quoteStatus: "AWAITING_RESPONSE",
      });

      const body = { ...smallOrderBody, items: [{ itemKey: "sectionalLarge", quantity: 9 }] };
      const response = await onRequestPost({ request: makeRequest(body), env });
      const json = await response.json();

      expect(json.status).toBe("quote_requested");
      expect(json.jobberSynced).toBe(true);

      const stored = await getFurnitureRemovalOrder(env.ORDERS_KV, json.orderId);
      expect(stored?.jobber.requestId).toBe("request-b");
      expect(stored?.jobber.quoteId).toBe("quote-b");
      expect(stored?.jobber.quoteStatus).toBe("AWAITING_RESPONSE");
      expect(stored?.jobber.clientHubUri).toBe("https://clienthub.getjobber.com/quote-b");
      expect(stored?.jobber.jobberWebUri).toBe("https://secure.getjobber.com/quote-b");
    });

    it("does not create a duplicate Client/Request when the same orderId is retried", async () => {
      const env = await makeConnectedEnv();
      const orderId = "22222222-2222-2222-2222-222222222222";
      const body = { ...smallOrderBody, orderId };

      const fetchMock = mockJobberSyncSuccess("client-c", "request-c");
      const first = await onRequestPost({ request: makeRequest(body), env });
      const firstJson = await first.json();

      // A second, identical submission with the same orderId — fetch is
      // NOT re-armed with more responses, so any further Jobber call
      // would fail the mock; the retry must not attempt one.
      const second = await onRequestPost({ request: makeRequest(body), env });
      const secondJson = await second.json();

      expect(fetchMock).toHaveBeenCalledTimes(4); // only from the first attempt (search x2 + create x2)
      expect(secondJson.orderId).toBe(firstJson.orderId);
      expect(secondJson.jobberSynced).toBe(true);

      const stored = await getFurnitureRemovalOrder(env.ORDERS_KV, orderId);
      expect(stored?.jobber.clientId).toBe("client-c");
      expect(stored?.jobber.requestId).toBe("request-c");
    });

    it("preserves the ORDERS_KV submission and records the error when Jobber's Client creation returns userErrors", async () => {
      const env = await makeConnectedEnv();
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ data: { clients: { nodes: [] } } })) // email search: no match
        .mockResolvedValueOnce(jsonResponse({ data: { clients: { nodes: [] } } })) // phone search: no match
        .mockResolvedValueOnce(
          jsonResponse({
            data: {
              clientCreate: {
                client: null,
                userErrors: [{ message: "Email has already been taken", path: ["email"] }],
              },
            },
          }),
        );

      const response = await onRequestPost({ request: makeRequest(smallOrderBody), env });
      const json = await response.json();

      // The customer still sees a normal success response — their
      // submission was captured even though Jobber sync failed.
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.jobberSynced).toBe(false);
      expect(json.jobberSyncError).toContain("Email has already been taken");

      const stored = await getFurnitureRemovalOrder(env.ORDERS_KV, json.orderId);
      expect(stored?.jobber.syncStatus).toBe("failed");
      expect(stored?.jobber.syncError).toContain("Email has already been taken");
      expect(stored?.jobber.requestId).toBeUndefined();
      // The submission itself is fully intact regardless of sync failure.
      expect(stored?.customer).toEqual(validCustomer);
    });

    it("preserves a partial success (Client created) when Request creation fails with a GraphQL error", async () => {
      const env = await makeConnectedEnv();
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ data: { clients: { nodes: [] } } })) // email search: no match
        .mockResolvedValueOnce(jsonResponse({ data: { clients: { nodes: [] } } })) // phone search: no match
        .mockResolvedValueOnce(
          jsonResponse({
            data: {
              clientCreate: {
                client: { id: "client-d", clientProperties: { nodes: [{ id: "property-d" }] } },
                userErrors: [],
              },
            },
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ errors: [{ message: "Internal error" }] }));

      const response = await onRequestPost({ request: makeRequest(smallOrderBody), env });
      const json = await response.json();

      expect(json.jobberSynced).toBe(false);

      const stored = await getFurnitureRemovalOrder(env.ORDERS_KV, json.orderId);
      expect(stored?.jobber.clientId).toBe("client-d");
      expect(stored?.jobber.requestId).toBeUndefined();
      expect(stored?.jobber.syncStatus).toBe("failed");
    });

    it("still returns a normal success response when Jobber isn't connected at all", async () => {
      const env = makeEnv(); // no JOBBER_KV
      const response = await onRequestPost({ request: makeRequest(smallOrderBody), env: env as OrdersEnv & JobberAccessTokenEnv });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.jobberSynced).toBe(false);
    });
  });
});

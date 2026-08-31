import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApplianceQuoteTitle,
  buildApplianceRequestForm,
  buildApplianceRequestTitle,
  buildGeneralJunkRequestForm,
  buildGeneralJunkRequestTitle,
  buildJobberLineItems,
  buildJobberQuoteLineItems,
  buildQuoteTitle,
  buildRequestForm,
  buildRequestTitle,
  syncApplianceRemovalOrderToJobber,
  syncFurnitureRemovalOrderToJobber,
  syncGeneralJunkRemovalOrderToJobber,
} from "./jobber-sync";
import { createMockKv } from "../jobber/test-support";
import { putJobberConnection } from "../jobber/connection";
import type { JobberConnection } from "../jobber/types";
import type {
  ApplianceRemovalOrderRecord,
  FurnitureRemovalOrderRecord,
  GeneralJunkRemovalOrderRecord,
} from "./types";

async function makeConnectedJobberEnv() {
  const kv = createMockKv();
  const connection: JobberConnection = {
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    obtainedAt: new Date().toISOString(),
    scope: "clients:write jobs:write",
  };
  await putJobberConnection(kv, connection);
  return {
    JOBBER_CLIENT_ID: "client-123",
    JOBBER_CLIENT_SECRET: "secret-123",
    JOBBER_KV: kv,
  };
}

function baseRecord(
  overrides: Partial<FurnitureRemovalOrderRecord> = {},
): FurnitureRemovalOrderRecord {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    service: "furniture-removal",
    status: "booking_requested",
    submittedAt: new Date().toISOString(),
    customer: {
      firstName: "Jane",
      lastName: "Doe",
      phone: "(515) 202-3593",
      email: "jane@example.com",
      serviceAddress: "123 Main St",
      city: "Des Moines",
      zip: "50309",
      customerType: "residential",
    },
    order: {
      items: [{ itemKey: "sofa", label: "Sofa / Couch", quantity: 1, unitPriceCents: 6500 }],
      access: "garage",
      accessLabel: "Garage Access",
      disassembly: "none",
      disassemblyLabel: "No Disassembly",
      heavyOversizedItemCount: 0,
      additionalLocations: 0,
      photoCount: 0,
      photoFileNames: [],
    },
    pricing: {
      itemSubtotalCents: 6500,
      accessFeeCents: 0,
      disassemblyFeeCents: 0,
      heavyOversizedFeeCents: 0,
      additionalLocationFeeCents: 0,
      preMinimumTotalCents: 6500,
      minimumAdjustmentCents: 3400,
      finalTotalCents: 9900,
      requiresReview: false,
      lineItems: [
        { name: "Sofa / Couch", quantity: 1, unitPrice: 6500, total: 6500 },
        {
          name: "Furniture Removal - Minimum Service Adjustment",
          quantity: 1,
          unitPrice: 3400,
          total: 3400,
        },
      ],
    },
    jobber: { syncStatus: "pending" },
    ...overrides,
  };
}

/** A record whose pricing requires review, for exercising the Quote branch. */
function reviewRequiredRecord(
  overrides: Partial<FurnitureRemovalOrderRecord> = {},
): FurnitureRemovalOrderRecord {
  return baseRecord({
    status: "quote_requested",
    pricing: {
      itemSubtotalCents: 112500,
      accessFeeCents: 0,
      disassemblyFeeCents: 0,
      heavyOversizedFeeCents: 0,
      additionalLocationFeeCents: 0,
      preMinimumTotalCents: 112500,
      minimumAdjustmentCents: 0,
      finalTotalCents: 112500,
      requiresReview: true,
      lineItems: [{ name: "Sectional - Large", quantity: 9, unitPrice: 12500, total: 112500 }],
    },
    ...overrides,
  });
}

function applianceBaseRecord(
  overrides: Partial<ApplianceRemovalOrderRecord> = {},
): ApplianceRemovalOrderRecord {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    service: "appliance-removal",
    status: "booking_requested",
    submittedAt: new Date().toISOString(),
    customer: {
      firstName: "Jane",
      lastName: "Doe",
      phone: "(515) 202-3593",
      email: "jane@example.com",
      serviceAddress: "123 Main St",
      city: "Des Moines",
      zip: "50309",
      customerType: "residential",
    },
    order: {
      items: [{ itemKey: "washer", label: "Washer", quantity: 1, unitPriceCents: 6000 }],
      access: "garage",
      accessLabel: "Garage Access",
      disassembly: "none",
      disassemblyLabel: "No Disconnection",
      heavyOversizedItemCount: 0,
      additionalLocations: 0,
      photoCount: 0,
      photoFileNames: [],
    },
    pricing: {
      itemSubtotalCents: 6000,
      accessFeeCents: 0,
      disassemblyFeeCents: 0,
      heavyOversizedFeeCents: 0,
      refrigerantRecoveryFeeCents: 0,
      additionalLocationFeeCents: 0,
      preMinimumTotalCents: 6000,
      minimumAdjustmentCents: 3900,
      finalTotalCents: 9900,
      requiresReview: false,
      lineItems: [
        { name: "Washer", quantity: 1, unitPrice: 6000, total: 6000 },
        {
          name: "Appliance Removal - Minimum Service Adjustment",
          quantity: 1,
          unitPrice: 3900,
          total: 3900,
        },
      ],
    },
    jobber: { syncStatus: "pending" },
    ...overrides,
  };
}

/** A record whose pricing requires review, for exercising the Quote branch. */
function applianceReviewRequiredRecord(
  overrides: Partial<ApplianceRemovalOrderRecord> = {},
): ApplianceRemovalOrderRecord {
  return applianceBaseRecord({
    status: "quote_requested",
    pricing: {
      itemSubtotalCents: 95000,
      accessFeeCents: 0,
      disassemblyFeeCents: 0,
      heavyOversizedFeeCents: 0,
      refrigerantRecoveryFeeCents: 35000,
      additionalLocationFeeCents: 0,
      preMinimumTotalCents: 130000,
      minimumAdjustmentCents: 0,
      finalTotalCents: 130000,
      requiresReview: true,
      lineItems: [
        {
          name: "Refrigerator (Large / Side-by-Side)",
          quantity: 10,
          unitPrice: 9500,
          total: 95000,
        },
        { name: "Refrigerant Recovery Fee", quantity: 10, unitPrice: 3500, total: 35000 },
      ],
    },
    ...overrides,
  });
}

function generalJunkBaseRecord(
  overrides: Partial<GeneralJunkRemovalOrderRecord> = {},
): GeneralJunkRemovalOrderRecord {
  return {
    id: "55555555-5555-5555-5555-555555555555",
    service: "general-junk-removal",
    status: "booking_requested",
    submittedAt: new Date().toISOString(),
    customer: {
      firstName: "Jane",
      lastName: "Doe",
      phone: "(515) 202-3593",
      email: "jane@example.com",
      serviceAddress: "123 Main St",
      city: "Des Moines",
      zip: "50309",
      customerType: "residential",
    },
    order: {
      items: [{ itemKey: "bagLarge", label: "Large Bag of Junk", quantity: 1, unitPriceCents: 4000 }],
      access: "garage",
      accessLabel: "Garage Access",
      disassembly: "none",
      disassemblyLabel: "No Disassembly",
      heavyOversizedItemCount: 0,
      additionalLocations: 0,
      photoCount: 0,
      photoFileNames: [],
    },
    pricing: {
      itemSubtotalCents: 4000,
      accessFeeCents: 0,
      disassemblyFeeCents: 0,
      heavyOversizedFeeCents: 0,
      additionalLocationFeeCents: 0,
      preMinimumTotalCents: 4000,
      minimumAdjustmentCents: 5900,
      finalTotalCents: 9900,
      requiresReview: false,
      lineItems: [
        { name: "Large Bag of Junk", quantity: 1, unitPrice: 4000, total: 4000 },
        {
          name: "General Junk Removal - Minimum Service Adjustment",
          quantity: 1,
          unitPrice: 5900,
          total: 5900,
        },
      ],
    },
    jobber: { syncStatus: "pending" },
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "",
    json: async () => body,
    text: async () => "",
  } as Response;
}

interface MockAddress {
  street1?: string;
  street2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

/** Matches baseRecord()'s default customer service address exactly. */
const MATCHING_ADDRESS: MockAddress = {
  street1: "123 Main St",
  city: "Des Moines",
  province: "IA",
  postalCode: "50309",
  country: "US",
};

/** A different city entirely, for exercising the property-mismatch path. */
const OTHER_ADDRESS: MockAddress = {
  street1: "500 Congress Ave",
  city: "Austin",
  province: "TX",
  postalCode: "78701",
  country: "US",
};

/**
 * `propertyId` is shorthand for "one property whose address matches the
 * default customer" (baseRecord()'s address) — the common case for tests
 * that aren't specifically about address matching. Pass `properties`
 * directly to control exact addresses (matching, mismatched, or
 * multiple) for tests that are.
 */
function clientsResult(
  clients: {
    id: string;
    propertyId?: string;
    properties?: { id: string; address?: MockAddress | null }[];
  }[],
) {
  return jsonResponse({
    data: {
      clients: {
        nodes: clients.map((c) => {
          const properties =
            c.properties ?? (c.propertyId ? [{ id: c.propertyId, address: MATCHING_ADDRESS }] : []);
          return {
            id: c.id,
            clientProperties: {
              // Only default a fully-omitted address to MATCHING_ADDRESS —
              // an explicit `address: null` (a real Property with no
              // address at all) must pass through unchanged.
              nodes: properties.map((p) => ({
                id: p.id,
                address: p.address === undefined ? MATCHING_ADDRESS : p.address,
              })),
            },
          };
        }),
      },
    },
  });
}

function propertyCreateResult(id: string) {
  return jsonResponse({ data: { propertyCreate: { properties: [{ id }], userErrors: [] } } });
}

function clientCreateResult(id: string, propertyId?: string) {
  return jsonResponse({
    data: {
      clientCreate: {
        client: { id, clientProperties: { nodes: propertyId ? [{ id: propertyId }] : [] } },
        userErrors: [],
      },
    },
  });
}

function requestCreateResult(id: string) {
  return jsonResponse({ data: { requestCreate: { request: { id }, userErrors: [] } } });
}

function quoteCreateResult(quote: {
  id: string;
  clientHubUri?: string;
  jobberWebUri: string;
  quoteStatus: string;
}) {
  return jsonResponse({ data: { quoteCreate: { quote, userErrors: [] } } });
}

function mockFetchSequence(responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  global.fetch = fn;
  return fn;
}

/** Full fresh-Client-and-Request sequence: email miss, phone miss, clientCreate, requestCreate. */
function freshClientAndRequestSequence(clientId: string, propertyId: string, requestId: string) {
  return [
    clientsResult([]),
    clientsResult([]),
    clientCreateResult(clientId, propertyId),
    requestCreateResult(requestId),
  ];
}

describe("buildJobberLineItems", () => {
  it("converts integer cents to decimal dollars for unitPrice/totalPrice", () => {
    const result = buildJobberLineItems([
      { name: "Sofa / Couch", quantity: 2, unitPrice: 6500, total: 13000 },
    ]);
    expect(result).toEqual([
      {
        name: "Sofa / Couch",
        quantity: 2,
        unitPrice: 65,
        totalPrice: 130,
        saveToProductsAndServices: false,
        sortOrder: 0,
      },
    ]);
  });

  it("never sets saveToProductsAndServices to true", () => {
    const result = buildJobberLineItems([
      { name: "Anything", quantity: 1, unitPrice: 100, total: 100 },
    ]);
    expect(result[0].saveToProductsAndServices).toBe(false);
  });
});

describe("buildJobberQuoteLineItems", () => {
  it("converts integer cents to decimal dollars", () => {
    const result = buildJobberQuoteLineItems([
      { name: "Sectional - Large", quantity: 9, unitPrice: 12500, total: 112500 },
    ]);
    expect(result).toEqual([
      {
        name: "Sectional - Large",
        quantity: 9,
        unitPrice: 125,
        totalPrice: 1125,
        saveToProductsAndServices: false,
      },
    ]);
  });

  it("maps every stored pricing line item, in the same order", () => {
    const lineItems = [
      { name: "A", quantity: 1, unitPrice: 100, total: 100 },
      { name: "B", quantity: 2, unitPrice: 200, total: 400 },
      { name: "C", quantity: 3, unitPrice: 300, total: 900 },
    ];
    const result = buildJobberQuoteLineItems(lineItems);
    expect(result.map((i) => i.name)).toEqual(["A", "B", "C"]);
  });
});

describe("buildQuoteTitle", () => {
  it("clearly identifies the service and customer", () => {
    expect(buildQuoteTitle(baseRecord().customer)).toBe("Furniture Removal Quote — Jane Doe");
  });
});

describe("buildRequestTitle", () => {
  it("includes the customer's full name", () => {
    const title = buildRequestTitle(baseRecord().customer);
    expect(title).toBe("Furniture Removal — Jane Doe");
  });
});

describe("buildRequestForm", () => {
  it("preserves customer contact info, address, and classification", () => {
    const form = buildRequestForm(baseRecord());
    const customerSection = form.sections.find((s) => s.label === "Customer")!;
    const answers = Object.fromEntries(
      customerSection.items.map((item) => [item.label, item.answerText]),
    );
    expect(answers.Phone).toBe("(515) 202-3593");
    expect(answers.Email).toBe("jane@example.com");
    expect(answers["Service Address"]).toBe("123 Main St");
    expect(answers["Customer Type"]).toBe("Residential");
  });

  it("never leaks the $1,000 threshold — only a readable classification label", () => {
    const form = buildRequestForm(reviewRequiredRecord());
    const orderSection = form.sections.find((s) => s.label === "Order")!;
    const classification = orderSection.items.find((i) => i.label === "Classification");
    expect(classification?.answerText).toBe("Needs Review / Quote");
    expect(JSON.stringify(form)).not.toContain("1,000");
    expect(JSON.stringify(form)).not.toContain("1000");
  });
});

describe("syncFurnitureRemovalOrderToJobber — auto-priced path (unchanged)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("still follows Client -> Request only, with no Quote attempted", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence(freshClientAndRequestSequence("client-1", "property-1", "request-1"));

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result).toEqual({
      ok: true,
      clientId: "client-1",
      requestId: "request-1",
      propertyId: "property-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4); // email search, phone search, clientCreate, requestCreate — no quoteCreate
  });

  it("reuses an existing Client found by email — never searches phone or creates a Client", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "existing-by-email", propertyId: "property-existing" }]),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result).toEqual({
      ok: true,
      clientId: "existing-by-email",
      requestId: "request-1",
      propertyId: "property-existing",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to phone search and reuses that match when email finds nothing", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([]),
      clientsResult([{ id: "existing-by-phone", propertyId: "existing-by-phone-property" }]),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.clientId).toBe("existing-by-phone");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails for manual review when multiple Clients match by email — creates nothing", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([clientsResult([{ id: "a" }, { id: "b" }])]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Multiple Jobber Clients matched email");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails for manual review when multiple Clients match by phone — creates nothing", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([clientsResult([]), clientsResult([{ id: "a" }, { id: "b" }])]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Multiple Jobber Clients matched phone");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends the verified phone/email/property shapes when creating a new Client", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence(freshClientAndRequestSequence("client-1", "property-1", "request-1"));

    await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    const clientCreateCall = fetchMock.mock.calls[2];
    const body = JSON.parse(clientCreateCall[1].body);
    expect(body.variables.input).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      isCompany: false,
      emails: [{ address: "jane@example.com", primary: true }],
      phones: [{ number: "(515) 202-3593", primary: true }],
      properties: [
        {
          address: {
            street1: "123 Main St",
            city: "Des Moines",
            province: "IA",
            postalCode: "50309",
            country: "US",
          },
        },
      ],
    });
  });

  it("uses the found Client's ID (not a newly created one) when creating the Request", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "found-client-99", propertyId: "found-client-property" }]),
      requestCreateResult("request-1"),
    ]);

    await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    const requestCreateCall = fetchMock.mock.calls[1];
    const body = JSON.parse(requestCreateCall[1].body);
    expect(body.variables.input.clientId).toBe("found-client-99");
  });

  it("sends isCompany: false and no invented company name, regardless of customer type", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence(freshClientAndRequestSequence("client-1", "property-1", "request-1"));

    await syncFurnitureRemovalOrderToJobber(
      env,
      baseRecord({ customer: { ...baseRecord().customer, customerType: "commercial" } }),
    );

    const clientCreateBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(clientCreateBody.variables.input.isCompany).toBe(false);
    expect(clientCreateBody.variables.input.companyName).toBeUndefined();
  });

  it("skips search AND creation entirely when a clientId is already stored (idempotency)", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([requestCreateResult("request-1")]);

    const record = baseRecord({
      jobber: { clientId: "existing-client", syncStatus: "failed", syncError: "prior failure" },
    });
    const result = await syncFurnitureRemovalOrderToJobber(env, record);

    expect(result).toEqual({ ok: true, clientId: "existing-client", requestId: "request-1", propertyId: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is a no-op (does not call Jobber at all) when already fully synced", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([]);

    const record = baseRecord({
      jobber: { clientId: "client-1", requestId: "request-1", syncStatus: "synced" },
    });
    const result = await syncFurnitureRemovalOrderToJobber(env, record);

    expect(result).toEqual({
      ok: true,
      clientId: "client-1",
      requestId: "request-1",
      propertyId: undefined,
      quoteId: undefined,
      quoteStatus: undefined,
      clientHubUri: undefined,
      jobberWebUri: undefined,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces clientCreate userErrors as a failure, with no requestId", async () => {
    const env = await makeConnectedJobberEnv();
    mockFetchSequence([
      clientsResult([]),
      clientsResult([]),
      jsonResponse({
        data: {
          clientCreate: {
            client: null,
            userErrors: [{ message: "Email has already been taken", path: ["email"] }],
          },
        },
      }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Email has already been taken");
      expect(result.clientId).toBeUndefined();
    }
  });

  it("surfaces a top-level GraphQL error from requestCreate while preserving the already-created clientId", async () => {
    const env = await makeConnectedJobberEnv();
    mockFetchSequence([
      clientsResult([]),
      clientsResult([]),
      clientCreateResult("client-1", "property-1"),
      jsonResponse({ errors: [{ message: "Something went wrong" }] }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.clientId).toBe("client-1");
      expect(result.error).toContain("Something went wrong");
    }
  });

  it("recovers from a throttled Client search and creates exactly one Client — no duplicate", async () => {
    const env = await makeConnectedJobberEnv();
    // Email search is throttled once, then succeeds (empty) on retry —
    // the retry lives inside jobberGraphQL itself, transparent to this
    // orchestration, so the rest of the sequence is unaffected.
    const fetchMock = mockFetchSequence([
      jsonResponse({ errors: [{ message: "Throttled" }] }),
      clientsResult([]),
      clientsResult([]),
      clientCreateResult("client-1", "property-1"),
      requestCreateResult("request-1"),
    ]);

    vi.useFakeTimers();
    let result;
    try {
      const resultPromise = syncFurnitureRemovalOrderToJobber(env, baseRecord());
      await vi.runAllTimersAsync();
      result = await resultPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(result).toEqual({
      ok: true,
      clientId: "client-1",
      requestId: "request-1",
      propertyId: "property-1",
    });
    // 1 throttled email search + 1 retried email search + phone search +
    // clientCreate + requestCreate — exactly one Client created, never two.
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const clientCreateCalls = fetchMock.mock.calls.filter((call) =>
      JSON.parse(call[1].body).query.includes("ClientCreate"),
    );
    expect(clientCreateCalls).toHaveLength(1);
  });

  it("fails gracefully (without throwing) when Jobber isn't connected", async () => {
    const disconnectedEnv = {
      JOBBER_CLIENT_ID: "client-123",
      JOBBER_CLIENT_SECRET: "secret-123",
      JOBBER_KV: createMockKv(),
    };

    const result = await syncFurnitureRemovalOrderToJobber(disconnectedEnv, baseRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not connected");
    }
  });
});

describe("syncFurnitureRemovalOrderToJobber — property address resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses an existing property whose address matches the order's service address", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "existing-client", propertyId: "matching-property" }]),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.propertyId).toBe("matching-property");
    // email search + requestCreate only — no propertyCreate call needed.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("matches addresses ignoring case, extra whitespace, and periods", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([
        {
          id: "existing-client",
          properties: [
            {
              id: "matching-property",
              address: { street1: "123  MAIN ST.", city: " des moines ", postalCode: "50309" },
            },
          ],
        },
      ]),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.propertyId).toBe("matching-property");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("picks the correct matching property out of several on the same Client", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([
        {
          id: "existing-client",
          properties: [
            { id: "austin-property", address: OTHER_ADDRESS },
            { id: "des-moines-property", address: MATCHING_ADDRESS },
          ],
        },
      ]),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.propertyId).toBe("des-moines-property");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates a new Property when the existing Client's only property is for a different address, rather than reusing it blindly", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "existing-client", properties: [{ id: "austin-property", address: OTHER_ADDRESS }] }]),
      propertyCreateResult("norwalk-property"),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(
      env,
      baseRecord({
        customer: {
          ...baseRecord().customer,
          serviceAddress: "100 Elm St",
          city: "Norwalk",
          zip: "50211",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.propertyId).toBe("norwalk-property");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const propertyCreateCall = fetchMock.mock.calls[1];
    const body = JSON.parse(propertyCreateCall[1].body);
    expect(body.variables.clientId).toBe("existing-client");
    expect(body.variables.input).toEqual({
      properties: [
        {
          address: {
            street1: "100 Elm St",
            city: "Norwalk",
            province: "IA",
            postalCode: "50211",
            country: "US",
          },
        },
      ],
    });
  });

  it("sends the newly-resolved propertyId (never the mismatched one) on the Request", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "existing-client", properties: [{ id: "austin-property", address: OTHER_ADDRESS }] }]),
      propertyCreateResult("norwalk-property"),
      requestCreateResult("request-1"),
    ]);

    await syncFurnitureRemovalOrderToJobber(
      env,
      baseRecord({
        customer: {
          ...baseRecord().customer,
          serviceAddress: "100 Elm St",
          city: "Norwalk",
          zip: "50211",
        },
      }),
    );

    const requestCall = fetchMock.mock.calls[2];
    const body = JSON.parse(requestCall[1].body);
    expect(body.variables.input.propertyId).toBe("norwalk-property");
  });

  it("treats a property with no address (address: null) as a non-match instead of crashing", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([
        { id: "existing-client", properties: [{ id: "addressless-property", address: null }] },
      ]),
      propertyCreateResult("new-property"),
      requestCreateResult("request-1"),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, baseRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.propertyId).toBe("new-property");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("syncFurnitureRemovalOrderToJobber — review-required path (Quote)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates Client, Request, and Quote for a review-required order", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      quoteCreateResult({
        id: "quote-1",
        clientHubUri: "https://clienthub.getjobber.com/quote-1",
        jobberWebUri: "https://secure.getjobber.com/quote-1",
        quoteStatus: "AWAITING_RESPONSE",
      }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    expect(result).toEqual({
      ok: true,
      clientId: "client-1",
      requestId: "request-1",
      propertyId: "property-1",
      quoteId: "quote-1",
      quoteStatus: "AWAITING_RESPONSE",
      clientHubUri: "https://clienthub.getjobber.com/quote-1",
      jobberWebUri: "https://secure.getjobber.com/quote-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("sends all pricing line items to the Quote, converted to decimal dollars, with saveToProductsAndServices false", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    const quoteCall = fetchMock.mock.calls[4];
    const body = JSON.parse(quoteCall[1].body);
    expect(body.variables.attributes.lineItems).toEqual([
      {
        name: "Sectional - Large",
        quantity: 9,
        unitPrice: 125,
        totalPrice: 1125,
        saveToProductsAndServices: false,
      },
    ]);
  });

  it("transitions the Quote to AWAITING_RESPONSE and never invents another transition", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    const quoteCall = fetchMock.mock.calls[4];
    const body = JSON.parse(quoteCall[1].body);
    expect(body.variables.attributes.transitionQuoteTo).toBe("AWAITING_RESPONSE");
  });

  it("uses the quoteCreate `attributes` argument name, not `input`", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    const quoteCall = fetchMock.mock.calls[4];
    const query = JSON.parse(quoteCall[1].body).query;
    expect(query).toContain("quoteCreate(attributes: $attributes)");
  });

  it("never mentions the $1,000 threshold in the Quote title or message", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    const quoteCall = fetchMock.mock.calls[4];
    const attrs = JSON.parse(quoteCall[1].body).variables.attributes;
    expect(attrs.title).not.toMatch(/1,?000/);
    expect(attrs.message).not.toMatch(/1,?000/);
    expect(attrs.title).toContain("Furniture Removal Quote");
  });

  it("reuses an existing Client for the Quote path too", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "existing-client", propertyId: "existing-property" }]),
      requestCreateResult("request-1"),
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientId).toBe("existing-client");
      expect(result.propertyId).toBe("existing-property");
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("resumes at the Quote step using a stored clientId/requestId/propertyId, without recreating either", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    const record = reviewRequiredRecord({
      jobber: {
        clientId: "stored-client",
        propertyId: "stored-property",
        requestId: "stored-request",
        syncStatus: "failed",
        syncError: "quote creation failed previously",
      },
    });

    const result = await syncFurnitureRemovalOrderToJobber(env, record);

    expect(result).toEqual({
      ok: true,
      clientId: "stored-client",
      requestId: "stored-request",
      propertyId: "stored-property",
      quoteId: "quote-1",
      quoteStatus: "AWAITING_RESPONSE",
      clientHubUri: undefined,
      jobberWebUri: "https://x",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // only quoteCreate — no search, no clientCreate, no requestCreate
  });

  it("does not recreate the Quote once one already exists (fully synced no-op)", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([]);

    const record = reviewRequiredRecord({
      jobber: {
        clientId: "client-1",
        propertyId: "property-1",
        requestId: "request-1",
        quoteId: "quote-1",
        quoteStatus: "AWAITING_RESPONSE",
        jobberWebUri: "https://x",
        syncStatus: "synced",
        lastSyncedAt: new Date().toISOString(),
      },
    });

    const result = await syncFurnitureRemovalOrderToJobber(env, record);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.quoteId).toBe("quote-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with a clear, diagnosable error when propertyCreate itself fails for a Client with no matching property", async () => {
    const env = await makeConnectedJobberEnv();
    mockFetchSequence([
      // Matched by email, but its only property is for a different
      // address — no match, so a new Property is attempted and fails.
      clientsResult([
        { id: "client-no-match", properties: [{ id: "prop-elsewhere", address: OTHER_ADDRESS }] },
      ]),
      jsonResponse({
        data: {
          propertyCreate: {
            properties: [],
            userErrors: [{ message: "Address is invalid", path: ["address"] }],
          },
        },
      }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("createJobberProperty");
      expect(result.error).toContain("Address is invalid");
    }
  });

  it("surfaces quoteCreate userErrors as a failed sync, preserving Client and Request", async () => {
    const env = await makeConnectedJobberEnv();
    mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      jsonResponse({
        data: {
          quoteCreate: {
            quote: null,
            userErrors: [{ message: "lineItems can't be blank", path: ["lineItems"] }],
          },
        },
      }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("lineItems can't be blank");
      expect(result.clientId).toBe("client-1");
      expect(result.requestId).toBe("request-1");
    }
  });

  it("surfaces a top-level GraphQL error from quoteCreate as a failed sync", async () => {
    const env = await makeConnectedJobberEnv();
    mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      jsonResponse({ errors: [{ message: "Internal server error" }] }),
    ]);

    const result = await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Internal server error");
  });

  it("surfaces a network error from quoteCreate as a failed sync", async () => {
    const env = await makeConnectedJobberEnv();
    const fn = vi.fn();
    fn.mockResolvedValueOnce(clientsResult([]));
    fn.mockResolvedValueOnce(clientsResult([]));
    fn.mockResolvedValueOnce(clientCreateResult("client-1", "property-1"));
    fn.mockResolvedValueOnce(requestCreateResult("request-1"));
    fn.mockRejectedValueOnce(new Error("network down"));
    global.fetch = fn;

    const result = await syncFurnitureRemovalOrderToJobber(env, reviewRequiredRecord());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("network down");
  });
});

describe("buildApplianceRequestTitle", () => {
  it("includes the customer's full name and says Appliance Removal", () => {
    const title = buildApplianceRequestTitle(applianceBaseRecord().customer);
    expect(title).toBe("Appliance Removal — Jane Doe");
  });
});

describe("buildApplianceQuoteTitle", () => {
  it("clearly identifies the service and customer", () => {
    expect(buildApplianceQuoteTitle(applianceBaseRecord().customer)).toBe(
      "Appliance Removal Quote — Jane Doe",
    );
  });
});

describe("buildApplianceRequestForm", () => {
  it("labels the disconnection field, not 'disassembly'", () => {
    const form = buildApplianceRequestForm(applianceBaseRecord());
    const jobDetails = form.sections.find((s) => s.label === "Job Details")!;
    const disconnection = jobDetails.items.find((i) => i.label === "Disconnection");
    expect(disconnection?.answerText).toBe("No Disconnection");
  });

  it("never leaks the $1,000 threshold — only a readable classification label", () => {
    const form = buildApplianceRequestForm(applianceReviewRequiredRecord());
    const orderSection = form.sections.find((s) => s.label === "Order")!;
    const classification = orderSection.items.find((i) => i.label === "Classification");
    expect(classification?.answerText).toBe("Needs Review / Quote");
    expect(JSON.stringify(form)).not.toContain("1,000");
    expect(JSON.stringify(form)).not.toContain("1000");
  });
});

describe("syncApplianceRemovalOrderToJobber", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows Client -> Request for an auto-priced order, using appliance formatters", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence(
      freshClientAndRequestSequence("client-1", "property-1", "request-1"),
    );

    const result = await syncApplianceRemovalOrderToJobber(env, applianceBaseRecord());

    expect(result).toEqual({
      ok: true,
      clientId: "client-1",
      requestId: "request-1",
      propertyId: "property-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const requestCreateCall = fetchMock.mock.calls[3];
    const body = JSON.parse(requestCreateCall[1].body);
    expect(body.variables.input.title).toBe("Appliance Removal — Jane Doe");
  });

  it("creates Client, Request, and Quote for a review-required appliance order", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      ...freshClientAndRequestSequence("client-1", "property-1", "request-1"),
      quoteCreateResult({ id: "quote-1", jobberWebUri: "https://x", quoteStatus: "AWAITING_RESPONSE" }),
    ]);

    const result = await syncApplianceRemovalOrderToJobber(env, applianceReviewRequiredRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.quoteId).toBe("quote-1");
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const quoteCall = fetchMock.mock.calls[4];
    const body = JSON.parse(quoteCall[1].body);
    expect(body.variables.attributes.title).toBe("Appliance Removal Quote — Jane Doe");
    expect(body.variables.attributes.lineItems).toEqual([
      {
        name: "Refrigerator (Large / Side-by-Side)",
        quantity: 10,
        unitPrice: 95,
        totalPrice: 950,
        saveToProductsAndServices: false,
      },
      {
        name: "Refrigerant Recovery Fee",
        quantity: 10,
        unitPrice: 35,
        totalPrice: 350,
        saveToProductsAndServices: false,
      },
    ]);
  });

  it("is idempotent — a record already synced skips Jobber entirely", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([]);

    const record = applianceBaseRecord({
      jobber: { clientId: "client-1", requestId: "request-1", syncStatus: "synced" },
    });
    const result = await syncApplianceRemovalOrderToJobber(env, record);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.requestId).toBe("request-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses an existing Client found by email, same dedup logic as Furniture Removal", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([
      clientsResult([{ id: "existing-client", propertyId: "existing-property" }]),
      requestCreateResult("request-1"),
    ]);

    const result = await syncApplianceRemovalOrderToJobber(env, applianceBaseRecord());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.clientId).toBe("existing-client");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("buildGeneralJunkRequestForm", () => {
  it("labels the field 'Disassembly', not 'Disconnection'", () => {
    const form = buildGeneralJunkRequestForm(generalJunkBaseRecord());
    const jobDetails = form.sections.find((s) => s.label === "Job Details")!;
    const disassembly = jobDetails.items.find((i) => i.label === "Disassembly");
    expect(disassembly?.answerText).toBe("No Disassembly");
  });
});

describe("syncGeneralJunkRemovalOrderToJobber", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows Client -> Request for an auto-priced order, using general junk formatters", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence(
      freshClientAndRequestSequence("client-1", "property-1", "request-1"),
    );

    const result = await syncGeneralJunkRemovalOrderToJobber(env, generalJunkBaseRecord());

    expect(result).toEqual({
      ok: true,
      clientId: "client-1",
      requestId: "request-1",
      propertyId: "property-1",
    });

    const requestCreateCall = fetchMock.mock.calls[3];
    const body = JSON.parse(requestCreateCall[1].body);
    expect(body.variables.input.title).toBe("General Junk Removal — Jane Doe");
  });

  it("is idempotent — a record already synced skips Jobber entirely", async () => {
    const env = await makeConnectedJobberEnv();
    const fetchMock = mockFetchSequence([]);

    const record = generalJunkBaseRecord({
      jobber: { clientId: "client-1", requestId: "request-1", syncStatus: "synced" },
    });
    const result = await syncGeneralJunkRemovalOrderToJobber(env, record);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.requestId).toBe("request-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

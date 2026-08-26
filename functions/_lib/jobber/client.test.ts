import { afterEach, describe, expect, it, vi } from "vitest";
import { jobberGraphQL } from "./client";
import { JOBBER_API_VERSION, JOBBER_GRAPHQL_ENDPOINT } from "./config";

function mockFetchOnce(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  jsonBody?: unknown;
  textBody?: string;
  rejects?: boolean;
}) {
  if (options.rejects) {
    global.fetch = vi.fn().mockRejectedValue(new Error("connection reset"));
    return;
  }

  const {
    ok = true,
    status = 200,
    statusText = "OK",
    jsonBody,
    textBody = "",
  } = options;

  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    json: async () => jsonBody,
    text: async () => textBody,
  } as Response);
}

describe("jobberGraphQL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns typed data on a successful GraphQL response", async () => {
    mockFetchOnce({ jsonBody: { data: { account: { id: "123" } } } });

    const result = await jobberGraphQL<{ account: { id: string } }>({
      query: "query { account { id } }",
      accessToken: "test-token",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.account.id).toBe("123");
    }

    expect(fetch).toHaveBeenCalledWith(
      JOBBER_GRAPHQL_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "X-JOBBER-GRAPHQL-VERSION": JOBBER_API_VERSION,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("returns a structured error for top-level GraphQL errors", async () => {
    mockFetchOnce({
      jsonBody: {
        errors: [{ message: "Field 'foo' doesn't exist", path: ["query", "foo"] }],
      },
    });

    const result = await jobberGraphQL({
      query: "query { foo }",
      accessToken: "test-token",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.type === "graphql_errors") {
      expect(result.error.errors).toHaveLength(1);
      expect(result.error.errors[0].message).toContain("foo");
    } else {
      throw new Error("expected a graphql_errors result");
    }
  });

  it("returns a structured error for HTTP-level failures", async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      textBody: "server exploded",
    });

    const result = await jobberGraphQL({
      query: "query { account { id } }",
      accessToken: "test-token",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.type === "http_error") {
      expect(result.error.status).toBe(500);
      expect(result.error.body).toBe("server exploded");
    } else {
      throw new Error("expected an http_error result");
    }
  });

  it("returns a structured error when a mutation returns userErrors", async () => {
    mockFetchOnce({
      jsonBody: {
        data: {
          clientCreate: {
            client: null,
            userErrors: [{ message: "Email has already been taken", path: ["email"] }],
          },
        },
      },
    });

    const result = await jobberGraphQL({
      query: "mutation { clientCreate(input: {}) { client { id } userErrors { message path } } }",
      accessToken: "test-token",
      userErrorsPath: ["clientCreate"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.type === "user_errors") {
      expect(result.error.userErrors).toHaveLength(1);
      expect(result.error.userErrors[0].message).toContain("Email");
    } else {
      throw new Error("expected a user_errors result");
    }
  });

  it("returns a structured error when no access token is provided", async () => {
    global.fetch = vi.fn();

    const result = await jobberGraphQL({
      query: "query { account { id } }",
      accessToken: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("missing_access_token");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns success when userErrorsPath is set but no userErrors are present", async () => {
    mockFetchOnce({
      jsonBody: {
        data: {
          clientCreate: {
            client: { id: "c_1" },
            userErrors: [],
          },
        },
      },
    });

    const result = await jobberGraphQL<{ clientCreate: { client: { id: string } } }>({
      query: "mutation { clientCreate(input: {}) { client { id } userErrors { message path } } }",
      accessToken: "test-token",
      userErrorsPath: ["clientCreate"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientCreate.client.id).toBe("c_1");
    }
  });

  it("returns a network_error when fetch itself rejects", async () => {
    mockFetchOnce({ rejects: true });

    const result = await jobberGraphQL({
      query: "query { account { id } }",
      accessToken: "test-token",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("network_error");
    }
  });
});

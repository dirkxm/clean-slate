import { afterEach, describe, expect, it, vi } from "vitest";
import { jobberGraphQL } from "./client";
import {
  JOBBER_API_VERSION,
  JOBBER_GRAPHQL_ENDPOINT,
  JOBBER_THROTTLE_MAX_ATTEMPTS,
} from "./config";

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

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => "",
  } as Response;
}

/**
 * Matches the exact shape confirmed from a real Jobber throttled
 * response: `extensions.code`/`extensions.documentation` only — no
 * `throttleStatus`, `currentlyAvailable`, or `restoreRate`.
 */
function throttledResponse(): Response {
  return jsonResponse({
    errors: [
      {
        message: "Throttled",
        extensions: {
          code: "THROTTLED",
          documentation:
            "https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits",
        },
      },
    ],
  });
}

/**
 * Patches `setTimeout` to fire immediately (no real wall-clock delay)
 * while recording every requested delay in `delays`, so a test can
 * assert the exact backoff schedule without slowing down the suite.
 * Restores the original `setTimeout` when `work` settles either way.
 */
async function withCapturedDelays<T>(
  work: () => Promise<T>,
): Promise<{ result: T; delays: number[] }> {
  const delays: number[] = [];
  const original = globalThis.setTimeout;
  // @ts-expect-error deliberately narrowed for test instrumentation
  globalThis.setTimeout = (fn: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    return original(fn, 0);
  };
  try {
    const result = await work();
    return { result, delays };
  } finally {
    globalThis.setTimeout = original;
  }
}

function mockFetchSequence(responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  global.fetch = fn;
  return fn;
}

/**
 * Runs `work` with fake timers so the retry loop's backoff `setTimeout`
 * calls resolve instantly instead of adding real wall-clock delay to the
 * test run, then restores real timers afterward.
 */
async function withFakeTimers<T>(work: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const resultPromise = work();
    await vi.runAllTimersAsync();
    return await resultPromise;
  } finally {
    vi.useRealTimers();
  }
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

  it("returns a structured error for top-level GraphQL errors, without retrying", async () => {
    const fetchMock = mockFetchSequence([
      jsonResponse({
        errors: [{ message: "Field 'foo' doesn't exist", path: ["query", "foo"] }],
      }),
    ]);

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
    // A non-throttled GraphQL error is not throttling — must not retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe("throttling", () => {
    it("retries once and succeeds when Jobber throttles the first attempt", async () => {
      const fetchMock = mockFetchSequence([
        throttledResponse(),
        jsonResponse({ data: { account: { id: "123" } } }),
      ]);

      const result = await withFakeTimers(() =>
        jobberGraphQL<{ account: { id: string } }>({
          query: "query { account { id } }",
          accessToken: "test-token",
        }),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.account.id).toBe("123");
      }
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("detects throttling via extensions.code as well as message text", async () => {
      const fetchMock = mockFetchSequence([
        jsonResponse({ errors: [{ message: "Too many requests", extensions: { code: "THROTTLED" } }] }),
        jsonResponse({ data: { account: { id: "123" } } }),
      ]);

      const result = await withFakeTimers(() =>
        jobberGraphQL({ query: "query { account { id } }", accessToken: "test-token" }),
      );

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("recovers after several consecutive throttled attempts, within the retry budget", async () => {
      // Throttled on every attempt except the last one the budget allows
      // — proves the retry survives more than a single throttled attempt,
      // not just the one-retry-and-done case above.
      expect(JOBBER_THROTTLE_MAX_ATTEMPTS).toBeGreaterThan(3);
      const throttledCount = JOBBER_THROTTLE_MAX_ATTEMPTS - 1;
      const fetchMock = mockFetchSequence([
        ...Array.from({ length: throttledCount }, () => throttledResponse()),
        jsonResponse({ data: { account: { id: "123" } } }),
      ]);

      const result = await withFakeTimers(() =>
        jobberGraphQL<{ account: { id: string } }>({
          query: "query { account { id } }",
          accessToken: "test-token",
        }),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.account.id).toBe("123");
      }
      expect(fetchMock).toHaveBeenCalledTimes(JOBBER_THROTTLE_MAX_ATTEMPTS);
    });

    it("gives up after a bounded number of attempts and returns the throttled error, never retrying indefinitely", async () => {
      const fetchMock = mockFetchSequence([
        ...Array.from({ length: JOBBER_THROTTLE_MAX_ATTEMPTS }, () => throttledResponse()),
        // If the retry were unbounded, this would be consumed too —
        // it deliberately never runs.
        jsonResponse({ data: { account: { id: "should-not-be-reached" } } }),
      ]);

      const result = await withFakeTimers(() =>
        jobberGraphQL({ query: "query { account { id } }", accessToken: "test-token" }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok && result.error.type === "graphql_errors") {
        expect(result.error.errors[0].message).toBe("Throttled");
      } else {
        throw new Error("expected a graphql_errors result");
      }
      // Exactly the hard cap — not one more, proving it's bounded rather
      // than merely "happened to stop here".
      expect(fetchMock).toHaveBeenCalledTimes(JOBBER_THROTTLE_MAX_ATTEMPTS);
    });

    it("waits with the exact exponential backoff schedule between throttled retries", async () => {
      mockFetchSequence([
        ...Array.from({ length: JOBBER_THROTTLE_MAX_ATTEMPTS }, () => throttledResponse()),
      ]);

      const { delays } = await withCapturedDelays(() =>
        jobberGraphQL({ query: "query { account { id } }", accessToken: "test-token" }),
      );

      // One fewer wait than attempts — no wait follows the final attempt.
      expect(delays).toEqual([500, 1000, 2000, 4000]);
      expect(delays).toHaveLength(JOBBER_THROTTLE_MAX_ATTEMPTS - 1);
    });

    it("does not retry a non-throttled GraphQL error even once", async () => {
      const fetchMock = mockFetchSequence([
        jsonResponse({ errors: [{ message: "Something else went wrong" }] }),
      ]);

      const result = await jobberGraphQL({
        query: "query { account { id } }",
        accessToken: "test-token",
      });

      expect(result.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry HTTP-level failures", async () => {
      const fetchMock = mockFetchSequence([
        {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: async () => ({}),
          text: async () => "server exploded",
        } as Response,
      ]);

      const result = await jobberGraphQL({
        query: "query { account { id } }",
        accessToken: "test-token",
      });

      expect(result.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry a mutation's userErrors", async () => {
      const fetchMock = mockFetchSequence([
        jsonResponse({
          data: {
            clientCreate: {
              client: null,
              userErrors: [{ message: "Email has already been taken", path: ["email"] }],
            },
          },
        }),
      ]);

      const result = await jobberGraphQL({
        query: "mutation { clientCreate(input: {}) { client { id } userErrors { message path } } }",
        accessToken: "test-token",
        userErrorsPath: ["clientCreate"],
      });

      expect(result.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
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

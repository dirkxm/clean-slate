import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshJobberConnection, refreshJobberToken } from "./refresh";
import { putJobberConnection } from "./connection";
import { createMockKv } from "./test-support";
import type { JobberConnection } from "./types";

function mockFetchOnceSequence(
  responses: Array<{
    ok?: boolean;
    status?: number;
    statusText?: string;
    jsonBody?: unknown;
    textBody?: string;
  }>,
) {
  const fn = vi.fn();
  for (const r of responses) {
    const { ok = true, status = 200, statusText = "OK", jsonBody, textBody = "" } = r;
    fn.mockResolvedValueOnce({
      ok,
      status,
      statusText,
      json: async () => jsonBody,
      text: async () => textBody,
    } as Response);
  }
  global.fetch = fn;
  return fn;
}

const baseConnection: JobberConnection = {
  accessToken: "old-access",
  refreshToken: "old-refresh",
  expiresAt: new Date(Date.now() - 1000).toISOString(),
  obtainedAt: new Date(Date.now() - 3600_000).toISOString(),
  scope: "clients:write jobs:write",
};

describe("refreshJobberToken (pure)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges a refresh token for a new token pair", async () => {
    mockFetchOnceSequence([
      {
        jsonBody: {
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
          scope: "clients:write",
        },
      },
    ]);

    const result = await refreshJobberToken({
      clientId: "client-1",
      clientSecret: "secret-1",
      refreshToken: "old-refresh",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.accessToken).toBe("new-access");
      expect(result.data.refreshToken).toBe("new-refresh");
    }
  });

  it("returns a structured error when Jobber rejects the refresh token", async () => {
    mockFetchOnceSequence([{ ok: false, status: 401, statusText: "Unauthorized", textBody: "invalid_grant" }]);

    const result = await refreshJobberToken({
      clientId: "client-1",
      clientSecret: "secret-1",
      refreshToken: "stale-refresh",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("http_error");
    }
  });
});

describe("refreshJobberConnection (KV-orchestrated)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails cleanly when there is no stored connection", async () => {
    const kv = createMockKv();

    const result = await refreshJobberConnection({
      JOBBER_CLIENT_ID: "client-1",
      JOBBER_CLIENT_SECRET: "secret-1",
      JOBBER_KV: kv,
    });

    expect(result.ok).toBe(false);
  });

  it("refreshes the connection and stores the rotated refresh token", async () => {
    const kv = createMockKv();
    await putJobberConnection(kv, baseConnection);

    mockFetchOnceSequence([
      {
        jsonBody: {
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
          scope: "clients:write jobs:write",
        },
      },
    ]);

    const result = await refreshJobberConnection({
      JOBBER_CLIENT_ID: "client-1",
      JOBBER_CLIENT_SECRET: "secret-1",
      JOBBER_KV: kv,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.accessToken).toBe("rotated-access");
      expect(result.data.refreshToken).toBe("rotated-refresh");
    }

    // The rotated refresh token — not the old one — must be what's persisted.
    const stored = await kv.get("jobber:connection");
    expect(stored).toContain("rotated-refresh");
    expect(stored).not.toContain("old-refresh");
  });

  it("detects an already-expired connection as needing refresh (via isConnectionExpiredOrNearExpiry)", async () => {
    const { isConnectionExpiredOrNearExpiry } = await import("./connection");
    expect(isConnectionExpiredOrNearExpiry(baseConnection)).toBe(true);
  });

  it("uses a concurrently-refreshed connection instead of failing, when its own refresh attempt hits an auth error", async () => {
    const kv = createMockKv();
    await putJobberConnection(kv, baseConnection);

    // Simulate: this call's refresh attempt fails (401 — the refresh
    // token was already rotated by a concurrent request)...
    mockFetchOnceSequence([{ ok: false, status: 401, statusText: "Unauthorized", textBody: "invalid_grant" }]);

    // ...but between the failed exchange and the mitigation's re-read,
    // a "concurrent" request has already written a newer connection.
    const concurrentlyWritten: JobberConnection = {
      accessToken: "concurrent-access",
      refreshToken: "concurrent-refresh",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      obtainedAt: new Date().toISOString(),
      scope: baseConnection.scope,
    };

    const originalGet = kv.get;
    let callCount = 0;
    kv.get = vi.fn(async (key: string) => {
      callCount += 1;
      if (key === "jobber:connection" && callCount > 1) {
        return JSON.stringify(concurrentlyWritten);
      }
      return originalGet(key);
    });

    const result = await refreshJobberConnection({
      JOBBER_CLIENT_ID: "client-1",
      JOBBER_CLIENT_SECRET: "secret-1",
      JOBBER_KV: kv,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refreshToken).toBe("concurrent-refresh");
    }
  });

  it("fails when the refresh attempt errors and no newer connection appears on re-read", async () => {
    const kv = createMockKv();
    await putJobberConnection(kv, baseConnection);

    mockFetchOnceSequence([{ ok: false, status: 401, statusText: "Unauthorized", textBody: "invalid_grant" }]);

    const result = await refreshJobberConnection({
      JOBBER_CLIENT_ID: "client-1",
      JOBBER_CLIENT_SECRET: "secret-1",
      JOBBER_KV: kv,
    });

    expect(result.ok).toBe(false);
  });
});

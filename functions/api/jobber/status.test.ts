import { describe, expect, it } from "vitest";
import { onRequestGet } from "./status";
import { putJobberConnection } from "../../_lib/jobber/connection";
import { createMockKv } from "../../_lib/jobber/test-support";
import type { JobberConnection, JobberEnv } from "../../_lib/jobber/types";

function makeEnv(overrides: Partial<JobberEnv> = {}): JobberEnv {
  return {
    JOBBER_CLIENT_ID: "client-123",
    JOBBER_CLIENT_SECRET: "secret-123",
    JOBBER_REDIRECT_URI: "https://clean-slate-dsm.com/api/jobber/oauth/callback",
    JOBBER_KV: createMockKv(),
    ...overrides,
  };
}

describe("GET /api/jobber/status", () => {
  it("reports not connected when no connection is stored", async () => {
    const env = makeEnv();

    const response = await onRequestGet({ env });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ connected: false });
  });

  it("reports connected with only the safe fields when a connection exists", async () => {
    const env = makeEnv();
    const connection: JobberConnection = {
      accessToken: "super-secret-access-token",
      refreshToken: "super-secret-refresh-token",
      expiresAt: "2026-08-26T05:00:00.000Z",
      obtainedAt: "2026-08-26T04:00:00.000Z",
      scope: "clients:write jobs:write",
    };
    await putJobberConnection(env.JOBBER_KV, connection);

    const response = await onRequestGet({ env });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      connected: true,
      expiresAt: "2026-08-26T05:00:00.000Z",
      scope: "clients:write jobs:write",
    });
  });

  it("never returns accessToken, refreshToken, clientId, or clientSecret", async () => {
    const env = makeEnv();
    await putJobberConnection(env.JOBBER_KV, {
      accessToken: "super-secret-access-token",
      refreshToken: "super-secret-refresh-token",
      expiresAt: "2026-08-26T05:00:00.000Z",
      obtainedAt: "2026-08-26T04:00:00.000Z",
      scope: "clients:write",
    });

    const response = await onRequestGet({ env });
    const text = await response.text();

    expect(text).not.toContain("super-secret-access-token");
    expect(text).not.toContain("super-secret-refresh-token");
    expect(text).not.toContain("client-123");
    expect(text).not.toContain("secret-123");
  });
});

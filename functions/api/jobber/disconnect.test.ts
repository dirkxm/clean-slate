import { describe, expect, it } from "vitest";
import { onRequestPost } from "./disconnect";
import { getJobberConnection, putJobberConnection } from "../../_lib/jobber/connection";
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

const connection: JobberConnection = {
  accessToken: "access-abc",
  refreshToken: "refresh-abc",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  obtainedAt: new Date().toISOString(),
  scope: "clients:write",
};

describe("POST /api/jobber/disconnect", () => {
  it("deletes the stored connection", async () => {
    const env = makeEnv();
    await putJobberConnection(env.JOBBER_KV, connection);

    const response = await onRequestPost({ env });

    expect(response.status).toBe(200);
    expect(await getJobberConnection(env.JOBBER_KV)).toBeNull();
  });

  it("returns a safe success response with no credentials", async () => {
    const env = makeEnv();
    await putJobberConnection(env.JOBBER_KV, connection);

    const response = await onRequestPost({ env });
    const text = await response.text();
    const body = JSON.parse(text);

    expect(body).toEqual({ success: true });
    expect(text).not.toContain("access-abc");
    expect(text).not.toContain("refresh-abc");
    expect(text).not.toContain("secret-123");
  });

  it("succeeds even when nothing was connected", async () => {
    const env = makeEnv();
    const response = await onRequestPost({ env });
    expect(response.status).toBe(200);
  });
});

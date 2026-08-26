import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "./callback";
import { storeOAuthState } from "../../../_lib/jobber/oauth";
import { createMockKv } from "../../../_lib/jobber/test-support";
import type { JobberEnv } from "../../../_lib/jobber/types";

function makeEnv(overrides: Partial<JobberEnv> = {}): JobberEnv {
  return {
    JOBBER_CLIENT_ID: "client-123",
    JOBBER_CLIENT_SECRET: "secret-123",
    JOBBER_REDIRECT_URI: "https://clean-slate-dsm.com/api/jobber/oauth/callback",
    JOBBER_KV: createMockKv(),
    ...overrides,
  };
}

function mockTokenExchangeResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  jsonBody?: unknown;
  textBody?: string;
}) {
  const { ok = true, status = 200, statusText = "OK", jsonBody, textBody = "" } = options;
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    json: async () => jsonBody,
    text: async () => textBody,
  } as Response);
}

describe("GET /api/jobber/oauth/callback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a request with a Jobber authorization error", async () => {
    const env = makeEnv();
    const request = new Request(
      "https://clean-slate-dsm.com/api/jobber/oauth/callback?error=access_denied",
    );

    const response = await onRequestGet({ request, env });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("jobber_authorization_error");
  });

  it("rejects a request missing state or code", async () => {
    const env = makeEnv();
    const request = new Request("https://clean-slate-dsm.com/api/jobber/oauth/callback");

    const response = await onRequestGet({ request, env });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
  });

  it("rejects an invalid or expired state (never stored)", async () => {
    const env = makeEnv();
    const request = new Request(
      "https://clean-slate-dsm.com/api/jobber/oauth/callback?state=unknown-state&code=abc123",
    );

    const response = await onRequestGet({ request, env });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_state");
  });

  it("rejects a state value that has already been consumed (replay)", async () => {
    const env = makeEnv();
    await storeOAuthState(env.JOBBER_KV, "state-1", "verifier-1");
    // Consume it once via a request that otherwise fails at exchange —
    // doesn't matter, state is deleted regardless of exchange outcome.
    mockTokenExchangeResponse({ ok: false, status: 400, textBody: "invalid_grant" });
    await onRequestGet({
      request: new Request(
        "https://clean-slate-dsm.com/api/jobber/oauth/callback?state=state-1&code=abc123",
      ),
      env,
    });

    // Second attempt with the same (now-consumed) state must fail.
    const replay = await onRequestGet({
      request: new Request(
        "https://clean-slate-dsm.com/api/jobber/oauth/callback?state=state-1&code=abc123",
      ),
      env,
    });

    expect(replay.status).toBe(400);
    const body = await replay.json();
    expect(body.error).toBe("invalid_state");
  });

  it("returns a structured error when token exchange fails", async () => {
    const env = makeEnv();
    await storeOAuthState(env.JOBBER_KV, "state-1", "verifier-1");
    mockTokenExchangeResponse({ ok: false, status: 400, textBody: "invalid_grant" });

    const response = await onRequestGet({
      request: new Request(
        "https://clean-slate-dsm.com/api/jobber/oauth/callback?state=state-1&code=abc123",
      ),
      env,
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("token_exchange_failed");
  });

  it("completes a successful callback: stores the connection and redirects to the success page", async () => {
    const env = makeEnv();
    await storeOAuthState(env.JOBBER_KV, "state-1", "verifier-1");
    mockTokenExchangeResponse({
      jsonBody: {
        access_token: "access-abc",
        refresh_token: "refresh-abc",
        expires_in: 3600,
        scope: "clients:write jobs:write",
      },
    });

    const response = await onRequestGet({
      request: new Request(
        "https://clean-slate-dsm.com/api/jobber/oauth/callback?state=state-1&code=abc123",
      ),
      env,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/jobber-connected");

    const stored = await env.JOBBER_KV.get("jobber:connection");
    expect(stored).toContain("access-abc");
    expect(stored).toContain("refresh-abc");
  });

  it("never includes the access token, refresh token, or client secret in any response body", async () => {
    const env = makeEnv();
    await storeOAuthState(env.JOBBER_KV, "state-1", "verifier-1");
    mockTokenExchangeResponse({ ok: false, status: 500, textBody: "server exploded, refresh_token=refresh-abc" });

    const response = await onRequestGet({
      request: new Request(
        "https://clean-slate-dsm.com/api/jobber/oauth/callback?state=state-1&code=abc123",
      ),
      env,
    });

    const text = await response.text();
    expect(text).not.toContain("secret-123");
    expect(text).not.toContain("refresh-abc");
  });
});

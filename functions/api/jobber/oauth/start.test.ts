import { describe, expect, it } from "vitest";
import { onRequestGet } from "./start";
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

describe("GET /api/jobber/oauth/start", () => {
  it("redirects to Jobber's authorization URL and stores OAuth state in KV", async () => {
    const env = makeEnv();
    const request = new Request("https://clean-slate-dsm.com/api/jobber/oauth/start");

    const response = await onRequestGet({ request, env });

    expect(response.status).toBe(302);
    const location = response.headers.get("Location")!;
    expect(location).toContain("https://api.getjobber.com/api/oauth/authorize");
    expect(location).toContain("client_id=client-123");
    expect(location).toContain("code_challenge_method=S256");

    // A state value from the redirect must exist as a stored KV record.
    const stateValue = new URL(location).searchParams.get("state")!;
    expect(stateValue).toBeTruthy();
    const stored = await env.JOBBER_KV.get(`jobber:oauth-state:${stateValue}`);
    expect(stored).not.toBeNull();
  });

  it("never leaks the client secret into the redirect URL", async () => {
    const env = makeEnv();
    const request = new Request("https://clean-slate-dsm.com/api/jobber/oauth/start");

    const response = await onRequestGet({ request, env });
    const location = response.headers.get("Location")!;

    expect(location).not.toContain("secret-123");
  });

  it("returns a 500 when Jobber OAuth is not configured", async () => {
    const env = makeEnv({ JOBBER_CLIENT_ID: "" });
    const request = new Request("https://clean-slate-dsm.com/api/jobber/oauth/start");

    const response = await onRequestGet({ request, env });
    expect(response.status).toBe(500);
  });
});

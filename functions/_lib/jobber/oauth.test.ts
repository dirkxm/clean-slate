import { describe, expect, it } from "vitest";
import {
  buildJobberAuthorizationUrl,
  consumeOAuthState,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  storeOAuthState,
} from "./oauth";
import { JOBBER_AUTHORIZE_ENDPOINT } from "./config";
import { createMockKv } from "./test-support";

describe("buildJobberAuthorizationUrl", () => {
  it("builds a correct Jobber authorization URL with all required parameters", () => {
    const url = new URL(
      buildJobberAuthorizationUrl({
        clientId: "client-123",
        redirectUri: "https://clean-slate-dsm.com/api/jobber/oauth/callback",
        state: "state-abc",
        codeChallenge: "challenge-xyz",
        scopes: ["clients:write", "jobs:write"],
      }),
    );

    expect(url.origin + url.pathname).toBe(JOBBER_AUTHORIZE_ENDPOINT);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://clean-slate-dsm.com/api/jobber/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-xyz");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("clients:write jobs:write");
  });

  it("always targets Jobber's own fixed authorize endpoint, never a caller-supplied host", () => {
    const url = new URL(
      buildJobberAuthorizationUrl({
        clientId: "client-123",
        redirectUri: "https://evil.example.com/steal",
        state: "state-abc",
        codeChallenge: "challenge-xyz",
        scopes: [],
      }),
    );

    expect(url.hostname).toBe("api.getjobber.com");
  });
});

describe("generateOAuthState / generateCodeVerifier", () => {
  it("generates sufficiently long, URL-safe random values", () => {
    const state = generateOAuthState();
    const verifier = generateCodeVerifier();

    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(verifier.length).toBeGreaterThanOrEqual(32);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never generates the same value twice", () => {
    const values = new Set(Array.from({ length: 20 }, () => generateOAuthState()));
    expect(values.size).toBe(20);
  });
});

describe("generateCodeChallenge", () => {
  it("derives a deterministic, URL-safe S256 challenge from a verifier", async () => {
    const challengeA = await generateCodeChallenge("fixed-verifier-value");
    const challengeB = await generateCodeChallenge("fixed-verifier-value");
    const challengeC = await generateCodeChallenge("a-different-verifier");

    expect(challengeA).toBe(challengeB);
    expect(challengeA).not.toBe(challengeC);
    expect(challengeA).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("storeOAuthState / consumeOAuthState", () => {
  it("stores and consumes a state record exactly once", async () => {
    const kv = createMockKv();

    await storeOAuthState(kv, "state-1", "verifier-1");

    const first = await consumeOAuthState(kv, "state-1");
    expect(first).toEqual(
      expect.objectContaining({ codeVerifier: "verifier-1" }),
    );

    const second = await consumeOAuthState(kv, "state-1");
    expect(second).toBeNull();
  });

  it("returns null for a state that was never stored (missing/expired/unknown, indistinguishably)", async () => {
    const kv = createMockKv();
    const result = await consumeOAuthState(kv, "never-existed");
    expect(result).toBeNull();
  });
});

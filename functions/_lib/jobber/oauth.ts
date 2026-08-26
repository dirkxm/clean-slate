import {
  JOBBER_AUTHORIZE_ENDPOINT,
  JOBBER_OAUTH_STATE_TTL_SECONDS,
} from "./config";
import type { JobberKVNamespace, JobberOAuthState } from "./types";

const STATE_KEY_PREFIX = "jobber:oauth-state:";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A cryptographically random, URL-safe OAuth `state` value. */
export function generateOAuthState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

/** A cryptographically random PKCE code verifier (RFC 7636 compliant). */
export function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

/** Derives the PKCE `code_challenge` (S256) from a code verifier. */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export interface BuildAuthorizationUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: string[];
}

/** Builds Jobber's OAuth authorization URL. The target is always Jobber's own fixed endpoint — never user-controlled — so this cannot be used as an open redirect. */
export function buildJobberAuthorizationUrl(
  options: BuildAuthorizationUrlOptions,
): string {
  const url = new URL(JOBBER_AUTHORIZE_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", options.scopes.join(" "));
  return url.toString();
}

/** Stores the PKCE verifier for a state value, short-lived via KV's native TTL. */
export async function storeOAuthState(
  kv: JobberKVNamespace,
  state: string,
  codeVerifier: string,
): Promise<void> {
  const record: JobberOAuthState = {
    codeVerifier,
    createdAt: new Date().toISOString(),
  };

  await kv.put(`${STATE_KEY_PREFIX}${state}`, JSON.stringify(record), {
    expirationTtl: JOBBER_OAUTH_STATE_TTL_SECONDS,
  });
}

/**
 * Reads a state record and immediately deletes it, so a state value can
 * never be consumed twice (anti-replay). Returns `null` for a state that
 * is missing, already used, or has expired — deliberately indistinguishable
 * from the caller's perspective, so as not to leak which case occurred.
 */
export async function consumeOAuthState(
  kv: JobberKVNamespace,
  state: string,
): Promise<JobberOAuthState | null> {
  const key = `${STATE_KEY_PREFIX}${state}`;
  const raw = await kv.get(key);
  if (!raw) return null;

  await kv.delete(key);

  try {
    return JSON.parse(raw) as JobberOAuthState;
  } catch {
    return null;
  }
}

/**
 * Minimal shape of a Cloudflare KV namespace binding — just the methods
 * this project actually uses. Hand-rolled instead of depending on
 * `@cloudflare/workers-types` to keep the dependency footprint at zero;
 * the real binding Cloudflare injects at runtime satisfies this shape.
 */
export interface JobberKVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare Pages Function environment bindings this project depends on.
 * Values come from the Cloudflare Pages project's environment
 * variables/secrets/bindings at request time (`context.env`) — never
 * hard-coded. Access and refresh tokens are NOT env vars: they live in
 * `JOBBER_KV` because they change at runtime (hourly expiry, rotation on
 * every refresh) and a Function cannot rewrite its own bound env vars.
 */
export interface JobberEnv {
  JOBBER_CLIENT_ID: string;
  JOBBER_CLIENT_SECRET: string;
  JOBBER_REDIRECT_URI: string;
  JOBBER_KV: JobberKVNamespace;
}

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

/** A single entry in a GraphQL response's top-level `errors` array. */
export interface GraphQLError {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

/** A single entry in a Jobber mutation payload's `userErrors` array. */
export interface JobberUserError {
  message: string;
  path?: string[];
}

/** Every way a Jobber API call can fail, as a discriminated union. */
export type JobberClientError =
  | { type: "missing_access_token" }
  | { type: "network_error"; message: string }
  | { type: "http_error"; status: number; statusText: string; body: string }
  | { type: "invalid_response"; message: string }
  | { type: "graphql_errors"; errors: GraphQLError[] }
  | { type: "user_errors"; userErrors: JobberUserError[] };

export type JobberResult<T, E = JobberClientError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export interface JobberTokenRefreshData {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export type JobberTokenRefreshResult = JobberResult<JobberTokenRefreshData>;

/**
 * The persistent Jobber connection record stored in KV under
 * `jobber:connection`. Deliberately minimal — only what's needed to
 * authenticate future API calls and report connection status.
 */
export interface JobberConnection {
  accessToken: string;
  refreshToken: string;
  /** ISO 8601 timestamp of when the access token expires. */
  expiresAt: string;
  /** ISO 8601 timestamp of when this token pair was obtained. */
  obtainedAt: string;
  scope: string;
}

/**
 * Ephemeral record stored in KV under `jobber:oauth-state:<state>` for
 * the lifetime of a single in-progress authorization request.
 */
export interface JobberOAuthState {
  codeVerifier: string;
  createdAt: string;
}

/** The safe subset of connection info exposed by GET /api/jobber/status. */
export interface JobberConnectionStatus {
  connected: boolean;
  expiresAt?: string;
  scope?: string;
}

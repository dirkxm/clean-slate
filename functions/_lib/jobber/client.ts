import {
  JOBBER_API_VERSION,
  JOBBER_GRAPHQL_ENDPOINT,
  JOBBER_THROTTLE_MAX_ATTEMPTS,
  JOBBER_THROTTLE_RETRY_BASE_DELAY_MS,
} from "./config";
import type { GraphQLError, JobberResult, JobberUserError } from "./types";

export interface JobberGraphQLOptions {
  query: string;
  variables?: Record<string, unknown>;
  /** The caller's current Jobber access token. */
  accessToken: string | undefined | null;
  /**
   * Path to the mutation payload field that carries `userErrors`, e.g.
   * `["clientCreate"]` for a `clientCreate` mutation. Omit for queries
   * or mutations with no `userErrors` field to check.
   */
  userErrorsPath?: string[];
}

interface RawGraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * True when a top-level GraphQL error list represents Jobber rejecting
 * the request for being throttled (cost/rate limited), as opposed to any
 * other kind of GraphQL error. Detection is necessarily heuristic — the
 * only confirmed data point is a real throttled response whose error
 * message contained "Throttled" — so this matches that text case-
 * insensitively. It also checks the conventional `extensions.code ===
 * "THROTTLED"` shape used by other cost-based GraphQL APIs, in case
 * Jobber's follows the same convention, but that half is unverified.
 */
function isThrottledGraphQLError(errors: GraphQLError[]): boolean {
  return errors.some((error) => {
    const code = error.extensions?.code;
    if (typeof code === "string" && code.toUpperCase() === "THROTTLED") {
      return true;
    }
    return /throttl/i.test(error.message);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a single GraphQL request to Jobber's API and normalizes every
 * failure mode — network failure, HTTP-level failure, top-level GraphQL
 * `errors`, and mutation-level `userErrors` — into one structured result.
 * Never throws.
 *
 * Retries a bounded number of times, with backoff, but ONLY when the
 * response is specifically a throttled rejection (see
 * `isThrottledGraphQLError`) — never for any other error. Jobber's
 * cost-based throttling rejects a request before it executes (the
 * response carries no `data`), so retrying the identical request is safe
 * and cannot create a duplicate Client/Property/Request/Quote — nothing
 * was created by the throttled attempt in the first place. All other
 * error types (network, HTTP, non-throttled GraphQL errors, userErrors)
 * are returned immediately, unretried, exactly as before.
 */
export async function jobberGraphQL<T = unknown>(
  options: JobberGraphQLOptions,
): Promise<JobberResult<T>> {
  if (!options.accessToken) {
    return { ok: false, error: { type: "missing_access_token" } };
  }

  let result: JobberResult<T>;
  for (let attempt = 1; attempt <= JOBBER_THROTTLE_MAX_ATTEMPTS; attempt++) {
    result = await sendJobberGraphQLOnce<T>(options);

    if (result.ok) return result;

    const throttled =
      result.error.type === "graphql_errors" &&
      isThrottledGraphQLError(result.error.errors);
    const attemptsRemain = attempt < JOBBER_THROTTLE_MAX_ATTEMPTS;

    if (!throttled || !attemptsRemain) {
      return result;
    }

    await sleep(JOBBER_THROTTLE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  }

  // Unreachable (the loop always returns), but keeps TypeScript satisfied
  // that every path returns a value.
  return result!;
}

async function sendJobberGraphQLOnce<T>(
  options: JobberGraphQLOptions,
): Promise<JobberResult<T>> {
  const { query, variables, accessToken, userErrorsPath } = options;

  let response: Response;
  try {
    response = await fetch(JOBBER_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-JOBBER-GRAPHQL-VERSION": JOBBER_API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        type: "network_error",
        message: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        type: "http_error",
        status: response.status,
        statusText: response.statusText,
        body: await safeReadText(response),
      },
    };
  }

  let payload: RawGraphQLResponse<T>;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: {
        type: "invalid_response",
        message: "Jobber response body was not valid JSON.",
      },
    };
  }

  if (payload.errors && payload.errors.length > 0) {
    return { ok: false, error: { type: "graphql_errors", errors: payload.errors } };
  }

  if (!payload.data) {
    return {
      ok: false,
      error: {
        type: "invalid_response",
        message: "Jobber response contained neither data nor errors.",
      },
    };
  }

  if (userErrorsPath && userErrorsPath.length > 0) {
    const userErrors = readUserErrors(payload.data, userErrorsPath);
    if (userErrors && userErrors.length > 0) {
      return { ok: false, error: { type: "user_errors", userErrors } };
    }
  }

  return { ok: true, data: payload.data };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function readUserErrors(
  data: unknown,
  path: string[],
): JobberUserError[] | undefined {
  let node: unknown = data;
  for (const key of path) {
    if (typeof node !== "object" || node === null || !(key in node)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
  }

  if (
    typeof node === "object" &&
    node !== null &&
    "userErrors" in node &&
    Array.isArray((node as Record<string, unknown>).userErrors)
  ) {
    return (node as Record<string, unknown>).userErrors as JobberUserError[];
  }

  return undefined;
}

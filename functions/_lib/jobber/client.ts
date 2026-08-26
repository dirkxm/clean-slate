import { JOBBER_API_VERSION, JOBBER_GRAPHQL_ENDPOINT } from "./config";
import type { GraphQLError, JobberGraphQLResult, JobberUserError } from "./types";

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
 * Sends a single GraphQL request to Jobber's API and normalizes every
 * failure mode — network failure, HTTP-level failure, top-level GraphQL
 * `errors`, and mutation-level `userErrors` — into one structured result.
 * Never throws.
 */
export async function jobberGraphQL<T = unknown>(
  options: JobberGraphQLOptions,
): Promise<JobberGraphQLResult<T>> {
  const { query, variables, accessToken, userErrorsPath } = options;

  if (!accessToken) {
    return { ok: false, error: { type: "missing_access_token" } };
  }

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

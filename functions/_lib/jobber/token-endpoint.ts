import { JOBBER_OAUTH_TOKEN_ENDPOINT } from "./config";
import type { JobberResult, JobberTokenRefreshData } from "./types";

interface JobberTokenResponseBody {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Low-level POST to Jobber's OAuth token endpoint. Shared by the
 * authorization-code exchange and the refresh-token exchange — those two
 * grants only differ in which parameters are sent in `body`. Never
 * throws, never logs `body` or the response (both can carry secrets).
 */
export async function postToJobberTokenEndpoint(
  body: Record<string, string>,
): Promise<JobberResult<JobberTokenRefreshData>> {
  let response: Response;
  try {
    response = await fetch(JOBBER_OAUTH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  let payload: JobberTokenResponseBody;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: {
        type: "invalid_response",
        message: "Jobber token response body was not valid JSON.",
      },
    };
  }

  if (!payload.access_token || !payload.refresh_token) {
    return {
      ok: false,
      error: {
        type: "invalid_response",
        message: "Jobber token response was missing access_token or refresh_token.",
      },
    };
  }

  return {
    ok: true,
    data: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
      tokenType: payload.token_type,
      scope: payload.scope,
    },
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

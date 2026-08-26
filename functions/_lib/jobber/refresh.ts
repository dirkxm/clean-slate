import { postToJobberTokenEndpoint } from "./token-endpoint";
import {
  computeExpiresAt,
  getJobberConnection,
  putJobberConnection,
} from "./connection";
import type {
  JobberClientError,
  JobberConnection,
  JobberKVNamespace,
  JobberResult,
  JobberTokenRefreshData,
} from "./types";

export interface RefreshJobberTokenOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Exchanges a refresh token for a new Jobber access token. Pure — takes
 * explicit credentials, makes one HTTP call, returns a structured result.
 * Jobber rotates refresh tokens on every use — callers must persist the
 * returned `refreshToken`, not just the `accessToken`.
 */
export async function refreshJobberToken(
  options: RefreshJobberTokenOptions,
): Promise<JobberResult<JobberTokenRefreshData>> {
  const { clientId, clientSecret, refreshToken } = options;

  return postToJobberTokenEndpoint({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export interface RefreshJobberConnectionEnv {
  JOBBER_CLIENT_ID: string;
  JOBBER_CLIENT_SECRET: string;
  JOBBER_KV: JobberKVNamespace;
}

/**
 * Orchestrates a full connection refresh: reads the stored connection
 * from KV, exchanges its refresh token for a new pair, and overwrites KV
 * with the result (new access token, rotated refresh token, new
 * expiration). Unconditional — callers decide *when* to refresh (see
 * `isConnectionExpiredOrNearExpiry`); this function just does it.
 *
 * Concurrent-refresh mitigation: Jobber's refresh tokens are single-use,
 * so two requests refreshing at once would have one fail. If the
 * exchange fails with an auth-shaped error, this re-reads KV once — if
 * the stored refresh token has since changed, another request already
 * refreshed it, so that newer connection is returned instead of failing.
 * This is a best-effort mitigation, not a lock — deliberately, since a
 * single low-volume connection doesn't justify Durable Objects-grade
 * coordination.
 */
export async function refreshJobberConnection(
  env: RefreshJobberConnectionEnv,
): Promise<JobberResult<JobberConnection>> {
  const { JOBBER_KV: kv } = env;

  const current = await getJobberConnection(kv);
  if (!current) {
    return {
      ok: false,
      error: {
        type: "invalid_response",
        message: "No Jobber connection is stored.",
      },
    };
  }

  const exchanged = await refreshJobberToken({
    clientId: env.JOBBER_CLIENT_ID,
    clientSecret: env.JOBBER_CLIENT_SECRET,
    refreshToken: current.refreshToken,
  });

  if (!exchanged.ok) {
    if (isAuthError(exchanged.error)) {
      const latest = await getJobberConnection(kv);
      if (latest && latest.refreshToken !== current.refreshToken) {
        return { ok: true, data: latest };
      }
    }
    return exchanged;
  }

  const updated: JobberConnection = {
    accessToken: exchanged.data.accessToken,
    refreshToken: exchanged.data.refreshToken,
    expiresAt: computeExpiresAt(exchanged.data.expiresIn),
    obtainedAt: new Date().toISOString(),
    scope: exchanged.data.scope ?? current.scope,
  };

  await putJobberConnection(kv, updated);

  return { ok: true, data: updated };
}

function isAuthError(error: JobberClientError): boolean {
  return error.type === "http_error" && (error.status === 400 || error.status === 401);
}

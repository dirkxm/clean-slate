import { getJobberConnection, isConnectionExpiredOrNearExpiry } from "./connection";
import { refreshJobberConnection } from "./refresh";
import type { JobberKVNamespace, JobberResult } from "./types";

export interface JobberAccessTokenEnv {
  JOBBER_CLIENT_ID: string;
  JOBBER_CLIENT_SECRET: string;
  JOBBER_KV: JobberKVNamespace;
}

export type JobberAccessTokenError =
  | { type: "not_connected" }
  | { type: "refresh_failed"; message: string };

/**
 * Returns a valid (non-expired) Jobber access token, transparently
 * refreshing it first if it's within the expiry safety window. This is
 * the one place API-calling code should get a token from — it never
 * hands back a token it knows is stale.
 */
export async function getValidJobberAccessToken(
  env: JobberAccessTokenEnv,
): Promise<JobberResult<string, JobberAccessTokenError>> {
  const connection = await getJobberConnection(env.JOBBER_KV);
  if (!connection) {
    return { ok: false, error: { type: "not_connected" } };
  }

  if (!isConnectionExpiredOrNearExpiry(connection)) {
    return { ok: true, data: connection.accessToken };
  }

  const refreshed = await refreshJobberConnection(env);
  if (!refreshed.ok) {
    const message =
      refreshed.error.type === "http_error"
        ? `${refreshed.error.status} ${refreshed.error.body}`
        : refreshed.error.type === "network_error"
          ? refreshed.error.message
          : refreshed.error.type;
    return { ok: false, error: { type: "refresh_failed", message } };
  }

  return { ok: true, data: refreshed.data.accessToken };
}

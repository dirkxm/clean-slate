import { getJobberConnection } from "../../_lib/jobber/connection";
import type { JobberConnectionStatus, JobberEnv } from "../../_lib/jobber/types";

interface RequestContext {
  env: JobberEnv;
}

/**
 * GET /api/jobber/status
 *
 * Reports whether Jobber is connected. Deliberately hand-picks only the
 * two safe fields to return — never spreads the stored connection object,
 * so accessToken/refreshToken/clientId/clientSecret can never leak here
 * even if the connection record's shape changes later.
 */
export async function onRequestGet(context: RequestContext): Promise<Response> {
  const { env } = context;

  if (!env.JOBBER_KV) {
    return json({ connected: false }, 200);
  }

  const connection = await getJobberConnection(env.JOBBER_KV);

  if (!connection) {
    const body: JobberConnectionStatus = { connected: false };
    return json(body, 200);
  }

  const body: JobberConnectionStatus = {
    connected: true,
    expiresAt: connection.expiresAt,
    scope: connection.scope,
  };
  return json(body, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

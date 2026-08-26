import { deleteJobberConnection } from "../../_lib/jobber/connection";
import type { JobberEnv } from "../../_lib/jobber/types";

interface RequestContext {
  env: JobberEnv;
}

/**
 * POST /api/jobber/disconnect
 *
 * Deletes the stored Jobber connection. Note: this endpoint has no
 * authentication/authorization check of its own — there is no admin
 * auth system anywhere in this project yet. Anyone who can reach this
 * URL can disconnect Jobber. That's an acceptable gap for this
 * foundation step but should be closed (e.g. an admin auth check or a
 * shared secret header) before this is exposed in a way the public can
 * discover.
 */
export async function onRequestPost(context: RequestContext): Promise<Response> {
  const { env } = context;

  if (!env.JOBBER_KV) {
    return json(500, { success: false });
  }

  await deleteJobberConnection(env.JOBBER_KV);

  return json(200, { success: true });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

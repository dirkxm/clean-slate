import {
  buildJobberAuthorizationUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  storeOAuthState,
} from "../../../_lib/jobber/oauth";
import { JOBBER_REQUESTED_SCOPES } from "../../../_lib/jobber/config";
import type { JobberEnv } from "../../../_lib/jobber/types";

interface RequestContext {
  request: Request;
  env: JobberEnv;
}

/**
 * GET /api/jobber/oauth/start
 *
 * Kicks off the Jobber OAuth flow: generates a random `state` and a PKCE
 * verifier, stores them briefly in KV, and redirects the browser to
 * Jobber's own authorization screen. Nothing sensitive is ever put in
 * this response — the redirect target is Jobber's fixed endpoint, never
 * something derived from the incoming request.
 */
export async function onRequestGet(context: RequestContext): Promise<Response> {
  const { env } = context;

  if (!env.JOBBER_KV) {
    return jsonError(500, "server_misconfigured", "Jobber storage is not configured.");
  }

  if (!env.JOBBER_CLIENT_ID || !env.JOBBER_REDIRECT_URI) {
    return jsonError(500, "server_misconfigured", "Jobber OAuth is not fully configured.");
  }

  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  await storeOAuthState(env.JOBBER_KV, state, codeVerifier);

  const authorizationUrl = buildJobberAuthorizationUrl({
    clientId: env.JOBBER_CLIENT_ID,
    redirectUri: env.JOBBER_REDIRECT_URI,
    state,
    codeChallenge,
    scopes: JOBBER_REQUESTED_SCOPES,
  });

  return Response.redirect(authorizationUrl, 302);
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

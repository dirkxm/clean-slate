import { consumeOAuthState } from "../../../_lib/jobber/oauth";
import { exchangeAuthorizationCode } from "../../../_lib/jobber/exchange";
import { computeExpiresAt, putJobberConnection } from "../../../_lib/jobber/connection";
import type { JobberConnection, JobberEnv } from "../../../_lib/jobber/types";

interface RequestContext {
  request: Request;
  env: JobberEnv;
}

const SUCCESS_PATH = "/jobber-connected";

/**
 * GET /api/jobber/oauth/callback
 *
 * Validates the OAuth state, exchanges the authorization code server-side,
 * and stores the resulting connection in KV. Never puts an access token,
 * refresh token, or client secret in a response body, a redirect URL, or
 * an error message.
 */
export async function onRequestGet(context: RequestContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const authorizationError = url.searchParams.get("error");
  if (authorizationError) {
    return jsonError(
      400,
      "jobber_authorization_error",
      "Jobber declined or could not complete authorization.",
    );
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state || !code) {
    return jsonError(400, "invalid_request", "Missing state or authorization code.");
  }

  if (!env.JOBBER_KV) {
    return jsonError(500, "server_misconfigured", "Jobber storage is not configured.");
  }

  // Reading this also deletes it — a state value can never be replayed.
  const stateRecord = await consumeOAuthState(env.JOBBER_KV, state);
  if (!stateRecord) {
    return jsonError(
      400,
      "invalid_state",
      "This authorization request is invalid or has expired. Please try connecting again.",
    );
  }

  if (!env.JOBBER_CLIENT_ID || !env.JOBBER_CLIENT_SECRET || !env.JOBBER_REDIRECT_URI) {
    return jsonError(500, "server_misconfigured", "Jobber OAuth is not fully configured.");
  }

  const exchanged = await exchangeAuthorizationCode({
    clientId: env.JOBBER_CLIENT_ID,
    clientSecret: env.JOBBER_CLIENT_SECRET,
    redirectUri: env.JOBBER_REDIRECT_URI,
    code,
    codeVerifier: stateRecord.codeVerifier,
  });

  if (!exchanged.ok) {
    return jsonError(
      502,
      "token_exchange_failed",
      "Failed to complete the Jobber connection. Please try again.",
    );
  }

  const connection: JobberConnection = {
    accessToken: exchanged.data.accessToken,
    refreshToken: exchanged.data.refreshToken,
    expiresAt: computeExpiresAt(exchanged.data.expiresIn),
    obtainedAt: new Date().toISOString(),
    scope: exchanged.data.scope ?? "",
  };

  await putJobberConnection(env.JOBBER_KV, connection);

  return Response.redirect(new URL(SUCCESS_PATH, request.url).toString(), 302);
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

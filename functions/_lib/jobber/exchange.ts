import { postToJobberTokenEndpoint } from "./token-endpoint";
import type { JobberResult, JobberTokenRefreshData } from "./types";

export interface ExchangeAuthorizationCodeOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}

/** Exchanges an OAuth authorization code (+ PKCE verifier) for Jobber's first access/refresh token pair. */
export async function exchangeAuthorizationCode(
  options: ExchangeAuthorizationCodeOptions,
): Promise<JobberResult<JobberTokenRefreshData>> {
  const { clientId, clientSecret, redirectUri, code, codeVerifier } = options;

  return postToJobberTokenEndpoint({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
}

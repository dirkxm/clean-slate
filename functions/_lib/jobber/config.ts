/**
 * Centralized Jobber API configuration.
 *
 * The API version is defined once here — nothing else in the Jobber
 * client should hard-code a version string. See
 * https://developer.getjobber.com/docs/using_jobbers_api/api_versioning/
 * for the list of currently active versions.
 */
export const JOBBER_API_VERSION = "2025-04-16";

export const JOBBER_GRAPHQL_ENDPOINT = "https://api.getjobber.com/api/graphql";

export const JOBBER_OAUTH_TOKEN_ENDPOINT =
  "https://api.getjobber.com/api/oauth/token";

export const JOBBER_AUTHORIZE_ENDPOINT =
  "https://api.getjobber.com/api/oauth/authorize";

/**
 * How long an OAuth `state`/PKCE record is allowed to live in KV before
 * it's considered expired. Ten minutes is generous for a user to complete
 * Jobber's consent screen while still keeping the window short-lived.
 */
export const JOBBER_OAUTH_STATE_TTL_SECONDS = 600;

/**
 * How long before actual expiration we treat an access token as "expired"
 * and proactively refresh it, rather than waiting for a request to fail.
 */
export const JOBBER_TOKEN_EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;

import { JOBBER_TOKEN_EXPIRY_SAFETY_WINDOW_MS } from "./config";
import type { JobberConnection, JobberKVNamespace } from "./types";

const CONNECTION_KEY = "jobber:connection";

/** Reads the stored Jobber connection, or `null` if never connected. */
export async function getJobberConnection(
  kv: JobberKVNamespace,
): Promise<JobberConnection | null> {
  const raw = await kv.get(CONNECTION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as JobberConnection;
  } catch {
    return null;
  }
}

/** Overwrites the stored Jobber connection with a new token pair. */
export async function putJobberConnection(
  kv: JobberKVNamespace,
  connection: JobberConnection,
): Promise<void> {
  await kv.put(CONNECTION_KEY, JSON.stringify(connection));
}

/** Removes the stored Jobber connection entirely (disconnect). */
export async function deleteJobberConnection(
  kv: JobberKVNamespace,
): Promise<void> {
  await kv.delete(CONNECTION_KEY);
}

/**
 * True once a connection is within the safety window of expiring (or
 * already expired) — callers should refresh rather than use it as-is.
 */
export function isConnectionExpiredOrNearExpiry(
  connection: JobberConnection,
  now: Date = new Date(),
): boolean {
  const expiresAt = new Date(connection.expiresAt).getTime();
  return expiresAt - now.getTime() <= JOBBER_TOKEN_EXPIRY_SAFETY_WINDOW_MS;
}

/** Converts an OAuth `expires_in` (seconds from now) into an ISO timestamp. */
export function computeExpiresAt(expiresInSeconds: number | undefined): string {
  const seconds = expiresInSeconds ?? 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

import { vi } from "vitest";
import type { JobberKVNamespace } from "./types";

/**
 * An in-memory stand-in for a Cloudflare KV namespace, for tests only.
 * Ignores `expirationTtl` (tests simulate "expired" by simply not
 * seeding the key, since KV itself makes expired and never-existed keys
 * indistinguishable via `get`).
 */
export function createMockKv(
  initial: Record<string, string> = {},
): JobberKVNamespace {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

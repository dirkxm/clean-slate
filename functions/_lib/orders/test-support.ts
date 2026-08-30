import { vi } from "vitest";
import type { OrdersKVNamespace } from "./types";

/** An in-memory stand-in for a Cloudflare KV namespace, for tests only. */
export function createMockOrdersKv(
  initial: Record<string, string> = {},
): OrdersKVNamespace {
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

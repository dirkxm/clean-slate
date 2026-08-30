import type { FurnitureRemovalOrderRecord, OrdersKVNamespace } from "./types";

/**
 * Key prefix for furniture removal order/quote submissions in ORDERS_KV.
 * Deliberately its own namespace, distinct from anything Jobber-related
 * (which lives under `jobber:*` in a different KV binding entirely).
 */
const FURNITURE_REMOVAL_ORDER_KEY_PREFIX = "furniture-removal-order:";

export function furnitureRemovalOrderKey(id: string): string {
  return `${FURNITURE_REMOVAL_ORDER_KEY_PREFIX}${id}`;
}

export async function saveFurnitureRemovalOrder(
  kv: OrdersKVNamespace,
  record: FurnitureRemovalOrderRecord,
): Promise<void> {
  await kv.put(furnitureRemovalOrderKey(record.id), JSON.stringify(record));
}

export async function getFurnitureRemovalOrder(
  kv: OrdersKVNamespace,
  id: string,
): Promise<FurnitureRemovalOrderRecord | null> {
  const raw = await kv.get(furnitureRemovalOrderKey(id));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as FurnitureRemovalOrderRecord;
  } catch {
    return null;
  }
}

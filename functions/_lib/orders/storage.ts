import type {
  ApplianceRemovalOrderRecord,
  FurnitureRemovalOrderRecord,
  GeneralJunkRemovalOrderRecord,
  OrdersKVNamespace,
} from "./types";

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

/** Same pattern as Furniture Removal's, in its own KV namespace. */
const APPLIANCE_REMOVAL_ORDER_KEY_PREFIX = "appliance-removal-order:";

export function applianceRemovalOrderKey(id: string): string {
  return `${APPLIANCE_REMOVAL_ORDER_KEY_PREFIX}${id}`;
}

export async function saveApplianceRemovalOrder(
  kv: OrdersKVNamespace,
  record: ApplianceRemovalOrderRecord,
): Promise<void> {
  await kv.put(applianceRemovalOrderKey(record.id), JSON.stringify(record));
}

export async function getApplianceRemovalOrder(
  kv: OrdersKVNamespace,
  id: string,
): Promise<ApplianceRemovalOrderRecord | null> {
  const raw = await kv.get(applianceRemovalOrderKey(id));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ApplianceRemovalOrderRecord;
  } catch {
    return null;
  }
}

/** Same pattern as Furniture Removal's, in its own KV namespace. */
const GENERAL_JUNK_REMOVAL_ORDER_KEY_PREFIX = "general-junk-removal-order:";

export function generalJunkRemovalOrderKey(id: string): string {
  return `${GENERAL_JUNK_REMOVAL_ORDER_KEY_PREFIX}${id}`;
}

export async function saveGeneralJunkRemovalOrder(
  kv: OrdersKVNamespace,
  record: GeneralJunkRemovalOrderRecord,
): Promise<void> {
  await kv.put(generalJunkRemovalOrderKey(record.id), JSON.stringify(record));
}

export async function getGeneralJunkRemovalOrder(
  kv: OrdersKVNamespace,
  id: string,
): Promise<GeneralJunkRemovalOrderRecord | null> {
  const raw = await kv.get(generalJunkRemovalOrderKey(id));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GeneralJunkRemovalOrderRecord;
  } catch {
    return null;
  }
}

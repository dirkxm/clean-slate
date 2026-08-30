export { validateCustomerInfo } from "./validate";
export type { CustomerValidationResult, FieldValidationError } from "./validate";

export {
  furnitureRemovalOrderKey,
  saveFurnitureRemovalOrder,
  getFurnitureRemovalOrder,
} from "./storage";

export type {
  CustomerInfo,
  CustomerType,
  FurnitureRemovalOrderRecord,
  FurnitureRemovalOrderRequestBody,
  OrderStatus,
  OrdersEnv,
  OrdersKVNamespace,
} from "./types";

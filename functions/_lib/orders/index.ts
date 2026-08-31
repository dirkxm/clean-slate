export { validateCustomerInfo } from "./validate";
export type { CustomerValidationResult, FieldValidationError } from "./validate";

export {
  furnitureRemovalOrderKey,
  saveFurnitureRemovalOrder,
  getFurnitureRemovalOrder,
  applianceRemovalOrderKey,
  saveApplianceRemovalOrder,
  getApplianceRemovalOrder,
  generalJunkRemovalOrderKey,
  saveGeneralJunkRemovalOrder,
  getGeneralJunkRemovalOrder,
} from "./storage";

export type {
  ApplianceRemovalOrderRecord,
  CustomerInfo,
  CustomerType,
  FurnitureRemovalOrderRecord,
  FurnitureRemovalOrderRequestBody,
  GeneralJunkRemovalOrderRecord,
  OrderLineItem,
  OrderStatus,
  OrdersEnv,
  OrdersKVNamespace,
  RemovalOrderRequestBody,
} from "./types";

/**
 * Job-modifier concepts shared across every removal-style service
 * (furniture, appliances, and future ones). Furniture Removal predates
 * this module and keeps its own copies of these — deliberately left
 * untouched to avoid any risk to its working pricing — but every new
 * service should import from here instead of redefining them.
 */

export type AccessType =
  | "garage"
  | "outsideCurb"
  | "firstFloor"
  | "basement"
  | "upstairs"
  | "multipleFloorsDifficult";

/**
 * "Disassembly" for furniture, "disconnection" (gas/water/electrical)
 * for appliances — same three-tier difficulty concept and fee amounts,
 * just different customer-facing wording per service.
 */
export type DisassemblyType = "none" | "simple" | "difficult";

/**
 * A single structured line item suitable for handing to Jobber later.
 * `unitPrice` and `total` are integer cents, not dollars.
 */
export interface JobberLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

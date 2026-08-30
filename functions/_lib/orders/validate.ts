import type { CustomerInfo, CustomerType } from "./types";

export interface FieldValidationError {
  field: string;
  message: string;
}

export type CustomerValidationResult =
  | { ok: true; data: CustomerInfo }
  | { ok: false; errors: FieldValidationError[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * Validates a customer-information payload server-side. Never trusts
 * that a client-side form already validated it — this is the
 * authoritative check.
 */
export function validateCustomerInfo(input: unknown): CustomerValidationResult {
  const errors: FieldValidationError[] = [];

  if (!input || typeof input !== "object") {
    return {
      ok: false,
      errors: [{ field: "customer", message: "Customer information is required." }],
    };
  }

  const raw = input as Record<string, unknown>;

  if (!isNonEmptyString(raw.firstName, 100)) {
    errors.push({ field: "firstName", message: "First name is required." });
  }
  if (!isNonEmptyString(raw.lastName, 100)) {
    errors.push({ field: "lastName", message: "Last name is required." });
  }
  if (!isNonEmptyString(raw.phone, 30) || countDigits(raw.phone as string) < 7) {
    errors.push({ field: "phone", message: "A valid phone number is required." });
  }
  if (
    !isNonEmptyString(raw.email, 200) ||
    !EMAIL_PATTERN.test((raw.email as string).trim())
  ) {
    errors.push({ field: "email", message: "A valid email address is required." });
  }
  if (!isNonEmptyString(raw.serviceAddress, 200)) {
    errors.push({ field: "serviceAddress", message: "Service address is required." });
  }
  if (!isNonEmptyString(raw.city, 100)) {
    errors.push({ field: "city", message: "City is required." });
  }
  if (
    !isNonEmptyString(raw.zip, 10) ||
    !ZIP_PATTERN.test((raw.zip as string).trim())
  ) {
    errors.push({ field: "zip", message: "A valid ZIP code is required." });
  }
  if (raw.customerType !== "residential" && raw.customerType !== "commercial") {
    errors.push({
      field: "customerType",
      message: "Please specify residential or commercial.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      firstName: (raw.firstName as string).trim(),
      lastName: (raw.lastName as string).trim(),
      phone: (raw.phone as string).trim(),
      email: (raw.email as string).trim(),
      serviceAddress: (raw.serviceAddress as string).trim(),
      city: (raw.city as string).trim(),
      zip: (raw.zip as string).trim(),
      customerType: raw.customerType as CustomerType,
    },
  };
}

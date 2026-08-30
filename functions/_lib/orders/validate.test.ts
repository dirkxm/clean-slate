import { describe, expect, it } from "vitest";
import { validateCustomerInfo } from "./validate";

const validCustomer = {
  firstName: "Jane",
  lastName: "Doe",
  phone: "(515) 202-3593",
  email: "jane@example.com",
  serviceAddress: "123 Main St",
  city: "Des Moines",
  zip: "50309",
  customerType: "residential",
};

describe("validateCustomerInfo", () => {
  it("accepts a fully valid submission", () => {
    const result = validateCustomerInfo(validCustomer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(validCustomer);
    }
  });

  it("trims whitespace from string fields", () => {
    const result = validateCustomerInfo({
      ...validCustomer,
      firstName: "  Jane  ",
      city: "  Des Moines  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstName).toBe("Jane");
      expect(result.data.city).toBe("Des Moines");
    }
  });

  it("accepts a commercial customer type", () => {
    const result = validateCustomerInfo({ ...validCustomer, customerType: "commercial" });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object payload", () => {
    const result = validateCustomerInfo("not an object");
    expect(result.ok).toBe(false);
  });

  it("rejects missing required fields, reporting each one", () => {
    const result = validateCustomerInfo({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.errors.map((e) => e.field).sort();
      expect(fields).toEqual(
        [
          "city",
          "customerType",
          "email",
          "firstName",
          "lastName",
          "phone",
          "serviceAddress",
          "zip",
        ].sort(),
      );
    }
  });

  it("rejects an invalid email format", () => {
    const result = validateCustomerInfo({ ...validCustomer, email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    }
  });

  it("rejects a phone number with too few digits", () => {
    const result = validateCustomerInfo({ ...validCustomer, phone: "12" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "phone")).toBe(true);
    }
  });

  it("rejects an invalid ZIP code", () => {
    const result = validateCustomerInfo({ ...validCustomer, zip: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "zip")).toBe(true);
    }
  });

  it("accepts a ZIP+4 code", () => {
    const result = validateCustomerInfo({ ...validCustomer, zip: "50309-1234" });
    expect(result.ok).toBe(true);
  });

  it("rejects a customerType outside residential/commercial", () => {
    const result = validateCustomerInfo({ ...validCustomer, customerType: "government" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "customerType")).toBe(true);
    }
  });

  it("rejects a whitespace-only field as missing", () => {
    const result = validateCustomerInfo({ ...validCustomer, firstName: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "firstName")).toBe(true);
    }
  });
});

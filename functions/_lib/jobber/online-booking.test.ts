import { describe, expect, it } from "vitest";
import { getOnlineBookingUrl } from "./online-booking";

describe("getOnlineBookingUrl", () => {
  it("returns null when the variable is unset or blank", () => {
    expect(getOnlineBookingUrl({})).toBeNull();
    expect(getOnlineBookingUrl({ JOBBER_ONLINE_BOOKING_URL: "" })).toBeNull();
    expect(getOnlineBookingUrl({ JOBBER_ONLINE_BOOKING_URL: "   " })).toBeNull();
  });

  it("accepts a clienthub.getjobber.com online-booking URL", () => {
    const url = "https://clienthub.getjobber.com/online-booking/abc-123";
    expect(getOnlineBookingUrl({ JOBBER_ONLINE_BOOKING_URL: url })).toBe(`${url}`);
  });

  it("accepts an account-slug getjobber.com subdomain", () => {
    const url = "https://clean-slate.getjobber.com/book";
    expect(getOnlineBookingUrl({ JOBBER_ONLINE_BOOKING_URL: url })).toBe(`${url}`);
  });

  it("trims surrounding whitespace", () => {
    expect(
      getOnlineBookingUrl({
        JOBBER_ONLINE_BOOKING_URL: "  https://clienthub.getjobber.com/x  ",
      }),
    ).toBe("https://clienthub.getjobber.com/x");
  });

  it("rejects non-https URLs", () => {
    expect(
      getOnlineBookingUrl({
        JOBBER_ONLINE_BOOKING_URL: "http://clienthub.getjobber.com/x",
      }),
    ).toBeNull();
  });

  it("rejects hosts that are not getjobber.com", () => {
    expect(
      getOnlineBookingUrl({ JOBBER_ONLINE_BOOKING_URL: "https://evil.example.com/x" }),
    ).toBeNull();
    expect(
      getOnlineBookingUrl({
        JOBBER_ONLINE_BOOKING_URL: "https://getjobber.com.evil.example/x",
      }),
    ).toBeNull();
  });

  it("rejects a value that isn't a URL at all", () => {
    expect(
      getOnlineBookingUrl({ JOBBER_ONLINE_BOOKING_URL: "not a url" }),
    ).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderStaffAlertText, sendStaffAlert, type StaffAlert } from "./staff-alert";

const alert: StaffAlert = {
  title: "New online booking — Furniture Removal",
  fields: [
    { label: "Customer", value: "Jane Doe" },
    { label: "Calculated total", value: "$340.00" },
  ],
  action: "Next: send the deposit request.",
  link: "https://secure.getjobber.com/work_requests/1",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("renderStaffAlertText", () => {
  it("renders the title, fields, link and action", () => {
    const text = renderStaffAlertText(alert);
    expect(text).toContain("New online booking — Furniture Removal");
    expect(text).toContain("• Customer: Jane Doe");
    expect(text).toContain("• Calculated total: $340.00");
    expect(text).toContain("https://secure.getjobber.com/work_requests/1");
    expect(text).toContain("Next: send the deposit request.");
  });
});

describe("sendStaffAlert", () => {
  it("is a successful no-op when no webhook is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendStaffAlert({}, alert);

    expect(result).toEqual({ ok: true, delivered: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a Slack payload to the configured webhook and reports delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendStaffAlert(
      { STAFF_ALERT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X" },
      alert,
    );

    expect(result).toEqual({ ok: true, delivered: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/services/T/B/X");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.text).toContain("New online booking");
    expect(Array.isArray(body.blocks)).toBe(true);
  });

  it("returns an error (never throws) on a non-2xx from Slack", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("no_service", { status: 404 })),
    );

    const result = await sendStaffAlert(
      { STAFF_ALERT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X" },
      alert,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("404");
  });

  it("returns an error (never throws) on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection reset")));

    const result = await sendStaffAlert(
      { STAFF_ALERT_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X" },
      alert,
    );

    expect(result).toEqual({ ok: false, error: "connection reset" });
  });
});

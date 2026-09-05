/**
 * Best-effort staff notifications.
 *
 * Introduced for the Stage 1 online-booking rollout (Pickup Scheduler
 * Build Plan, Phase A / step 6): during the interim, an online booking
 * produces two Jobber records — our detailed Request and, after the
 * customer picks a time, Jobber's own Job from the hosted booking form.
 * Staff need a nudge to reconcile the two and send the deposit request.
 * The same primitive is reused by Phase 5 (sync-failure / booking-
 * recovery alerting).
 *
 * Channel: a Slack Incoming Webhook. The webhook URL is held as the
 * `STAFF_ALERT_SLACK_WEBHOOK_URL` Pages secret. When it is unset, every
 * send is a successful no-op (`delivered: false`) — alerting is additive
 * and must never be a hard dependency of an order succeeding.
 *
 * `sendStaffAlert` never throws.
 */

export interface StaffAlertEnv {
  /**
   * Slack Incoming Webhook URL. Absent in environments where staff
   * alerting isn't configured yet — sends become no-ops.
   */
  STAFF_ALERT_SLACK_WEBHOOK_URL?: string;
}

export interface StaffAlertField {
  label: string;
  value: string;
}

export interface StaffAlert {
  /** One-line headline, e.g. "New online booking — Furniture Removal". */
  title: string;
  /** Label/value rows rendered under the headline. */
  fields: StaffAlertField[];
  /** Optional call-to-action line rendered last, e.g. what staff should do next. */
  action?: string;
  /** Optional link (Jobber Request/Quote web URL) rendered as context. */
  link?: string;
}

export type StaffAlertResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: string };

/** Plain-text rendering of an alert — the Slack `text` fallback and the unit-test surface. */
export function renderStaffAlertText(alert: StaffAlert): string {
  const lines = [alert.title, ""];
  for (const field of alert.fields) {
    lines.push(`• ${field.label}: ${field.value}`);
  }
  if (alert.link) {
    lines.push("", alert.link);
  }
  if (alert.action) {
    lines.push("", alert.action);
  }
  return lines.join("\n");
}

function buildSlackPayload(alert: StaffAlert): unknown {
  const contextLines = alert.fields.map((f) => `*${f.label}:* ${f.value}`);
  const blocks: unknown[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${alert.title}*` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: contextLines.join("\n") },
    },
  ];
  if (alert.link) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `<${alert.link}|Open in Jobber>` },
    });
  }
  if (alert.action) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: alert.action }],
    });
  }
  return { text: renderStaffAlertText(alert), blocks };
}

/**
 * Delivers a staff alert to Slack. Returns `{ ok: true, delivered: false }`
 * when no channel is configured, `{ ok: true, delivered: true }` on a 2xx
 * from Slack, and `{ ok: false, error }` on any network/HTTP failure —
 * but never throws, so a caller can safely `void` it or ignore the
 * result entirely.
 */
export async function sendStaffAlert(
  env: StaffAlertEnv,
  alert: StaffAlert,
): Promise<StaffAlertResult> {
  const webhookUrl = env.STAFF_ALERT_SLACK_WEBHOOK_URL;
  if (typeof webhookUrl !== "string" || webhookUrl.trim().length === 0) {
    return { ok: true, delivered: false };
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackPayload(alert)),
    });
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      // ignore — the status alone is enough to report the failure
    }
    return {
      ok: false,
      error: `Slack webhook returned HTTP ${response.status}${body ? `: ${body}` : ""}`,
    };
  }

  return { ok: true, delivered: true };
}

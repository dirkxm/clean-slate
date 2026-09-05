/**
 * Stage 1 (interim) online-booking hand-off.
 *
 * The online-ordering wizard collects the full order and its calculated
 * price, then hands the customer to Jobber's hosted Online Booking form
 * to pick an actual pickup time (Jobber computes real availability from
 * team hours, the live calendar, drive time, buffers and lead time —
 * none of which we model yet). See the "Pickup Scheduler Build Plan",
 * Phase A.
 *
 * The booking form's public URL is a single, stable, per-account value.
 * Rather than query Jobber's `onlineBookingConfiguration` on every order
 * (an extra API call, and a field not yet introspected against the
 * connected schema), Stage 1 reads it from a Cloudflare Pages
 * environment variable. `getOnlineBookingUrl` is the one place that
 * source is resolved, so Stage 2 can swap it for the live query without
 * touching any handler or the front end.
 */

export interface OnlineBookingEnv {
  /**
   * The public URL of the Jobber Online Booking form for this account
   * (e.g. `https://clienthub.getjobber.com/online-booking/<uuid>` or a
   * `https://<slug>.getjobber.com/...` link). Set as a plain Pages
   * environment variable — it is not a secret. Absent until Jobber
   * Online Booking is enabled and configured on the account, in which
   * case the wizard falls back to its plain "we'll follow up" screen.
   */
  JOBBER_ONLINE_BOOKING_URL?: string;
}

/**
 * Returns the configured Jobber Online Booking URL, or `null` when it is
 * unset or not a plausible Jobber URL. Callers treat `null` as "online
 * scheduling isn't available yet" and fall back to the manual
 * follow-up path — never surface an error to the customer over it.
 */
export function getOnlineBookingUrl(env: OnlineBookingEnv): string | null {
  const raw = env.JOBBER_ONLINE_BOOKING_URL;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  // Guard against a misconfigured value pointing the customer somewhere
  // other than Jobber. Every Jobber-hosted surface is under getjobber.com.
  const host = url.hostname.toLowerCase();
  if (host !== "getjobber.com" && !host.endsWith(".getjobber.com")) {
    return null;
  }

  return url.toString();
}

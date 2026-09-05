/**
 * Stage 1 (interim) pickup-time hand-off for the online-ordering wizard.
 *
 * When a removal order prices below the review threshold and syncs to
 * Jobber cleanly, the order API returns `onlineBookingUrl` — the public
 * URL of the business's Jobber Online Booking form. Instead of the old
 * "we'll follow up to schedule" dead-end, the wizard's final step then
 * reveals an embedded scheduler (see `PickupSchedulerPanel.astro`) so the
 * customer picks a real pickup window straight away.
 *
 * This is deliberately thin and framework-free: each calculator's inline
 * script owns its own state, and just calls `revealPickupScheduler` with
 * the booking URL and a short summary once its submit succeeds. Removed
 * wholesale when the custom scheduling step (Build Plan Phase 6) ships.
 */

export interface PickupSchedulerSummary {
  /** Customer-facing service name, e.g. "Furniture Removal". */
  service: string;
  /** Pre-formatted price string, e.g. "$340.00". */
  total: string;
  /** One-line service address. */
  address: string;
}

export interface RevealPickupSchedulerOptions {
  /** The calculator's id prefix — "fc", "ac", or "gj". */
  idPrefix: string;
  /** The Jobber Online Booking URL from the order API, or null/undefined when unavailable. */
  bookingUrl: string | null | undefined;
  summary: PickupSchedulerSummary;
}

/**
 * Fills in and reveals the pickup scheduler panel for a calculator.
 * Returns `true` when the embedded scheduler was shown, `false` when it
 * couldn't be (no booking URL, or the panel isn't on the page) — in
 * which case the caller should fall back to its plain confirmation
 * message.
 */
export function revealPickupScheduler(
  root: ParentNode,
  { idPrefix, bookingUrl, summary }: RevealPickupSchedulerOptions,
): boolean {
  if (!bookingUrl) return false;

  const panel = root.querySelector<HTMLElement>(`#${idPrefix}-pickup-scheduler`);
  if (!panel) return false;

  const setText = (role: string, value: string) => {
    const el = panel.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (el) el.textContent = value;
  };
  setText("summary-service", summary.service);
  setText("summary-total", summary.total);
  setText("summary-address", summary.address);

  const iframe = panel.querySelector<HTMLIFrameElement>(
    '[data-role="pickup-iframe"]',
  );
  // Set the src only now — the widget shouldn't load until the customer
  // actually reaches this point.
  if (iframe && !iframe.src) iframe.src = bookingUrl;

  const link = panel.querySelector<HTMLAnchorElement>(
    '[data-role="pickup-link"]',
  );
  if (link) link.href = bookingUrl;

  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

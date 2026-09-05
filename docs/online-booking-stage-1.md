# Online Booking — Stage 1 (interim Jobber hosted form)

Implements Phase A of the Pickup Scheduler Build Plan: the online-ordering
wizard collects the full order and its calculated price exactly as
before, then — for an instant-bookable order — hands the customer to
Jobber's own hosted Online Booking form to choose a real pickup time.

Nothing here is customer-visible until the two environment variables
below are set. With neither set, the wizard behaves exactly as it did
before this change (the plain "Booking Request Received / we'll follow up"
screen).

## What ships in the code

- `functions/_lib/jobber/online-booking.ts` — resolves the Jobber Online
  Booking URL from `JOBBER_ONLINE_BOOKING_URL`.
- `functions/_lib/notify/staff-alert.ts` — generic best-effort Slack
  alert primitive (reused by Build Plan Phase 5).
- `functions/_lib/orders/staff-notification.ts` /
  `functions/_lib/orders/sync-finalize.ts` — after a removal order syncs
  to Jobber, fire the staff alert and (booking path only) return
  `onlineBookingUrl` in the API response.
- `src/components/sections/PickupSchedulerPanel.astro` +
  `src/lib/ordering/pickup-scheduler.ts` — the embedded scheduler shown
  on the final wizard step of Furniture / Appliance / General Junk
  Removal.

Only those three item-catalog services reach the scheduler, and only when
their order prices below the $1,000 review threshold. Review-path orders
and every cleanout/construction service are unchanged.

## Environment variables (Cloudflare Pages → Settings → Environment variables)

| Variable | Type | Purpose | If unset |
| --- | --- | --- | --- |
| `JOBBER_ONLINE_BOOKING_URL` | plain var | Public URL of the account's Jobber Online Booking form. Must be `https://` and under `getjobber.com`. | Wizard falls back to the "we'll follow up to schedule" screen. |
| `STAFF_ALERT_SLACK_WEBHOOK_URL` | **secret** | Slack Incoming Webhook. Alert fires after every synced removal order: customer, price, order ID, Jobber link, and a reminder to reconcile the Jobber Job from Online Booking and send the deposit. | No alert is sent (order still succeeds). |

## Jobber-side prerequisites (business/admin, not code)

1. **Enable Jobber Online Booking** and configure services, durations,
   business hours, the pickup crew, the efficient-scheduling rule,
   arrival-window length and lead time. Confirm it's included on the
   plan. Copy its public booking URL into `JOBBER_ONLINE_BOOKING_URL`.
2. **Enable Jobber Payments** (separate underwriting; start early). This
   is how the deposit gets collected in Stage 1 — staff turn our
   detailed Request into a deposit-required Quote/invoice after the
   customer picks a time; the customer pays in the Jobber client hub.

## Known interim cost

Two Jobber records per booking during Stage 1: our detailed Request
(accurate price + line items) and the Job that Online Booking creates.
The Slack alert is the prompt for staff to match them up. Removed when
Build Plan Phase 6 (the custom in-wizard scheduling step) ships.

# Brief for ChatGPT — configuring Jobber for the Clean Slate website booking integration

Paste this whole file into ChatGPT to have it walk you through Jobber setup for the
Stage 1 online-booking rollout. Companion to [online-booking-stage-1.md](online-booking-stage-1.md)
(the developer-side view).

---

You are helping me configure my **Jobber** account so it matches an online-booking
integration my developer just built into my website. Walk me through it step by step,
ask me one decision at a time, and flag anything that needs Jobber support or has a
lead time. You do **not** have access to my Jobber account or the website code — work
from the context below.

---

## The business

- **Clean Slate** — junk removal and cleanouts, **Des Moines, Iowa metro only**.
- Website: clean-slate-dsm.com (static site on Cloudflare Pages; serverless functions
  talk to the Jobber API; the Jobber account is already connected via OAuth).
- Services with **instant online pricing** today: **Furniture Removal, Appliance
  Removal, General Junk Removal**. Everything else (household/garage/estate/property
  cleanouts, construction cleanup, small demolition) is a quote request and is
  **not** part of this booking flow.

## What the integration does (Stage 1 — interim)

1. Customer uses the website wizard, picks items, sees a calculated price.
2. On submit, the site creates a **Request** in Jobber (with the price as line items
   and all job details on the Request form), find-or-creating the Client and Property.
3. If the order is a straightforward booking (priced **under $1,000**, one of the 3
   services above), the confirmation screen **embeds my Jobber Online Booking form in
   an iframe** so the customer picks a real pickup time. That creates a **Job** in
   Jobber via Jobber's own Online Booking feature.
4. A Slack message fires to my team: "new booking, here's the price, match the
   incoming Online Booking Job to this Request and send the deposit request."
5. Staff then turn the Request into a **deposit-required Quote or invoice**, which the
   customer pays in the Jobber client hub (**Jobber Payments**).

So during Stage 1 there are **two Jobber records per booking** — the website's Request
and Online Booking's Job. That's expected; staff reconcile them. Stage 2 (later)
replaces the embed with a native scheduler and removes the duplication.

## Payment decision already made

Jobber's Online Booking form must **NOT collect payment at booking**. The deposit is
collected *after*, through Jobber Payments, by staff sending a deposit quote/invoice.

---

## What I need to walk out of Jobber setup with

### A. Jobber plan / features
- Confirm **Online Booking** is included on my current Jobber plan (or what upgrade/
  add-on it needs).
- Confirm **Jobber Payments** can be enabled on my account, and what the underwriting
  / approval timeline looks like (this has lead time — start it first).

### B. Online Booking configuration
Help me decide and set each of these:
- **Which services** show in the booking form: Furniture Removal, Appliance Removal,
  General Junk Removal.
- **Duration** for each of those 3 services (how long a pickup takes — drives slot size).
- **Business hours** for pickups, per weekday.
- **Which team members** are the pickup crew (assignable in Online Booking).
- **Efficient scheduling rule**: drive-time buffer vs. a fixed buffer between jobs, and
  how many minutes.
- **Arrival window** length (e.g. a 2-hour window).
- **Minimum lead time** before the earliest bookable slot (e.g. 24–48 hours).
- **Booking horizon** — how far into the future customers can book.
- **Payment at booking: OFF** (see decision above).
- After it's configured: get the **public Online Booking URL**. My developer needs this
  exact URL — it goes in a website setting called `JOBBER_ONLINE_BOOKING_URL`.
- Ask Jobber support whether the Online Booking page **can be embedded in an iframe on
  another domain** (clean-slate-dsm.com) — i.e. do they send `X-Frame-Options` /
  frame-ancestors restrictions that would block embedding. If it can't be embedded,
  the website falls back to an "open scheduler in a new tab" link, which is fine, but
  I want to know.

### C. Jobber Payments
- Enable it; complete underwriting.
- Confirm I can send a **Quote with a required deposit** (fixed amount or %) and/or an
  **invoice with a deposit**, payable in the client hub.

### D. API / OAuth (mostly already done — just verify)
- The website already has an OAuth connection to Jobber (used for creating Clients,
  Properties, Requests, Quotes). **Stage 1 needs no new API scopes** — Online Booking
  is configured in the Jobber UI, not through my API connection.
- Do **not** disconnect / reconnect the API integration unless my developer asks — a
  later phase will need extra scopes (`jobs:write`, reading the schedule) and we'll
  reconnect then.

---

## Business decisions you should help me think through

- **Deposit**: fixed dollar amount, or a percentage of the calculated price? What
  amount / percent?
- **Refund / cancellation policy** for the deposit.
- **Service durations** for the 3 services.
- **Buffer / drive-time** rule and minutes.
- **Arrival window** length.
- **Lead time** before the first bookable slot.
- **Business hours** for pickups.
- **Who on my team** watches the Slack alert and does the reconcile + deposit send.

---

## The finish line (what my developer is waiting on)

Two values to hand back to the developer, to put in Cloudflare Pages → Settings →
Environment variables:

1. `JOBBER_ONLINE_BOOKING_URL` — the public Online Booking URL from step B.
2. `STAFF_ALERT_SLACK_WEBHOOK_URL` — a **Slack Incoming Webhook URL** (I create this in
   Slack, not Jobber: Slack → Apps → Incoming Webhooks → add to the channel my ops
   team watches → copy the webhook URL). Help me do this too.

Until both are set, the website behaves exactly as it does now (a plain "we'll follow
up to schedule" screen), so there's no rush to deploy — but Jobber Payments underwriting
is the long pole, so start there.

## Out of scope for this setup (don't worry about these now)

- Iowa sales tax / tax rates on properties — deferred.
- The native in-wizard scheduler, drive-time availability engine, Stripe — that's
  Stage 2, separate work.

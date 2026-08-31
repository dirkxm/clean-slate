# Online Ordering — Manual Test Scenarios

Everything below assumes tonight's deploy (`c6a7984`) is live. Test at
`https://clean-slate-dsm.com/online-ordering`.

**Live services tonight:** Furniture Removal, Appliance Removal, General
Junk Removal, Garage Cleanout.

**Not live yet (still show "Coming Soon" → quote-request card, as
before):** Household/Estate/Property Cleanouts, Construction Cleanup,
Small Demolition. Their backend/pricing/Jobber sync is built and tested,
but there's no wizard UI for them yet — don't go looking for one.

---

## 1. Regression check — Furniture Removal (must still work exactly as before)

1. Go to `/online-ordering`, select **Furniture Removal**.
2. Add a sofa + a dresser, pick Garage access, no disassembly, 0 heavy
   items, same location, skip photos, fill in real contact info, submit.
3. **Expect:** price shown before submit, "Booking Request Received"
   confirmation, and — check Jobber — a new (or reused) Client, a
   Property matching the address you entered, and a Request with the
   items as line items.
4. Repeat with a large order (e.g. 9× Sectional - Large) to trigger the
   review/quote path — confirm you get "Quote Request Received" instead,
   and a Quote appears in Jobber (status Awaiting Response).

## 2. Appliance Removal

1. Select **Appliance Removal**. Add a Refrigerator (Standard) + a
   Washer. Confirm the price breakdown shows a **Refrigerant Recovery
   Fee** line for the fridge but not the washer.
2. Complete and submit with real contact info.
3. **Expect:** price shown, confirmation screen, Client/Property/Request
   in Jobber, refrigerant fee as its own line item on the Request.
4. **Pricing reminder:** every dollar amount here is a placeholder
   (flagged in code) pending your real numbers — the flow/mechanics are
   what to verify, not whether $75 is the "right" fridge price.

## 3. General Junk Removal

1. Select **General Junk Removal**. Add a couple of bags/boxes and one
   larger item (e.g. a Piano).
2. Complete and submit.
3. **Expect:** same price-then-book flow, Jobber sync as above.
4. Same pricing-placeholder reminder as #2.

## 4. Garage Cleanout (new — pricing not yet configured)

1. Select **Garage Cleanout**. Walk through: garage size → fill level →
   large/heavy items → access → extra labor → same-location → photos/
   notes (optional — try adding one) → contact info → submit.
2. **Expect, importantly:** the summary panel never shows a dollar
   figure — it says pricing will be **confirmed after review**. This is
   intentional and correct right now: no real per-job pricing has been
   set for this service yet, so it honestly asks for review instead of
   making up a number. After submitting, you should see "Request
   Received" (not a booking confirmation with a price).
3. **Check Jobber:** a Client/Property and a **Request** should appear —
   but **no Quote should be created** (there's nothing priced to quote
   yet). The Request's form should show "Pending — online pricing not
   yet configured for this service" instead of $0.00. If a Quote *does*
   appear, or the Request shows $0.00 instead of the pending message,
   that's a bug — tell me.

## 5. Browser Back/Forward buttons (new, applies to every service above)

1. Start any calculator (e.g. Furniture Removal), advance 2–3 steps.
2. Press the browser's native **Back** button (not the in-app Back
   button). **Expect:** it moves back exactly one wizard step, not off
   the page.
3. Press Back repeatedly until you reach step 1, then once more.
   **Expect:** you land on the service-selection screen.
4. Press Back once more from service selection. **Expect:** you leave
   `/online-ordering` entirely (to whatever page you were on before) —
   this is correct, expected behavior, not a bug.
5. Press **Forward** a few times. **Expect:** it replays your steps
   forward in the same order.
6. Try the same with the in-app "Back" button inside a wizard — it
   should behave identically to pressing the browser's Back button (they
   share the same mechanism now).

## 6. Idempotency / retry check (technical, optional)

If you want to verify a submission never double-books: open DevTools →
Network tab, submit an order, note the `orderId` in the request payload,
then resubmit that exact same request (e.g. via the Console `fetch`
technique from earlier). The second submission should return the same
`orderId` and **not** create a second Client/Request in Jobber.

## 7. Things to specifically watch for across all of the above

- The price (or "pending review" message) always appears **before** you
  reach the final submit step — never a surprise after booking.
- No step ever mentions internal pricing language (trailer size, cubic
  yards, dollar thresholds).
- Every submission — priced or not — results in a real Client, Property
  (matched to the correct address, not blindly reused from a different
  job), and Request in Jobber.
- A submission is never lost even if something goes wrong with Jobber —
  check that the confirmation screen still appears normally.

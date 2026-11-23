# Stock Masterclass Academy (Netlify + Firebase + Paystack)

Static site in `public/`, backend as Netlify Functions in `netlify/functions/`, Firestore as the only database, Firebase Auth for the admin login, Paystack for payments. Nothing else is needed except an SMTP mailbox for emails (any email account that offers SMTP).

## 1. Firebase
1. Create a project. Enable **Firestore** (production mode) and **Authentication > Email/Password**.
2. Firestore > Rules: paste `firestore.rules` and publish (browsers get no direct access; functions use the Admin SDK).
3. Project settings > Service accounts > **Generate new private key**. From the JSON you need `project_id`, `client_email`, `private_key`.
4. Project settings > General > add a **Web app**. Copy `apiKey`, `authDomain`, `appId`.
5. Optional: Firestore > TTL policy on collection `ratelimits`, field `expires_at`, so rate-limit records clean themselves up.

## 2. Netlify
Functions with dependencies need a build, so deploy with the CLI (or connect a Git repo). Plain drag-and-drop will not install `firebase-admin`.
```bash
npm install
npm i -g netlify-cli
netlify login
netlify init                 # create/link the site (publish dir: public, functions: netlify/functions)
# Set variables from .env.example in Site configuration > Environment variables, or:
netlify env:import .env
netlify deploy --prod
```
Variables are listed in `.env.example`. Set `PAYMENT_TEST_MODE=false` for the live site: test mode is ignored in Netlify's production context anyway.

## 3. Create the first administrator
```bash
cp .env.example .env     # fill in the Firebase values
node --env-file=.env scripts/create-admin.js you@example.com
```
(Or in the consoles: add the user in Firebase Auth, then create Firestore doc `admin_users/<that user's UID>` with `email`, `role: "owner"`, `status: "active"`.)
Sign in at `https://your-site/manage/`. There you can change the price (default ₦10,000), date, availability, contact email, access details and social links.

## 4. Paystack
- Put your secret key in `PAYSTACK_SECRET_KEY` (start with a `sk_test_` key).
- Dashboard > Settings > API Keys & Webhooks > Webhook URL: `https://your-site/api/paystack-webhook`
- Go live by swapping in the `sk_live_` key.

## How payment works
1. `/api/register` validates, saves a pending registration, and starts Paystack from the server. The price comes from Firestore, never the browser.
2. Student pays, returns to `/payment-result.html?reference=...`.
3. `/api/payment-verify` asks Paystack to verify, checks status, amount and currency, then marks it paid in a Firestore transaction (idempotent) and sends the confirmation email once.
4. The webhook covers students who close the tab. Failed, abandoned, pending, duplicate and amount-mismatch cases are all handled.

## One-on-one portfolio consultation
Follows the five steps on the site: choose a package, book and pay, submit portfolio details, schedule, receive the session.
1. In `/manage/` > Masterclass settings, tick **Consultation booking is open** and add up to three packages (name, NGN price, short description). Booking stays closed until at least one package is set.
2. `/api/book-consultation` saves a pending booking and starts Paystack. The package and price are read from Firestore, never the browser. It reuses the same verify, webhook and test-mode flow as registrations (the payment record carries `kind: "consultation"`).
3. After verified payment, `payment-result.html` shows the portfolio details form (`/api/consultation-details`, only accepted for paid bookings). The client also gets an email with the same link, and the academy is notified (no portfolio contents are emailed).
4. In `/manage/` > Consultation bookings, open **Review** to read the details, set the stage (awaiting details, details received, scheduled, completed, cancelled), enter the session time and internal notes. CSV export is included (it leaves out the portfolio text).

Firestore: `registrations`, `consultations`, `payments`, `admin_users`, `settings/site`, `contact_messages`, `ratelimits`.

## Test locally
`netlify dev` serves everything on localhost. With `PAYMENT_TEST_MODE=true` there, checkout is simulated and stored as `test_paid`, clearly labelled.

## Still yours to provide
Social links, date, access details and SMTP details.

Already set as defaults (used until you save different values in `/manage/`): masterclass price ₦10,000, one-on-one consultation ₦50,000 (booking open), contact email ishiedestiny2@gmail.com, and Coach Destiny's photo in `public/img/`. If you have saved settings in `/manage/` before, the saved values win, so update the price and package there.

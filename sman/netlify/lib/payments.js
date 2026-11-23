// Server-side payment verification. The browser is never trusted to say a payment succeeded.
const reg = require("./registrations");
const paystack = require("./paystack");
const { sendConfirmation, sendConsultationConfirmation } = require("./mail");
const { getSettings } = require("./settings");

const siteBase = () => (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");

async function finishPaid(reference, pay, test = false) {
  const coll = reg.collectionFor(pay);
  const first = await reg.markPaid(reference, pay.registration_id, test, coll);
  const r = await reg.getRegistration(pay.registration_id, coll);
  if (first && r && !r.email_sent) {
    try {
      const site = await getSettings();
      if (coll === "consultations")
        await sendConsultationConfirmation(r, pay.amount_kobo / 100, site, `${siteBase()}/payment-result.html?reference=${encodeURIComponent(reference)}`);
      else await sendConfirmation(r, pay.amount_kobo / 100, site);
      await reg.markEmailSent(r.id, coll);
    } catch (e) { console.error("Confirmation email failed for", reference, e.message); }
  }
  return r;
}

// Returns { state: paid|failed|abandoned|pending|unknown, registration, kind: "registration"|"consultation" }
async function processReference(reference) {
  const pay = await reg.getPayment(reference);
  if (!pay) return { state: "unknown", registration: null, kind: "registration" };
  const kind = pay.kind === "consultation" ? "consultation" : "registration";
  const coll = reg.collectionFor(pay);
  const r = await reg.getRegistration(pay.registration_id, coll);
  if (reg.PAID.includes(pay.payment_status)) return { state: "paid", registration: r, kind };
  if (pay.test_mode) return { state: pay.payment_status === "failed" ? "failed" : "pending", registration: r, kind };

  const data = await paystack.verify(reference);   // throws if Paystack is unreachable
  if (data.status === "success") {
    if (data.amount !== pay.amount_kobo || (data.currency || "NGN") !== "NGN") {
      console.error(`Amount mismatch for ${reference}: expected ${pay.amount_kobo}, got ${data.amount}`);
      await reg.markStatus(reference, "failed", "amount_mismatch");
      return { state: "failed", registration: r, kind };
    }
    return { state: "paid", registration: await finishPaid(reference, pay), kind };
  }
  if (data.status === "failed" || data.status === "reversed") {
    await reg.markStatus(reference, "failed", "verified_failed");
    return { state: "failed", registration: r, kind };
  }
  if (data.status === "abandoned") {
    await reg.markStatus(reference, "abandoned", "verified_abandoned");
    return { state: "abandoned", registration: r, kind };
  }
  return { state: "pending", registration: r, kind };
}

async function simulateTestPayment(reference) {
  const pay = await reg.getPayment(reference);
  if (pay && pay.test_mode) await finishPaid(reference, pay, true);
}

module.exports = { processReference, simulateTestPayment };

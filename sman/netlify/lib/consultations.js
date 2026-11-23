/*
 consultations/{id}: full_name, email, phone, package_id, package_name, amount_ngn, payment_status, payment_reference,
                     test_mode, email_sent, stage (awaiting_details|details_submitted|scheduled|completed|cancelled),
                     portfolio_details, goals, preferred_times, details_submitted_at, scheduled_for, admin_notes,
                     created_at, paid_at
 payments/{reference} gets kind: "consultation" so the shared verify/webhook flow handles it.
*/
const { db, FieldValue } = require("./firebase");
const { testMode } = require("./util");
const { newReference, PAID } = require("./registrations");

const STAGES = ["awaiting_details", "details_submitted", "scheduled", "completed", "cancelled"];
const iso = (v) => (v && v.toDate ? v.toDate().toISOString() : null);

async function createPending({ full_name, email, phone }, pkg) {
  const reference = newReference();
  const amountKobo = pkg.price_ngn * 100;
  const ref = db().collection("consultations").doc();
  await ref.set({
    full_name, email, phone, package_id: pkg.id, package_name: pkg.name, amount_ngn: pkg.price_ngn,
    payment_status: "pending", payment_reference: reference, test_mode: testMode(), email_sent: false,
    stage: "awaiting_details", portfolio_details: "", goals: "", preferred_times: "", details_submitted_at: null,
    scheduled_for: "", admin_notes: "", created_at: FieldValue.serverTimestamp(), paid_at: null,
  });
  await db().collection("payments").doc(reference).set({
    kind: "consultation", registration_id: ref.id, paystack_reference: reference, amount_kobo: amountKobo, currency: "NGN",
    payment_status: "pending", verification_status: "unverified", test_mode: testMode(),
    created_at: FieldValue.serverTimestamp(), verified_at: null,
  });
  return { id: ref.id, reference };
}

async function getByReference(reference) {
  const p = await db().collection("payments").doc(reference).get();
  if (!p.exists || p.data().kind !== "consultation") return null;
  const s = await db().collection("consultations").doc(p.data().registration_id).get();
  return s.exists ? { id: s.id, ref: s.ref, data: s.data() } : null;
}

// Details can only be attached to a booking whose payment is verified.
async function submitDetails({ reference, portfolio_details, goals, preferred_times }) {
  const b = await getByReference(reference);
  if (!b) return { status: "notfound" };
  if (!PAID.includes(b.data.payment_status)) return { status: "unpaid" };
  const update = { portfolio_details, goals, preferred_times, details_submitted_at: FieldValue.serverTimestamp() };
  if (b.data.stage === "awaiting_details") update.stage = "details_submitted";
  await b.ref.update(update);
  return { status: "ok", booking: { ...b.data, id: b.id } };
}

async function list(status = "paid", q = "", limit = 1000) {
  const snap = await db().collection("consultations").orderBy("created_at", "desc").limit(limit).get();
  const needle = q.trim().toLowerCase();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, full_name: x.full_name || "", email: x.email || "", phone: x.phone || "",
      package_name: x.package_name || "", amount_ngn: x.amount_ngn || 0,
      payment_status: x.payment_status || "pending", payment_reference: x.payment_reference || "",
      stage: x.stage || "awaiting_details", portfolio_details: x.portfolio_details || "", goals: x.goals || "",
      preferred_times: x.preferred_times || "", scheduled_for: x.scheduled_for || "", admin_notes: x.admin_notes || "",
      details_submitted_at: iso(x.details_submitted_at), created_at: iso(x.created_at), paid_at: iso(x.paid_at) };
  }).filter((r) => {
    const paid = PAID.includes(r.payment_status);
    if (status === "paid" && !paid) return false;
    if (status === "unpaid" && paid) return false;
    return !needle || `${r.full_name} ${r.email} ${r.phone} ${r.payment_reference}`.toLowerCase().includes(needle);
  });
}

async function adminUpdate(id, { stage, scheduled_for, admin_notes }) {
  const ref = db().collection("consultations").doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.update({ stage, scheduled_for, admin_notes });
  return true;
}

module.exports = { STAGES, createPending, getByReference, submitDetails, list, adminUpdate };

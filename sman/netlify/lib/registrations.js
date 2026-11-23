/*
 registrations/{id}: full_name, email, phone, payment_status (pending|paid|test_paid|failed|abandoned),
                     payment_reference, amount_ngn, test_mode, email_sent, created_at, paid_at
 payments/{reference}: registration_id, paystack_reference, amount_kobo, currency, payment_status,
                       verification_status, test_mode, created_at, verified_at
*/
const crypto = require("crypto");
const { db, FieldValue } = require("./firebase");
const { testMode } = require("./util");

const PAID = ["paid", "test_paid"];
class AlreadyRegistered extends Error {}

const newReference = () => "SMA-" + crypto.randomBytes(8).toString("hex").toUpperCase();

async function createPending({ full_name, email, phone }, amountKobo) {
  const regs = db().collection("registrations");
  const existing = await regs.where("email", "==", email).get();
  let pending = null;
  for (const doc of existing.docs) {
    if (doc.data().payment_status === "paid") throw new AlreadyRegistered(email);
    if (!pending) pending = doc;
  }
  const reference = newReference();
  const fields = { full_name, phone, email, payment_status: "pending", payment_reference: reference,
                   amount_ngn: amountKobo / 100, test_mode: testMode() };
  let regRef;
  if (pending) { regRef = pending.ref; await regRef.update(fields); }
  else {
    regRef = regs.doc();
    await regRef.set({ ...fields, email_sent: false, created_at: FieldValue.serverTimestamp(), paid_at: null });
  }
  await db().collection("payments").doc(reference).set({
    registration_id: regRef.id, paystack_reference: reference, amount_kobo: amountKobo, currency: "NGN",
    payment_status: "pending", verification_status: "unverified", test_mode: testMode(),
    created_at: FieldValue.serverTimestamp(), verified_at: null,
  });
  return { id: regRef.id, reference };
}

async function getPayment(reference) {
  const s = await db().collection("payments").doc(reference).get();
  return s.exists ? s.data() : null;
}
const collectionFor = (pay) => (pay && pay.kind === "consultation" ? "consultations" : "registrations");

async function getRegistration(id, collection = "registrations") {
  const s = await db().collection(collection).doc(id).get();
  return s.exists ? { id: s.id, ...s.data() } : null;
}

// Idempotent: returns true only the first time a payment is recorded (so the email goes out once).
async function markPaid(reference, registrationId, test = false, collection = "registrations") {
  const payRef = db().collection("payments").doc(reference);
  const regRef = db().collection(collection).doc(registrationId);
  const status = test ? "test_paid" : "paid";
  return db().runTransaction(async (t) => {
    const snap = await t.get(payRef);
    if (snap.exists && PAID.includes(snap.data().payment_status)) return false;
    t.update(payRef, { payment_status: status, verification_status: test ? "test_verified" : "verified",
                       verified_at: FieldValue.serverTimestamp() });
    t.update(regRef, { payment_status: status, paid_at: FieldValue.serverTimestamp() });
    return true;
  });
}

// Non-paid outcomes (failed / abandoned). Never downgrades a paid record.
async function markStatus(reference, status, verification) {
  const pay = await getPayment(reference);
  if (!pay || PAID.includes(pay.payment_status)) return;
  const update = { payment_status: status };
  if (verification) update.verification_status = verification;
  await db().collection("payments").doc(reference).update(update);
  const regRef = db().collection(collectionFor(pay)).doc(pay.registration_id);
  const reg = await regRef.get();
  if (reg.exists && reg.data().payment_reference === reference && !PAID.includes(reg.data().payment_status))
    await regRef.update({ payment_status: status });
}

const markEmailSent = (id, collection = "registrations") => db().collection(collection).doc(id).update({ email_sent: true });
const iso = (v) => (v && v.toDate ? v.toDate().toISOString() : null);

async function list(status = "all", q = "", limit = 2000) {
  const snap = await db().collection("registrations").orderBy("created_at", "desc").limit(limit).get();
  const needle = q.trim().toLowerCase();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, full_name: x.full_name || "", email: x.email || "", phone: x.phone || "",
             payment_status: x.payment_status || "pending", payment_reference: x.payment_reference || "",
             amount_ngn: x.amount_ngn || 0, created_at: iso(x.created_at), paid_at: iso(x.paid_at) };
  }).filter((r) => {
    const paid = PAID.includes(r.payment_status);
    if (status === "paid" && !paid) return false;
    if (status === "unpaid" && paid) return false;
    return !needle || `${r.full_name} ${r.email} ${r.phone} ${r.payment_reference}`.toLowerCase().includes(needle);
  });
}

module.exports = { newReference, collectionFor, AlreadyRegistered, createPending, getPayment, getRegistration, markPaid, markStatus, markEmailSent, list, PAID };

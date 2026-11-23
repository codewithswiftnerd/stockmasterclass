const crypto = require("crypto");
const { db } = require("./firebase");

const json = (status, body, headers = {}) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  body: JSON.stringify(body),
});
const fail = (status, message, extra = {}) => json(status, { ok: false, message, ...extra });

function parse(event) {
  try {
    const b = JSON.parse(event.body || "{}");
    return b && typeof b === "object" && !Array.isArray(b) ? b : null;
  } catch { return null; }
}

const REF_RE = /^SMA-[A-F0-9]{16}$/;
// Test mode can never be active in Netlify's production context.
const testMode = () => process.env.PAYMENT_TEST_MODE === "true" && process.env.CONTEXT !== "production";
const paymentsReady = () => testMode() || !!process.env.PAYSTACK_SECRET_KEY;

// Firestore-backed fixed-window rate limit (functions are stateless).
async function rateLimited(event, scope, limit, windowSec) {
  const h = event.headers || {};
  const ip = String(h["x-nf-client-connection-ip"] || h["client-ip"] || h["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const id = `${scope}_${crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24)}_${bucket}`;
  const ref = db().collection("ratelimits").doc(id);
  const count = await db().runTransaction(async (t) => {
    const s = await t.get(ref);
    const c = (s.exists ? s.data().count : 0) + 1;
    t.set(ref, { count: c, expires_at: new Date(Date.now() + windowSec * 2000) });
    return c;
  });
  return count > limit;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-]{7,18}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

function validateRegistration(b) {
  const e = {};
  const full_name = str(b.full_name), email = str(b.email).toLowerCase(), phone = str(b.phone);
  if (str(b.website)) e.website = "Invalid submission.";              // honeypot
  if (full_name.length < 3 || full_name.length > 120) e.full_name = "Enter your full name.";
  if (!EMAIL_RE.test(email) || email.length > 254) e.email = "Enter a valid email address.";
  if (!PHONE_RE.test(phone)) e.phone = "Enter a valid phone number.";
  return Object.keys(e).length ? { errors: e } : { values: { full_name, email, phone } };
}

function validateContact(b) {
  const e = {};
  const full_name = str(b.full_name), email = str(b.email).toLowerCase(), message = str(b.message);
  if (str(b.website)) e.website = "Invalid submission.";
  if (full_name.length < 3 || full_name.length > 120) e.full_name = "Enter your full name.";
  if (!EMAIL_RE.test(email) || email.length > 254) e.email = "Enter a valid email address.";
  if (message.length < 10) e.message = "Please write a little more (at least 10 characters).";
  if (message.length > 2000) e.message = "Message is too long (2000 characters max).";
  return Object.keys(e).length ? { errors: e } : { values: { full_name, email, message } };
}

function validateBooking(b) {
  const { errors, values } = validateRegistration(b);
  const e = errors || {};
  const package_id = str(b.package_id);
  if (!/^pkg[1-3]$/.test(package_id)) e.package_id = "Choose a consultation package.";
  return Object.keys(e).length ? { errors: e } : { values: { ...values, package_id } };
}

function validateDetails(b) {
  const e = {};
  const reference = str(b.reference), portfolio_details = str(b.portfolio_details);
  const goals = str(b.goals), preferred_times = str(b.preferred_times);
  if (str(b.website)) e.website = "Invalid submission.";                // honeypot
  if (!REF_RE.test(reference)) e.reference = "Invalid payment reference.";
  if (portfolio_details.length < 20) e.portfolio_details = "Please describe your portfolio (at least 20 characters).";
  if (portfolio_details.length > 4000) e.portfolio_details = "Too long (4000 characters max).";
  if (goals.length > 1500) e.goals = "Too long (1500 characters max).";
  if (preferred_times.length > 500) e.preferred_times = "Too long (500 characters max).";
  return Object.keys(e).length ? { errors: e } : { values: { reference, portfolio_details, goals, preferred_times } };
}

module.exports = { json, fail, parse, REF_RE, testMode, paymentsReady, rateLimited, validateRegistration, validateContact, validateBooking, validateDetails, EMAIL_RE };

const { json, fail, parse, rateLimited, validateBooking, paymentsReady, testMode } = require("../lib/util");
const { getSettings } = require("../lib/settings");
const con = require("../lib/consultations");
const paystack = require("../lib/paystack");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed.");
  try {
    if (await rateLimited(event, "book", 10, 3600)) return fail(429, "Too many attempts. Please try again later.");
    const body = parse(event);
    if (!body) return fail(400, "Invalid request.");
    const { errors, values } = validateBooking(body);
    if (errors) { delete errors.website; return fail(400, "Please check the highlighted fields.", { errors }); }
    if (!paymentsReady()) return fail(503, "Online payments are not available right now. Please contact the academy.");

    const s = await getSettings(true);                       // fresh read: package and price always come from the server
    const pkg = (Array.isArray(s.consultation_packages) ? s.consultation_packages : []).find((p) => p.id === values.package_id);
    if (!s.consultation_open || !pkg || !(Number(pkg.price_ngn) > 0)) return fail(409, "Consultation booking is currently closed.");

    const created = await con.createPending(values, { id: pkg.id, name: pkg.name, price_ngn: Math.round(Number(pkg.price_ngn)) });
    if (testMode()) return json(200, { ok: true, redirect_url: `/test-checkout.html?reference=${created.reference}` });

    const base = (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");
    let init;
    try {
      init = await paystack.initialize(values.email, Math.round(Number(pkg.price_ngn)) * 100, created.reference,
        `${base}/payment-result.html`, { full_name: values.full_name, phone: values.phone, kind: "consultation", package: pkg.name });
    } catch (e) {
      console.error("Paystack initialise failed:", e.message);
      return fail(502, "We couldn't start your payment. Please try again.");
    }
    return json(200, { ok: true, redirect_url: init.authorization_url });
  } catch (e) {
    console.error(e);
    return fail(500, "Something went wrong on our side. Please try again in a moment.");
  }
};

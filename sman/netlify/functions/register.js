const { json, fail, parse, rateLimited, validateRegistration, paymentsReady, testMode } = require("../lib/util");
const { getSettings } = require("../lib/settings");
const reg = require("../lib/registrations");
const paystack = require("../lib/paystack");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed.");
  try {
    if (await rateLimited(event, "register", 10, 3600)) return fail(429, "Too many attempts. Please try again later.");
    const body = parse(event);
    if (!body) return fail(400, "Invalid request.");
    const { errors, values } = validateRegistration(body);
    if (errors) { delete errors.website; return fail(400, "Please check the highlighted fields.", { errors }); }
    if (!paymentsReady()) return fail(503, "Online payments are not available right now. Please contact the academy.");

    const s = await getSettings(true);                      // fresh read: the price always comes from the server
    const price = Math.round(Number(s.registration_price_ngn) || 0);
    if (!s.registration_open || price <= 0) return fail(409, "Registration is currently closed.");

    let created;
    try { created = await reg.createPending(values, price * 100); }
    catch (e) {
      if (e instanceof reg.AlreadyRegistered)
        return fail(409, "This email address is already registered and paid. Please check your inbox for your confirmation.");
      throw e;
    }
    if (testMode()) return json(200, { ok: true, redirect_url: `/test-checkout.html?reference=${created.reference}` });

    const base = (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");
    let init;
    try {
      init = await paystack.initialize(values.email, price * 100, created.reference,
        `${base}/payment-result.html`, { full_name: values.full_name, phone: values.phone });
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

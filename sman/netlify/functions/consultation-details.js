// Called from payment-result.html after a verified consultation payment. The unguessable payment reference is the key.
const { json, fail, parse, rateLimited, validateDetails } = require("../lib/util");
const { getSettings } = require("../lib/settings");
const con = require("../lib/consultations");
const { sendConsultationDetailsNotice } = require("../lib/mail");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed.");
  try {
    if (await rateLimited(event, "cdetails", 20, 3600)) return fail(429, "Too many attempts. Please try again later.");
    const body = parse(event);
    if (!body) return fail(400, "Invalid request.");
    const { errors, values } = validateDetails(body);
    if (errors) { delete errors.website; return fail(400, "Please check the highlighted fields.", { errors }); }
    const res = await con.submitDetails(values);
    if (res.status === "notfound") return fail(404, "We couldn't find that booking.");
    if (res.status === "unpaid") return fail(402, "Your payment has not been verified yet. Please try again in a minute.");
    try { await sendConsultationDetailsNotice(res.booking, await getSettings()); }
    catch (e) { console.error("Details notice email failed (details were saved):", e.message); }
    return json(200, { ok: true, message: "Thank you. We have received your portfolio details." });
  } catch (e) {
    console.error(e);
    return fail(500, "We couldn't save your details. Please try again.");
  }
};

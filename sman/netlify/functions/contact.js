const { json, fail, parse, rateLimited, validateContact } = require("../lib/util");
const { db, FieldValue } = require("../lib/firebase");
const { getSettings } = require("../lib/settings");
const { sendContact } = require("../lib/mail");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed.");
  try {
    if (await rateLimited(event, "contact", 5, 3600)) return fail(429, "Too many messages. Please try again later.");
    const body = parse(event);
    if (!body) return fail(400, "Invalid request.");
    const { errors, values } = validateContact(body);
    if (errors) { delete errors.website; return fail(400, "Please check the highlighted fields.", { errors }); }
    await db().collection("contact_messages").add({ ...values, created_at: FieldValue.serverTimestamp() });
    try { await sendContact(values, await getSettings()); }
    catch (e) { console.error("Contact email failed (message was saved):", e.message); }
    return json(200, { ok: true, message: "Thank you. Your message has been sent." });
  } catch (e) {
    console.error(e);
    return fail(500, "We couldn't send your message. Please email us directly.");
  }
};

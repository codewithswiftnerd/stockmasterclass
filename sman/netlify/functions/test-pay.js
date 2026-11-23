// Test-mode simulator. Disabled whenever test mode is off (always off in Netlify's production context).
const { json, fail, parse, REF_RE, testMode } = require("../lib/util");
const reg = require("../lib/registrations");
const { simulateTestPayment } = require("../lib/payments");

exports.handler = async (event) => {
  if (!testMode()) return fail(404, "Not found.");
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed.");
  const b = parse(event) || {};
  if (!REF_RE.test(b.reference || "")) return fail(400, "Invalid reference.");
  const pay = await reg.getPayment(b.reference);
  if (!pay || !pay.test_mode) return fail(404, "Not found.");
  if (b.outcome === "success") await simulateTestPayment(b.reference);
  else await reg.markStatus(b.reference, "failed");
  return json(200, { ok: true });
};

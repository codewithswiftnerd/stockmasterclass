// Called by payment-result.html. Verifies with Paystack server-side; safe to call repeatedly.
const { json, fail, REF_RE } = require("../lib/util");
const { processReference } = require("../lib/payments");

exports.handler = async (event) => {
  const reference = String((event.queryStringParameters || {}).reference || "").trim();
  if (!REF_RE.test(reference)) return json(404, { ok: true, state: "unknown" });
  try {
    const { state, registration, kind } = await processReference(reference);
    return json(200, { ok: true, state, reference, kind,
      package_name: kind === "consultation" ? (registration && registration.package_name) || "" : "",
      details_submitted: !!(registration && registration.details_submitted_at),
      first_name: ((registration && registration.full_name) || "").split(" ")[0],
      test_mode: !!(registration && registration.test_mode) });
  } catch (e) {
    console.error("Verification error:", e.message);
    return json(200, { ok: true, state: "pending", reference, first_name: "", test_mode: false });
  }
};

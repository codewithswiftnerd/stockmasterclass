const { REF_RE } = require("../lib/util");
const { validSignature } = require("../lib/paystack");
const { processReference } = require("../lib/payments");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : Buffer.from(event.body || "", "utf8");
  const sig = (event.headers || {})["x-paystack-signature"];
  if (!validSignature(raw, sig)) return { statusCode: 400, body: "" };
  let evt;
  try { evt = JSON.parse(raw.toString("utf8")); } catch { return { statusCode: 400, body: "" }; }
  if (evt.event === "charge.success") {
    const ref = (evt.data && evt.data.reference) || "";
    if (REF_RE.test(ref)) {
      try { await processReference(ref); }
      catch (e) { console.error("Webhook processing failed:", e.message); return { statusCode: 500, body: "" }; } // Paystack retries
    }
  }
  return { statusCode: 200, body: "" };
};

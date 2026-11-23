const crypto = require("crypto");
const BASE = "https://api.paystack.co";

async function call(method, path, body) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack secret key is not configured.");
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.status) throw new Error(data.message || "Paystack returned an error.");
  return data.data;
}

const initialize = (email, amountKobo, reference, callbackUrl, metadata) =>
  call("POST", "/transaction/initialize", { email, amount: amountKobo, currency: "NGN", reference, callback_url: callbackUrl, metadata });
const verify = (reference) => call("GET", `/transaction/verify/${encodeURIComponent(reference)}`);

function validSignature(rawBody, signature) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const digest = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(digest), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { initialize, verify, validSignature };

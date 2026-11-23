const { json, fail } = require("../lib/util");
const { requireAdmin } = require("../lib/admin");
const reg = require("../lib/registrations");

const safe = (v) => { v = v == null ? "" : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }; // spreadsheet formula injection
const cell = (v) => `"${safe(v).replace(/"/g, '""')}"`;

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return fail(405, "Method not allowed.");
  if (!(await requireAdmin(event))) return fail(401, "Authentication required.");
  const p = event.queryStringParameters || {};
  try {
    const rows = await reg.list(p.status || "all", p.q || "");
    if (p.format === "csv") {
      const head = ["Full name", "Email", "Phone", "Payment status", "Transaction reference", "Amount (NGN)", "Registered at", "Paid at"];
      const lines = [head.map(cell).join(",")].concat(rows.map((r) =>
        [r.full_name, r.email, r.phone, r.payment_status, r.payment_reference, r.amount_ngn, r.created_at, r.paid_at].map(cell).join(",")));
      return { statusCode: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" }, body: "\uFEFF" + lines.join("\r\n") };
    }
    return json(200, { ok: true, registrations: rows });
  } catch (e) { console.error(e); return fail(500, "Could not load registrations."); }
};

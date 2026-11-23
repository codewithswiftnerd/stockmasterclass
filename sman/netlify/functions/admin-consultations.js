const { json, fail, parse } = require("../lib/util");
const { requireAdmin } = require("../lib/admin");
const con = require("../lib/consultations");

const safe = (v) => { v = v == null ? "" : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }; // spreadsheet formula injection
const cell = (v) => `"${safe(v).replace(/"/g, '""')}"`;

exports.handler = async (event) => {
  if (!(await requireAdmin(event))) return fail(401, "Authentication required.");
  try {
    if (event.httpMethod === "POST") {
      const d = parse(event);
      if (!d || typeof d.id !== "string" || !d.id || d.id.length > 100 || d.id.includes("/")) return fail(400, "Invalid request.");
      if (!con.STAGES.includes(d.stage)) return fail(400, "Choose a valid stage.");
      const ok = await con.adminUpdate(d.id, {
        stage: d.stage,
        scheduled_for: String(d.scheduled_for || "").trim().slice(0, 120),
        admin_notes: String(d.admin_notes || "").trim().slice(0, 2000),
      });
      return ok ? json(200, { ok: true, message: "Saved." }) : fail(404, "Booking not found.");
    }
    if (event.httpMethod !== "GET") return fail(405, "Method not allowed.");
    const p = event.queryStringParameters || {};
    const rows = await con.list(p.status || "paid", p.q || "");
    if (p.format === "csv") {
      const head = ["Full name", "Email", "Phone", "Package", "Amount (NGN)", "Payment status", "Transaction reference", "Stage", "Scheduled for", "Preferred times", "Booked at", "Paid at"];
      const lines = [head.map(cell).join(",")].concat(rows.map((r) =>
        [r.full_name, r.email, r.phone, r.package_name, r.amount_ngn, r.payment_status, r.payment_reference, r.stage, r.scheduled_for, r.preferred_times, r.created_at, r.paid_at].map(cell).join(",")));
      return { statusCode: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" }, body: "\uFEFF" + lines.join("\r\n") };
    }
    return json(200, { ok: true, consultations: rows });
  } catch (e) { console.error(e); return fail(500, "Could not load consultation bookings."); }
};

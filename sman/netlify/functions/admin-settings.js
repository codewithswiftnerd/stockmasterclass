const { json, fail, parse, EMAIL_RE } = require("../lib/util");
const { requireAdmin } = require("../lib/admin");
const { getSettings, saveSettings } = require("../lib/settings");

const URL_RE = /^https:\/\/\S+$/;

exports.handler = async (event) => {
  if (!(await requireAdmin(event))) return fail(401, "Authentication required.");
  try {
    if (event.httpMethod === "GET") return json(200, { ok: true, settings: await getSettings(true) });
    if (event.httpMethod !== "POST") return fail(405, "Method not allowed.");
    const d = parse(event);
    if (!d) return fail(400, "Invalid request.");
    const errors = {}, out = {};
    const t = String(d.masterclass_title || "").trim();
    if (t.length < 3 || t.length > 120) errors.masterclass_title = "Enter a title (3 to 120 characters).";
    out.masterclass_title = t;
    const price = Number(d.registration_price_ngn);
    if (!Number.isInteger(price) || price < 0 || price > 10000000) errors.registration_price_ngn = "Enter a whole-number price in naira.";
    out.registration_price_ngn = price;
    out.masterclass_date = String(d.masterclass_date || "").trim().slice(0, 120);
    out.registration_open = !!d.registration_open;
    const email = String(d.contact_email || "").trim();
    if (!EMAIL_RE.test(email)) errors.contact_email = "Enter a valid email address.";
    out.contact_email = email;
    out.access_details = String(d.access_details || "").trim().slice(0, 1000);
    out.consultation_open = !!d.consultation_open;
    const packages = [];
    for (let i = 1; i <= 3; i++) {
      const name = String(d[`pkg${i}_name`] || "").trim(), rawPrice = String(d[`pkg${i}_price`] ?? "").trim();
      const desc = String(d[`pkg${i}_desc`] || "").trim().slice(0, 300);
      if (!name && !rawPrice) continue;
      const p = Number(rawPrice);
      if (name.length < 3 || name.length > 80) errors[`pkg${i}_name`] = "Enter a package name (3 to 80 characters).";
      if (!rawPrice || !Number.isInteger(p) || p <= 0 || p > 10000000) errors[`pkg${i}_price`] = "Enter a whole-number price in naira.";
      packages.push({ id: `pkg${i}`, name, price_ngn: p, description: desc });
    }
    out.consultation_packages = packages;
    for (const k of ["social_instagram", "social_x", "social_youtube", "social_facebook"]) {
      const v = String(d[k] || "").trim();
      if (v && !URL_RE.test(v)) errors[k] = "Use a full https:// link.";
      out[k] = v;
    }
    if (Object.keys(errors).length) return fail(400, "Please fix the highlighted fields.", { errors });
    await saveSettings(out);
    return json(200, { ok: true, message: "Settings saved." });
  } catch (e) { console.error(e); return fail(500, "Could not save settings."); }
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = (s) => document.querySelector(s);
const stageLabels = { awaiting_details: "Awaiting details", details_submitted: "Details received", scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };
const labels = { paid: "Paid", test_paid: "Test (not real)", pending: "Pending", failed: "Failed", abandoned: "Abandoned" };
const loginForm = $("#login-form"), loginStatus = loginForm.querySelector(".form-status");
let auth, timer;

async function api(path, opts = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + token, "Content-Type": "application/json" } });
  if (res.status === 401 || res.status === 403) { await signOut(auth); throw new Error("auth"); }
  return res;
}

function cell(tr, text, cls) { const td = document.createElement("td"); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; }
function render(rows) {
  const body = $("#rows"); body.replaceChildren();           // textContent only: student input is never parsed as HTML
  if (!rows.length) { const tr = document.createElement("tr"); cell(tr, "No registrations found.").colSpan = 6; body.appendChild(tr); }
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    cell(tr, r.full_name); cell(tr, r.email); cell(tr, r.phone);
    const td = cell(tr, ""); const pill = document.createElement("span");
    pill.className = "pill " + r.payment_status; pill.textContent = labels[r.payment_status] || r.payment_status; td.appendChild(pill);
    cell(tr, r.payment_reference, "ref");
    cell(tr, r.created_at ? new Date(r.created_at).toLocaleString("en-NG") : "");
    body.appendChild(tr);
  });
  const box = $("#stats"); box.replaceChildren();
  const paid = rows.filter((r) => r.payment_status === "paid").length;
  [["Shown", rows.length], ["Paid", paid], ["Not paid", rows.filter((r) => !["paid", "test_paid"].includes(r.payment_status)).length]].forEach(([k, v]) => {
    const d = document.createElement("div"); d.className = "stat"; const b = document.createElement("b"); b.textContent = v;
    const s = document.createElement("span"); s.textContent = k; d.append(b, s); box.appendChild(d);
  });
}

const params = () => new URLSearchParams({ q: $("#q").value, status: $("#status").value });
async function load() { try { render((await (await api("/api/admin-registrations?" + params())).json()).registrations || []); } catch (_) {} }

$("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 300); });
$("#status").addEventListener("change", load);
$("#export").addEventListener("click", async () => {
  const p = params(); p.set("format", "csv");
  const res = await api("/api/admin-registrations?" + p);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: "registrations.csv" });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
$("#signout").addEventListener("click", () => signOut(auth));

// ---- Consultation bookings (all text via textContent: client input is never parsed as HTML)
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const cParams = () => new URLSearchParams({ q: $("#cq").value, status: $("#cstatus").value });
function detailBlock(title, text) { const d = el("div"); d.append(el("h4", title), el("pre", text || "Not provided")); return d; }
function renderConsults(rows) {
  const body = $("#crows"); body.replaceChildren();
  if (!rows.length) { const tr = el("tr"); cell(tr, "No consultation bookings found.").colSpan = 7; body.appendChild(tr); }
  rows.forEach((r) => {
    const tr = el("tr");
    cell(tr, r.full_name); cell(tr, r.email + (r.phone ? "\n" + r.phone : "")).style.whiteSpace = "pre-line";
    cell(tr, r.package_name + (r.amount_ngn ? " (\u20A6" + Number(r.amount_ngn).toLocaleString("en-NG") + ")" : ""));
    let td = cell(tr, ""); let pill = el("span", labels[r.payment_status] || r.payment_status, "pill " + r.payment_status); td.appendChild(pill);
    td = cell(tr, ""); pill = el("span", stageLabels[r.stage] || r.stage, "pill " + r.stage); td.appendChild(pill);
    cell(tr, r.created_at ? new Date(r.created_at).toLocaleString("en-NG") : "");
    const open = el("button", "Review", "btn btn-navy btn-sm"); open.setAttribute("aria-expanded", "false"); cell(tr, "").appendChild(open);
    body.appendChild(tr);

    const dr = el("tr", "", "detail"); dr.hidden = true; const dc = cell(dr, ""); dc.colSpan = 7;
    const box = el("div", "", "detail-box");
    box.append(detailBlock("Portfolio details" + (r.details_submitted_at ? " (submitted " + new Date(r.details_submitted_at).toLocaleString("en-NG") + ")" : ""), r.portfolio_details),
               detailBlock("Goals and concerns", r.goals), detailBlock("Preferred times", r.preferred_times), detailBlock("Payment reference", r.payment_reference));
    const stage = el("select"); Object.entries(stageLabels).forEach(([v, t]) => { const o = el("option", t); o.value = v; stage.appendChild(o); }); stage.value = r.stage;
    const when = el("input"); when.value = r.scheduled_for; when.maxLength = 120; when.placeholder = "e.g. Sat 14 Nov, 4:00 pm WAT, Google Meet";
    const notes = el("textarea"); notes.rows = 3; notes.maxLength = 2000; notes.value = r.admin_notes;
    const save = el("button", "Save", "btn btn-gold btn-sm"); save.style.justifySelf = "start";
    const st = el("p", "", "form-status"); st.setAttribute("role", "status");
    const lab = (t, n) => { const l = el("label", t); l.style.cssText = "display:grid;gap:.3rem;font-weight:600"; l.appendChild(n); return l; };
    box.append(lab("Stage", stage), lab("Scheduled for", when), lab("Internal notes", notes), save, st);
    save.addEventListener("click", async () => {
      save.disabled = true; st.className = "form-status"; st.textContent = "Saving\u2026";
      try {
        const res = await api("/api/admin-consultations", { method: "POST", body: JSON.stringify({ id: r.id, stage: stage.value, scheduled_for: when.value, admin_notes: notes.value }) });
        const b = await res.json().catch(() => ({}));
        st.textContent = b.message || "Could not save."; st.classList.add(res.ok ? "ok" : "error");
        if (res.ok) { r.stage = stage.value; }
      } catch (_) {}
      save.disabled = false;
    });
    dc.appendChild(box); body.appendChild(dr);
    open.addEventListener("click", () => { dr.hidden = !dr.hidden; open.setAttribute("aria-expanded", String(!dr.hidden)); open.textContent = dr.hidden ? "Review" : "Hide"; });
  });
}
async function loadConsults() { try { renderConsults((await (await api("/api/admin-consultations?" + cParams())).json()).consultations || []); } catch (_) {} }
let cTimer;
$("#cq").addEventListener("input", () => { clearTimeout(cTimer); cTimer = setTimeout(loadConsults, 300); });
$("#cstatus").addEventListener("change", loadConsults);
$("#cexport").addEventListener("click", async () => {
  const p = cParams(); p.set("format", "csv");
  const res = await api("/api/admin-consultations?" + p);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: "consultations.csv" });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

const sForm = $("#settings-form"), sStatus = sForm.querySelector(".form-status");
async function loadSettings() {
  const { settings } = await (await api("/api/admin-settings")).json();
  (settings.consultation_packages || []).slice(0, 3).forEach((p, i) => {
    sForm.elements[`pkg${i + 1}_name`].value = p.name || ""; sForm.elements[`pkg${i + 1}_price`].value = p.price_ngn || ""; sForm.elements[`pkg${i + 1}_desc`].value = p.description || "";
  });
  [...sForm.elements].forEach((el) => {
    if (!el.name || !(el.name in settings)) return;
    if (el.type === "checkbox") el.checked = !!settings[el.name]; else el.value = settings[el.name] ?? "";
  });
}
sForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {};
  [...sForm.elements].forEach((el) => { if (el.name) data[el.name] = el.type === "checkbox" ? el.checked : el.value; });
  sForm.querySelectorAll("[data-error]").forEach((s) => (s.textContent = ""));
  sStatus.className = "form-status"; sStatus.textContent = "Saving…";
  try {
    const res = await api("/api/admin-settings", { method: "POST", body: JSON.stringify(data) });
    const body = await res.json().catch(() => ({}));
    Object.entries(body.errors || {}).forEach(([k, m]) => { const el = sForm.querySelector(`[data-error="${k}"]`); if (el) el.textContent = m; });
    sStatus.textContent = body.message || "Could not save."; sStatus.classList.add(res.ok ? "ok" : "error");
  } catch (_) {}
});

(async () => {
  try {
    const cfg = (await (await fetch("/api/site")).json()).firebase;
    if (!cfg || !cfg.apiKey) throw new Error("config");
    auth = getAuth(initializeApp(cfg));
  } catch (_) { loginStatus.className = "form-status error"; loginStatus.textContent = "Firebase web config is missing on the server."; return; }

  onAuthStateChanged(auth, async (user) => {
    $("#login-view").hidden = !!user; $("#dash-view").hidden = !user;
    if (!user) return;
    try {
      const res = await api("/api/admin-registrations?" + params());   // also proves this user is an active admin
      if (!res.ok) throw new Error("fail");
      $("#who").textContent = user.email; render((await res.json()).registrations || []); loadSettings(); loadConsults();
    } catch (_) {
      loginStatus.className = "form-status error"; loginStatus.textContent = "This account is not authorised to use the dashboard.";
    }
  });
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); loginStatus.className = "form-status"; loginStatus.textContent = "Signing in…";
    try { await signInWithEmailAndPassword(auth, loginForm.email.value.trim(), loginForm.password.value); loginStatus.textContent = ""; }
    catch (_) { loginStatus.className = "form-status error"; loginStatus.textContent = "Incorrect email or password."; }
  });
})();

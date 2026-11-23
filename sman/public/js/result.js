(async () => {
  const out = document.getElementById("out");
  document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
  const p = new URLSearchParams(location.search);
  const reference = (p.get("reference") || p.get("trxref") || "").trim();
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const show = (icon, iconCls, title, paras, action) => {
    out.replaceChildren();
    if (icon) out.appendChild(el("div", icon, "icon " + iconCls));
    out.appendChild(el("h1", title));
    paras.forEach((t) => out.appendChild(typeof t === "string" ? el("p", t) : t));
    if (action) out.appendChild(action);
  };
  const link = (text, href, cls) => { const a = el("a", text, "btn " + cls); a.href = href; return a; };

  if (!reference) return show("", "", "We couldn't find that payment.", ["The link may be incomplete. If you have paid, contact the academy with your payment reference."], link("Back to home", "/", "btn-navy"));
  let d;
  try { d = await (await fetch("/api/payment-verify?reference=" + encodeURIComponent(reference))).json(); }
  catch { d = { state: "pending" }; }
  const refBox = () => { const b = el("p", "", "ref"); b.append("Payment reference: ", el("strong", reference)); return b; };
  const field = (labelText, node, hint) => { const l = el("label", ""); l.append(labelText); if (hint) l.append(el("span", hint, "hint")); l.append(node); return l; };
  const showConsultation = () => {
    const paras = [];
    if (d.test_mode) paras.push(el("p", "Test mode: this was a simulated payment, not a real one.", "test-flag"));
    paras.push("Your payment has been verified" + (d.package_name ? " for the " + d.package_name + " package" : "") + ". A confirmation email is on its way to your inbox.", refBox());
    paras.push(el("p", d.details_submitted
      ? "We already have your portfolio details. You can send an update below if anything has changed."
      : "Next step: tell us about your portfolio so we can review it before your private session.", "muted"));
    const form = el("form", "", "form consult-form"); form.noValidate = true;
    const details = el("textarea"); details.name = "portfolio_details"; details.rows = 6; details.maxLength = 4000;
    const goals = el("textarea"); goals.name = "goals"; goals.rows = 3; goals.maxLength = 1500;
    const times = el("input"); times.name = "preferred_times"; times.maxLength = 500;
    const hp = el("input", "", "hp"); hp.name = "website"; hp.tabIndex = -1; hp.autocomplete = "off"; hp.setAttribute("aria-hidden", "true");
    const err = (n) => { const s = el("span", "", "err"); s.dataset.error = n; return s; };
    const btn = el("button", d.details_submitted ? "Send update" : "Submit portfolio details", "btn btn-gold"); btn.type = "submit";
    const status = el("p", "", "form-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const lb1 = field("Your portfolio details", details, " The stocks you hold (company or ticker), roughly what share of your portfolio each makes up, which markets (Nigerian or foreign) and when you bought. Do not include passwords, account logins or card numbers."); lb1.append(err("portfolio_details"));
    const lb2 = field("Your goals and concerns (optional)", goals); lb2.append(err("goals"));
    const lb3 = field("Preferred days and times for your session (optional)", times); lb3.append(err("preferred_times"));
    form.append(lb1, lb2, lb3, hp, btn, status);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      form.querySelectorAll("[data-error]").forEach((s) => (s.textContent = ""));
      if (details.value.trim().length < 20) { form.querySelector('[data-error="portfolio_details"]').textContent = "Please describe your portfolio (at least 20 characters)."; return; }
      btn.disabled = true; status.className = "form-status"; status.textContent = "Please wait\u2026";
      try {
        const r = await fetch("/api/consultation-details", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, portfolio_details: details.value, goals: goals.value, preferred_times: times.value, website: hp.value }) });
        const b = await r.json().catch(() => ({}));
        if (r.ok && b.ok) { status.className = "form-status ok"; status.textContent = b.message + " The academy will contact you to confirm your session time."; btn.textContent = "Send update"; btn.disabled = false; return; }
        Object.entries(b.errors || {}).forEach(([k, m]) => { const s = form.querySelector(`[data-error="${k}"]`); if (s) s.textContent = m; });
        status.className = "form-status error"; status.textContent = b.message || "Something went wrong. Please try again.";
      } catch { status.className = "form-status error"; status.textContent = "Network error. Check your connection and try again."; }
      btn.disabled = false;
    });
    paras.push(form);
    return show("\u2713", "ok", `Your consultation is booked${d.first_name ? ", " + d.first_name : ""}.`, paras);
  };
  if (d.state === "paid" && d.kind === "consultation") return showConsultation();
  const retry = d.kind === "consultation" ? "/#consultation" : "/#register";
  switch (d.state) {
    case "paid": {
      const paras = [];
      if (d.test_mode) paras.push(el("p", "Test mode: this was a simulated payment, not a real one.", "test-flag"));
      paras.push("Your payment has been verified. A confirmation email is on its way to your inbox.", refBox(),
        el("p", "Keep this reference. If the email does not arrive within a few minutes, check your spam folder or contact the academy.", "muted"));
      return show("\u2713", "ok", `You're registered${d.first_name ? ", " + d.first_name : ""}.`, paras);
    }
    case "failed":
      return show("!", "bad", "Your payment did not go through.", [d.kind === "consultation" ? "No booking has been confirmed. You can try again." : "No registration has been confirmed. You can try again."], link("Try again", retry, "btn-gold"));
    case "abandoned":
      return show("!", "bad", "Payment was not completed.", ["You left the payment page before finishing. Nothing is confirmed until payment is made."], link(d.kind === "consultation" ? "Book again" : "Complete registration", retry, "btn-gold"));
    case "pending": {
      const again = el("button", "Check again", "btn btn-navy"); again.addEventListener("click", () => location.reload());
      return show("\u2026", "wait", "We're confirming your payment.", ["Paystack hasn't confirmed this payment yet. This can take a minute. Nothing is confirmed until the payment is verified.", refBox()], again);
    }
    default:
      return show("", "", "We couldn't find that payment.", ["If you have paid, contact the academy with your payment reference."], link("Back to home", "/", "btn-navy"));
  }
})();

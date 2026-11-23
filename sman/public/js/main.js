(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  async function postJSON(url, data) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    let body = {};
    try { body = await r.json(); } catch (_) {}
    return { ok: r.ok, body };
  }

  $$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));

  // Navigation
  const toggle = $(".nav-toggle"), menu = $("#nav-menu");
  const setMenu = (open) => { menu?.classList.toggle("open", open); toggle?.setAttribute("aria-expanded", String(open)); };
  toggle?.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  $$("#nav-menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // FAQ accordion
  $$(".faq-q").forEach((btn) => btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    btn.closest(".faq-item").classList.toggle("open", !open);
  }));

  // Registration dialog
  const dlg = $("#register-dialog");
  let registrationOpen = false;
  $$("[data-open-register]").forEach((el) => el.addEventListener("click", (e) => {
    if (!dlg) return;
    e.preventDefault(); setMenu(false);
    dlg.showModal();
  }));
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    $("[data-close-dialog]", d)?.addEventListener("click", () => d.close());
  });

  // Business settings (price, contact, socials, availability) come from the server, never hard-coded
  fetch("/api/site").then((r) => r.json()).then((s) => {
    if (!s.ok) return;
    registrationOpen = s.registration_available;
    $$("[data-mail]").forEach((a) => { if (!s.contact_email) return; a.href = "mailto:" + s.contact_email; a.textContent = s.contact_email; a.hidden = false; });
    $$("[data-social]").forEach((a) => { const u = s.social?.[a.dataset.social]; if (u) { a.href = u; a.hidden = false; } });
    $$("[data-test-flag]").forEach((e) => (e.hidden = !s.test_mode));
    if (s.access_details) $("#faq-access").textContent = s.access_details;
    const btn = $("#reg-btn");
    if (s.price_ngn > 0) {
      const price = "\u20A6" + Number(s.price_ngn).toLocaleString("en-NG");
      $$("[data-price-masterclass]").forEach((e) => (e.textContent = price));
      $("#price").textContent = price; $("#price").classList.remove("small"); $("#price-note").hidden = false;
      $("#reg-desc").textContent = price + " one-time payment. You will be taken to Paystack to pay securely.";
    }
    if (s.registration_available) { btn.disabled = false; btn.textContent = "Register and Pay Now"; }
    consult = { available: !!s.consultation_available, packages: s.consultation_packages || [] };
    const cheapest = Math.min(...consult.packages.map((p) => p.price_ngn));
    if (isFinite(cheapest)) $$("[data-price-consult]").forEach((e) => (e.textContent = (consult.packages.length > 1 ? "from " : "") + "\u20A6" + cheapest.toLocaleString("en-NG")));
    renderConsult();
    $("#reg-closed").hidden = s.registration_available; $("#reg-fields").hidden = !s.registration_available;
  }).catch(() => { $("#reg-closed").hidden = false; $("#reg-fields").hidden = true; });

  // One-on-one portfolio consultation (packages and prices come from the server)
  const cdlg = $("#consult-dialog");
  let consult = { available: false, packages: [] };
  const naira = (n) => "\u20A6" + Number(n).toLocaleString("en-NG");
  const mk = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  function openConsult(id) {
    if (!cdlg) return;
    const radio = id && $(`input[name="package_id"][value="${id}"]`, cdlg);
    if (radio) radio.checked = true;
    cdlg.showModal();
  }
  function renderConsult() {
    const box = $("#consult-packages"), cta = $("#consult-btn");
    if (!box || !cta) return;
    box.replaceChildren();
    $("#consult-closed").hidden = consult.available; $("#consult-fields").hidden = !consult.available;
    if (!consult.available) return;
    cta.disabled = false; cta.textContent = "Book a one-on-one session";
    const opts = $("#consult-options");
    $$(".opt", opts).forEach((o) => o.remove());
    consult.packages.forEach((p, i) => {
      const card = mk("article", "", "pkg");
      card.append(mk("h3", p.name), mk("p", p.description, "pkg-desc"), mk("p", naira(p.price_ngn), "pkg-price"));
      const pick = mk("button", "Choose this package", "btn btn-navy btn-sm"); pick.type = "button";
      pick.addEventListener("click", () => openConsult(p.id));
      card.appendChild(pick); box.appendChild(card);
      const label = mk("label", "", "opt"), input = document.createElement("input");
      input.type = "radio"; input.name = "package_id"; input.value = p.id; input.setAttribute("data-field", ""); if (consult.packages.length === 1 && i === 0) input.checked = true;
      const txt = mk("span", ""); txt.append(mk("b", p.name + " (" + naira(p.price_ngn) + ")"));
      if (p.description) txt.append(mk("small", p.description));
      label.append(input, txt); opts.appendChild(label);
    });
  }
  $$("[data-open-consult]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); openConsult(); }));
  renderConsult();


  // Motion: portfolio example, step progress line
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alloc = $("#alloc");
  if (alloc) {
    const fills = $$(".fill", alloc), labels = $$(".bars b", alloc), note = $("#alloc-note"), btns = $$(".seg button", alloc);
    const notes = { before: "More than half of the portfolio sits in one sector.", after: "No single sector is above 30%, so one bad quarter hurts less." };
    const apply = (view) => {
      fills.forEach((f, i) => { const v = f.dataset[view]; f.style.setProperty("--w", v / 100); labels[i].textContent = v + "%"; });
      alloc.classList.toggle("skewed", view === "before");
      note.textContent = notes[view];
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    };
    apply("before");
    btns.forEach((b) => b.addEventListener("click", () => apply(b.dataset.view)));
    if (reduce || !("IntersectionObserver" in window)) alloc.classList.add("in");
    else new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { alloc.classList.add("in"); o.disconnect(); } }), { threshold: 0.35 }).observe(alloc);
  }
  const steps = $("#steps");
  if (steps) {
    const items = $$("li", steps);
    const update = () => {
      const r = steps.getBoundingClientRect(), vh = innerHeight;
      const p = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height + vh * 0.1)));
      steps.style.setProperty("--p", p.toFixed(3));
      items.forEach((li, i) => li.classList.toggle("on", p >= i / items.length + 0.02));
    };
    addEventListener("scroll", update, { passive: true }); addEventListener("resize", update); update();
  }

  // Validation mirrors the server-side rules
  const rules = {
    full_name: (v) => v.trim().length >= 3 || "Enter your full name.",
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || "Enter a valid email address.",
    phone: (v) => /^\+?[0-9\s\-]{7,18}$/.test(v.trim()) || "Enter a valid phone number.",
    package_id: (v) => !!v || "Choose a consultation package.",
    message: (v) => v.trim().length >= 10 || "Please write a little more (at least 10 characters).",
  };

  function bindForm(form, url, onDone) {
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $(".form-status", form), btn = $("button[type=submit]", form);
      const data = Object.fromEntries(new FormData(form));
      let valid = true;
      $$("[data-field]", form).forEach((f) => {
        const res = rules[f.name]?.(data[f.name] || "");
        const err = $(`[data-error="${f.name}"]`, form);
        if (res !== true) { valid = false; err.textContent = res; f.setAttribute("aria-invalid", "true"); }
        else { err.textContent = ""; f.removeAttribute("aria-invalid"); }
      });
      if (!valid) return;
      btn.disabled = true; status.className = "form-status"; status.textContent = "Please wait…";
      try {
        const { ok, body } = await postJSON(url, data);
        if (ok && body.ok) { onDone(body, status, form, btn); return; }
        Object.entries(body.errors || {}).forEach(([k, m]) => { const el = $(`[data-error="${k}"]`, form); if (el) el.textContent = m; });
        status.textContent = body.message || "Something went wrong. Please try again.";
        status.classList.add("error");
      } catch (_) {
        status.textContent = "Network error. Check your connection and try again.";
        status.classList.add("error");
      }
      btn.disabled = false;
    });
  }

  bindForm($("#register-form"), "/api/register", (body, status) => {
    status.textContent = "Redirecting to secure payment…";
    window.location.href = body.redirect_url;
  });
  bindForm($("#consult-form"), "/api/book-consultation", (body, status) => {
    status.textContent = "Redirecting to secure payment…";
    window.location.href = body.redirect_url;
  });
  bindForm($("#contact-form"), "/api/contact", (body, status, form, btn) => {
    form.reset(); btn.disabled = false;
    status.className = "form-status ok"; status.textContent = body.message;
  });
})();

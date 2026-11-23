const { db } = require("./firebase");

const DEFAULTS = {
  masterclass_title: "Stock Masterclass",
  registration_price_ngn: parseInt(process.env.DEFAULT_PRICE_NGN || "10000", 10) || 0,
  masterclass_date: "",
  registration_open: true,
  contact_email: process.env.DEFAULT_CONTACT_EMAIL || "ishiedestiny2@gmail.com",
  access_details: "",
  consultation_open: true,
  // [{ id: "pkg1".."pkg3", name, price_ngn, description }]
  consultation_packages: [{
    id: "pkg1", name: "One-on-One Portfolio Consultation", price_ngn: 50000,
    description: "A private session with Coach Destiny to review your portfolio, your exposure to risk and your next steps.",
  }],
  social_instagram: "", social_x: "", social_youtube: "", social_facebook: "",
};

// strict=true rethrows Firestore errors (used before taking payments so a price is never guessed).
async function getSettings(strict = false) {
  try {
    const snap = await db().collection("settings").doc("site").get();
    const d = snap.exists ? snap.data() : {};
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (k in d) out[k] = d[k];
    return out;
  } catch (err) {
    if (strict) throw err;
    console.error("Settings load failed, using defaults:", err.message);
    return { ...DEFAULTS };
  }
}

async function saveSettings(values) {
  const clean = {};
  for (const k of Object.keys(DEFAULTS)) if (k in values) clean[k] = values[k];
  await db().collection("settings").doc("site").set(clean, { merge: true });
}

module.exports = { getSettings, saveSettings, DEFAULTS };

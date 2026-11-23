// Public, non-sensitive site settings used to fill the static pages.
const { json } = require("../lib/util");
const { getSettings } = require("../lib/settings");
const { testMode, paymentsReady } = require("../lib/util");

exports.handler = async () => {
  const s = await getSettings();
  const price = Number(s.registration_price_ngn) || 0;
  const packages = (Array.isArray(s.consultation_packages) ? s.consultation_packages : [])
    .filter((p) => p && p.name && Number(p.price_ngn) > 0)
    .map((p) => ({ id: p.id, name: p.name, price_ngn: Number(p.price_ngn), description: p.description || "" }));
  return json(200, {
    ok: true,
    title: s.masterclass_title, price_ngn: price, masterclass_date: s.masterclass_date,
    registration_available: !!s.registration_open && price > 0 && paymentsReady(),
    consultation_available: !!s.consultation_open && packages.length > 0 && paymentsReady(),
    consultation_packages: packages,
    contact_email: s.contact_email, access_details: s.access_details,
    social: { instagram: s.social_instagram, x: s.social_x, youtube: s.social_youtube, facebook: s.social_facebook },
    test_mode: testMode(),
    firebase: { apiKey: process.env.FIREBASE_WEB_API_KEY || "", authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
                projectId: process.env.FIREBASE_PROJECT_ID || "", appId: process.env.FIREBASE_APP_ID || "" },
  }, { "Cache-Control": "public, max-age=30" });
};

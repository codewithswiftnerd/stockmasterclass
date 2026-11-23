const { auth, db } = require("./firebase");

// Verifies the Firebase ID token (not revoked) and that the user is an active admin in Firestore.
async function requireAdmin(event) {
  const h = event.headers || {};
  const m = String(h.authorization || h.Authorization || "").match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const decoded = await auth().verifyIdToken(m[1], true);
    const snap = await db().collection("admin_users").doc(decoded.uid).get();
    if (!snap.exists) return null;
    const d = snap.data();
    if (d.status !== "active" || !["owner", "admin"].includes(d.role)) return null;
    return { uid: decoded.uid, email: decoded.email || "" };
  } catch { return null; }
}
module.exports = { requireAdmin };

// Usage: node --env-file=.env scripts/create-admin.js you@example.com [owner|admin]
// Creates the Firebase Auth user (if needed) and the admin_users/{uid} record.
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const readline = require("readline");

(async () => {
  const [email, role = "owner"] = process.argv.slice(2);
  if (!email) { console.error("Usage: node --env-file=.env scripts/create-admin.js email [owner|admin]"); process.exit(1); }
  const app = initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n") }) });
  const auth = getAuth(app);
  let user;
  try { user = await auth.getUserByEmail(email); console.log("Firebase user exists:", user.uid); }
  catch {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const password = await new Promise((r) => rl.question("Password (min 8 chars, visible as you type): ", (a) => { rl.close(); r(a); }));
    if (password.length < 8) { console.error("Password too short."); process.exit(1); }
    user = await auth.createUser({ email, password, emailVerified: true });
    console.log("Created Firebase user:", user.uid);
  }
  await getFirestore(app).collection("admin_users").doc(user.uid).set(
    { email, role, status: "active", created_at: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`${email} is now an active ${role}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });

// Runs on a schedule via GitHub Actions (see .github/workflows/lab-check.yml).
// Checks Firestore for any lab still marked "Open" and, if so, pushes a
// notification to every device that has enabled lab alerts.

const admin = require("firebase-admin");

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT environment variable. " +
      "Set it as a GitHub Actions secret (see README.md Part 5)."
    );
  }
  return JSON.parse(raw);
}

async function main() {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const statusSnap = await db.collection("labStatus").where("status", "==", "Open").get();

  if (statusSnap.empty) {
    console.log("All labs are closed at check time. No alert needed.");
    return;
  }

  const openLabs = statusSnap.docs.map((d) => {
    const data = d.data();
    return `${d.id} (held by ${data.currentHolder || "unknown"})`;
  });

  const title = statusSnap.size === 1
    ? "1 lab is still open"
    : `${statusSnap.size} labs are still open`;
  const body = `As of 8 PM: ${openLabs.join(", ")}.`;
  console.log(title, "-", body);

  const tokensSnap = await db.collection("pushTokens").get();
  if (tokensSnap.empty) {
    console.log("No devices have lab alerts enabled yet.");
    return;
  }

  const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
  if (tokens.length === 0) {
    console.log("No valid tokens found.");
    return;
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { notification: { icon: "icons/icon-192.png" } }
  });

  console.log(`Notifications sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

  // Clean up dead/expired tokens so future runs don't keep retrying them.
  const deletions = [];
  response.responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error && res.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        deletions.push(tokensSnap.docs[i].ref.delete());
      }
    }
  });
  await Promise.all(deletions);
  if (deletions.length) console.log(`Cleaned up ${deletions.length} expired token(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

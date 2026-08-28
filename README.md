# EnviSci Lab Ledger — Setup Guide

A shared, installable mobile app for logging who opens, hands over, and closes each
department lab (`Lab11`, `Lab1`, `Lab2`, `MB Lab`). Works on Android and iPhone via
"Add to Home Screen" — no app store needed. All data syncs live across every phone
through Firebase.

Total setup time: ~15 minutes, no coding required beyond pasting one config block.

---

## Part 1 — Create your free Firebase backend

1. Go to **https://console.firebase.google.com** and sign in with any Google account.
2. Click **Add project** → give it a name (e.g. `envisci-lab-ledger`) → you can turn
   off Google Analytics (not needed) → **Create project**.
3. In the left sidebar, click **Build → Firestore Database** → **Create database**.
   - Choose a location close to you.
   - Select **Start in test mode** for now (this allows the app to read/write without
     login — fine for an internal department tool; see the security note at the bottom).
   - Click **Create**.
4. In the left sidebar, click the **gear icon → Project settings**.
5. Scroll to **Your apps** → click the **`</>`** (Web) icon → give it a nickname
   (e.g. `lab-ledger-web`) → **Register app**. You do **not** need Firebase Hosting.
6. Firebase will show you a `firebaseConfig` object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "envisci-lab-ledger.firebaseapp.com",
     projectId: "envisci-lab-ledger",
     storageBucket: "envisci-lab-ledger.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef..."
   };
   ```

7. Open the file **`firebase-config.js`** in this folder and replace the placeholder
   values with your real ones (keep the `export const firebaseConfig = { ... }` wrapper).

That's it for Firebase — Firestore will auto-create its collections the first time
the app runs.

**Security note:** "Test mode" rules allow anyone with your app's URL to read/write
the database, which is normal for a small internal tool but not locked down. After
your Firestore Database is live, go to the **Rules** tab and you can tighten this
later (e.g. restrict to specific fields or add Firebase Authentication). Test mode
rules also expire after 30 days by default — if the app stops syncing after a month,
go to Firestore → Rules and republish similar open rules, or add proper auth.

---

## Part 2 — Publish the app with GitHub Pages

1. Go to **https://github.com** and sign in (or create a free account).
2. Click the **+** in the top right → **New repository**. Name it e.g.
   `lab-ledger` → set it to **Public** → **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Drag in **every file and folder** from this project folder (`index.html`,
   `style.css`, `app.js`, `firebase-config.js` — with your keys already pasted in —
   `manifest.json`, `service-worker.js`, and the `icons` folder). Commit the changes.
5. In the repo, go to **Settings → Pages**.
6. Under **Build and deployment → Source**, choose **Deploy from a branch**.
7. Under **Branch**, choose `main` and folder `/ (root)` → **Save**.
8. Wait about a minute, then refresh the page — GitHub will show your live URL,
   something like:

   ```
   https://your-username.github.io/lab-ledger/
   ```

---

## Part 3 — Install it on a phone

1. Open the GitHub Pages URL above in **Chrome (Android)** or **Safari (iPhone)**.
2. **Android (Chrome):** tap the **⋮** menu → **Add to Home screen** → **Install**.
3. **iPhone (Safari):** tap the **Share** icon → **Add to Home Screen**.
4. The app icon appears on the home screen and opens full-screen, like a native app.
5. The first time it opens, each student enters their name once — that becomes
   their identity on that phone for all future entries. Everyone shares the same
   live lab status, since it's all synced through Firestore.

Share the same URL with every student — no per-person setup beyond entering
their name once.

---

## How the app works

- **Home** — live status of all 4 labs: open/closed, current holder, who opened it, and when.
- **Open** — opens a currently-closed lab as you (auto-recorded with date & time).
- **Handover** — only shows labs you currently hold; pick another registered student to pass it to.
- **Close** — closes any currently-open lab as you (auto-recorded with date & time).
- **History** — full activity log, filterable by lab.

All timestamps are recorded automatically in `YYYY-MM-DD HH:MM:SS` format.

## Updating the app later

Any time you want to change text, colors, or behavior: edit the files locally,
then re-upload them to the same GitHub repo (or use `git push` if you're familiar
with Git). GitHub Pages auto-redeploys within a minute or two. Everyone's installed
app will pick up the changes next time they open it.

# EnviSci Lab Ledger — Setup Guide

A shared, installable mobile app for logging who opens, hands over, and closes each
department lab (`Lab11`, `Lab1`, `Lab2`, `MB Lab`). Works on Android and iPhone via
"Add to Home Screen" — no app store needed. All data syncs live across every phone
through Firebase, with real (database-enforced) admin control and an automatic
8 PM "lab still open" push alert.

Total setup time: ~30–40 minutes across all 5 parts, no coding required beyond
pasting config values into the marked spots.

**Parts 1–3** get the core logbook running (as before). **Part 4** sets up admin
control. **Part 5** sets up the 8 PM alert. Do them in order — Part 4 in particular
should be done before you hand the app out to the whole department, since "test
mode" rules (end of Part 1) leave the database open to anyone until Part 4 locks it down.

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
   Leave `vapidKey` as-is for now — you'll fill that in during Part 5.
8. In the left sidebar, click **Build → Authentication → Get started**.
9. Under **Sign-in method**, click **Anonymous** → toggle **Enable** → **Save**.
   This lets each phone silently get a permanent, unique device ID with no email or
   phone number required — it's what makes real admin control possible in Part 4.

That's it for the base Firebase setup — Firestore will auto-create its collections
the first time the app runs.

**Security note:** don't stop at "test mode" — Part 4 below replaces it with real
rules that enforce admin control, so do Part 4 before sharing the app widely.

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

## Part 4 — Set up admin control (do this before sharing the app)

Admin rights are enforced by the database itself, not just hidden in the app's UI —
so this needs a couple of manual one-time steps in the Firebase Console.

### 4a. Publish the real security rules

1. In Firebase Console, go to **Firestore Database → Rules**.
2. Open **`firestore.rules`** in this project folder, select all, copy it.
3. Paste it into the Rules editor in the Console, replacing what's there → **Publish**.

### 4b. Make yourself the founding admin

1. Deploy the app (Part 2) and open it on your own phone or browser.
2. Register your profile as usual.
3. Go to the **Admin** tab (bottom right, ⚙) → you'll see a **Device ID** — tap **Copy**.
4. Back in Firebase Console, go to **Firestore Database → Data**.
5. Click **Start collection** → Collection ID: `config` → Document ID: `admins`.
6. Add one field: name it `uids`, type **array**, and add a single string item —
   paste your Device ID from step 3. → **Save**.
7. Reopen the app (or just switch tabs and back) — your **Admin** tab will now show
   an **Admin Panel** listing every registered student.

That's the only manual step, ever. From here on, everything is done from the app:

- **Make admin / Revoke admin** — grants or removes admin rights for any student
  whose device has opened the app at least once (a name with "no device linked"
  means nobody has actually installed the app as that person yet — nothing to grant).
- **Remove** — permanently deletes a student's profile (e.g. to clean up an
  accidental duplicate). This doesn't touch existing history/logs, and if that
  student is currently holding a lab, the lab itself stays open under their name
  until it's closed or handed over — removing the profile just takes them out of
  future name lists.
- The app always keeps at least one admin — you can't revoke the last remaining admin.

---

## Part 5 — Set up the 8 PM "lab still open" alert

A phone can't reliably wake an app up at a fixed time when it's closed, so this
uses a free scheduled job in the same GitHub repo you already created, which checks
Firestore at 8 PM daily and pushes a real notification if any lab is still open.

### 5a. Enable Cloud Messaging + get a Web Push key

1. In Firebase Console, go to **Project settings → Cloud Messaging**.
2. Scroll to **Web configuration → Web Push certificates** → **Generate key pair**.
3. Copy the long key shown.
4. Paste it into **`firebase-config.js`**, replacing `PASTE_YOUR_VAPID_KEY`.

### 5b. Duplicate your config into the service worker

Notifications need to work even when the app is closed, which is handled by
`service-worker.js` — but service workers can't `import` files, so the same Firebase
config has to be pasted a second time.

1. Open **`service-worker.js`**.
2. Find the `firebase.initializeApp({ ... })` block near the bottom.
3. Replace those placeholder values with the exact same ones you put in
   `firebase-config.js`.

### 5c. Generate a service account key (for the scheduled check)

1. In Firebase Console: **Project settings → Service accounts**.
2. Click **Generate new private key** → confirm → a `.json` file downloads.
   **Keep this file private — never commit it to GitHub.**
3. Open that file in a text editor and copy its entire contents.

### 5d. Add it as a GitHub secret

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: paste the entire JSON file contents.
4. **Add secret**.

### 5e. Upload the remaining files and re-deploy

Upload these additional files/folders to the same GitHub repo (alongside what you
uploaded in Part 2), keeping the folder structure intact:

- `notifications/send-alerts.js`
- `notifications/package.json`
- `.github/workflows/lab-check.yml`
- your updated `firebase-config.js` and `service-worker.js`

GitHub Pages redeploys automatically; the scheduled check starts working from the
next scheduled run (or trigger it immediately — see below).

### 5f. Turn on alerts on each phone

In the app, every student taps **Admin → Enable lab alerts on this device** once,
and grants the browser's notification permission prompt. That's it for them.

### Testing it without waiting for 8 PM

In your GitHub repo, go to the **Actions** tab → **8 PM Lab Check** → **Run workflow**
→ **Run workflow**. It runs immediately so you can confirm it works. Check the run's
log — it prints whether any lab was open and how many notifications were sent.

**Timezone note:** the schedule is set to `30 14 * * *` (UTC), which is 8:00 PM India
Standard Time. If your labs are elsewhere, edit the `cron:` line in
`.github/workflows/lab-check.yml` — GitHub Actions schedules always run in UTC.

**Platform note:** push notifications work well on Android (Chrome). On iPhone,
web push requires iOS 16.4 or later **and** the app must be installed via
"Add to Home Screen" first — it won't work in a regular Safari tab.

---

## How the app works

- **Home** — live status of all 4 labs: open/closed, current holder, who opened it, and when.
- **Open** — opens a currently-closed lab as you (auto-recorded with date & time).
- **Handover** — only shows labs you currently hold; pick another registered student to pass it to.
- **Close** — closes any currently-open lab as you (auto-recorded with date & time).
- **History** — full activity log, filterable by lab.
- **Admin** — shows your device ID and lets you turn on 8 PM lab alerts; admins
  additionally see a panel to promote/revoke other admins and remove student
  profiles (e.g. accidental duplicates).

All timestamps are recorded automatically in `YYYY-MM-DD HH:MM:SS` format.

## Updating the app later

Any time you want to change text, colors, or behavior: edit the files locally,
then re-upload them to the same GitHub repo (or use `git push` if you're familiar
with Git). GitHub Pages auto-redeploys within a minute or two. Everyone's installed
app will pick up the changes next time they open it.

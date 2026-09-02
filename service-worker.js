const CACHE_NAME = "lab-ledger-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// App shell: cache-first. Everything else (Firebase, fonts): network-first, no fallback caching.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

/* ---------------- Firebase Cloud Messaging (background push) ---------------- */
// Service workers can't use ES module imports, so Firebase's compat SDK is loaded
// via importScripts, and the config is duplicated here (must match firebase-config.js).
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Paste the SAME values you put in firebase-config.js. See README.md Part 5.
firebase.initializeApp({
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Lab Ledger";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png"
  };
  self.registration.showNotification(title, options);
});

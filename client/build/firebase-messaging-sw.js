// Firebase Service Worker — handles background push notifications
// When the app is not open or not in focus, FCM delivers messages here.
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCZhx8olWYNqaqDwOz2wiGYz6VGeQpHkEM",
  authDomain:        "nishchay-academy-11698.firebaseapp.com",
  projectId:         "nishchay-academy-11698",
  storageBucket:     "nishchay-academy-11698.firebasestorage.app",
  messagingSenderId: "872165691943",
  appId:             "1:872165691943:web:98006936d0158e9fa77402",
});

const messaging = firebase.messaging();

// Handle background messages (app is closed or tab not focused)
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Background message received:", JSON.stringify(payload));

  const notification = payload.notification || {};
  const data         = payload.data         || {};

  const title = notification.title || data.title || "Exponent";
  const body  = notification.body  || data.body  || "";

  // BUG FIX: static tag "nishchay-attendance" was causing every background
  // notification to REPLACE the previous one. User would only ever see the
  // latest notification, missing all earlier ones.
  // Fix: use a unique tag per notification using timestamp + type.
  const notifType = data.type || "alert";
  const tag       = `exponent-${notifType}-${Date.now()}`;

  self.registration.showNotification(title, {
    body,
    icon:    "/nishchay-logo.png",
    badge:   "/badge-icon.png",
    vibrate: [200, 100, 200, 100, 200],
    data:    data,
    tag,            // unique per notification — no replacement
    renotify: true, // still vibrate/sound even if a previous one exists
    requireInteraction: true, // stays visible until user taps it
  });
});

// When user taps the notification, open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.link || self.location.origin + "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// Activate immediately without waiting for old SW to die
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", () => clients.claim());

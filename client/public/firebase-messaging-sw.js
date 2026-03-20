// Firebase Service Worker — handles background push notifications
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

// Handle background messages (when browser/tab is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Background message received:", payload);
  const notification = payload.notification || {};
  const title = notification.title || "Nishchay Academy";
  const body  = notification.body  || "";

  // Android Web Push notification icon slots:
  //
  //   icon  → large square image on the RIGHT  (full-colour, any PNG)
  //            ✅ nishchay-logo.png — academy logo, already working
  //
  //   badge → tiny icon on the LEFT in the status bar / notification shade
  //            ⚠️  MUST be white-on-transparent monochrome PNG (96×96)
  //            ✅ badge-icon.png — white version of the logo (upload to /public first)
  //            If this file is missing, Android falls back to Chrome's blue square
  //
  //   image → optional wide banner shown BELOW notification text

  self.registration.showNotification(title, {
    body,
    icon:    "/nishchay-logo.png",  // ← full-colour logo, RIGHT side
    badge:   "/badge-icon.png",     // ← white monochrome logo, LEFT side / status bar
    vibrate: [200, 100, 200],
    data:    payload.data || {},
    tag:     "nishchay-attendance", // replaces previous notification instead of stacking
    renotify: true,
  });
});

// When user taps the notification, open/focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

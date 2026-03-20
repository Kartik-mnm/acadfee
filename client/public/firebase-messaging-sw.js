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

  // Android Web Push notification layout:
  //   icon  → large square image shown on the RIGHT of the notification
  //   badge → tiny monochrome icon shown on the LEFT (must be white-on-transparent)
  //            If a full-colour image is used Android ignores it and shows Chrome's
  //            blue square instead. So we omit badge entirely to avoid that.
  //   image → wide banner image shown BELOW the text (optional, looks great)
  //
  // Result: Nishchay logo appears as the large icon on the right.
  // The left slot will show the Chrome icon (this is browser-controlled and
  // cannot be changed without a native Android app / TWA).

  self.registration.showNotification(title, {
    body,
    icon:    "/nishchay-logo.png",   // large icon → right side of notification
    // badge omitted → avoids Chrome's blue square fallback on the left
    vibrate: [200, 100, 200],
    data:    payload.data || {},
    tag:     "nishchay-attendance",  // replaces previous notification instead of stacking
    renotify: true,
  });
});

// When user taps the notification, open/focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, just focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

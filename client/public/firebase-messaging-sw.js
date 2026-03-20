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

  self.registration.showNotification(title, {
    body,
    // Use nishchay-logo.png which is confirmed to exist in /public
    icon:  "/nishchay-logo.png",
    badge: "/nishchay-logo.png",
    vibrate: [200, 100, 200],
    data: payload.data || {},
    // Click opens the app
    actions: [],
  });
});

// When user clicks the notification, open/focus the app window
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

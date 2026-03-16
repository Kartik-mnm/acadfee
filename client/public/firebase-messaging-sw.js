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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("Background message:", payload);
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon:  "/logo.png",
    badge: "/logo.png",
    vibrate: [200, 100, 200],
    data: payload.data,
  });
});

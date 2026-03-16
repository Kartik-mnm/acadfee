import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            "AIzaSyCZhx8olWYNqaqDwOz2wiGYz6VGeQpHkEM",
  authDomain:        "nishchay-academy-11698.firebaseapp.com",
  projectId:         "nishchay-academy-11698",
  storageBucket:     "nishchay-academy-11698.firebasestorage.app",
  messagingSenderId: "872165691943",
  appId:             "1:872165691943:web:98006936d0158e9fa77402",
};

const VAPID_KEY = "BMowm6zT1z964DU7LGUQwP5pS891D6zW5f5J_-uoH-t2qI-KWXC5IEUGGXO9FVHLF-Pj7Ns9jcJTymKD5LjRXiI";

const app       = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request permission and get FCM token
export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js"),
    });
    console.log("FCM Token:", token);
    return token;
  } catch (e) {
    console.error("FCM token error:", e);
    return null;
  }
}

// Handle foreground messages (when app is open)
export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}

export { messaging };

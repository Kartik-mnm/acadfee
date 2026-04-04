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

// Lazily register the service worker once and reuse it.
// Registering fresh every time caused the SW to update mid-session,
// which could drop pending message handlers.
let _swRegistration = null;
async function getServiceWorker() {
  if (_swRegistration) return _swRegistration;
  try {
    // Use updateViaCache: 'none' so the browser always checks for a new SW
    // but does NOT kill the existing one until it's safe to do so.
    _swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      updateViaCache: "none",
    });
    console.log("[FCM] Service worker registered:", _swRegistration.scope);
    return _swRegistration;
  } catch (e) {
    console.error("[FCM] Service worker registration failed:", e);
    return null;
  }
}

/**
 * Request notification permission and get an FCM token.
 * Returns the token string, or null if permission denied / error.
 */
export async function requestNotificationPermission() {
  try {
    // Check if service workers are supported (required for FCM web push)
    if (!("serviceWorker" in navigator)) {
      console.warn("[FCM] Service workers not supported in this browser");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM] Notification permission:", permission);
      return null;
    }

    const swReg = await getServiceWorker();
    if (!swReg) return null;

    const token = await getToken(messaging, {
      vapidKey:                  VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      console.warn("[FCM] No token received — check VAPID key and Firebase project settings");
      return null;
    }

    console.log("[FCM] Token obtained:", token.substring(0, 20) + "...");
    return token;
  } catch (e) {
    console.error("[FCM] requestNotificationPermission error:", e);
    return null;
  }
}

/**
 * Listen for foreground messages (when app tab is open and focused).
 * Returns the unsubscribe function.
 */
export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}

export { messaging };

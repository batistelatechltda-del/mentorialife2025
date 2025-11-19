// firebaseClient.js
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import axios from "../services/axiosClient"; // seu axios client

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// initialize
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

export async function requestAndRegisterToken() {
  try {
    if (!await isSupported()) {
      console.warn("Firebase messaging not supported in this browser");
      return null;
    }

    const messaging = getMessaging();
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("Notification permission not granted.");
      return null;
    }

    const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
    if (token) {
      // send to backend
      await axios.post("/api/notifications/save-push-token", { token, platform: "web" });
      return token;
    }
    return null;
  } catch (err) {
    console.error("Error getting FCM token", err);
    return null;
  }
}

export function onForegroundMessage(callback) {
  if (!("Notification" in window)) return;
  if (!isSupported()) return;
  const messaging = getMessaging();
  onMessage(messaging, payload => {
    callback(payload);
  });
}

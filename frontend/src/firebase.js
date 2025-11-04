// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
let messaging;

export const initFirebase = () => {
  if (typeof window === "undefined") return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (err) {
      console.warn("Erro ao inicializar messaging:", err);
    }
  }
  return app;
};

async function ensureSWRegistered() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker not supported in this browser.");
    return null;
  }
  try {
    // Register if not present - but registering the file should be done from app's root
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("Service Worker registrado:", reg.scope);
    return reg;
  } catch (err) {
    // If already registered, navigator.serviceWorker.ready will resolve
    console.warn("Failed to register SW (ok if already registered):", err);
    return null;
  }
}

// request permission and register token (call after login + redirect to dashboard)
export const requestPermissionAndRegisterToken = async (userId) => {
  if (typeof window === "undefined") return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Permissão de notificação não concedida");
      return null;
    }

    // ensure SW (try register) and wait ready
    await ensureSWRegistered();
    const registration = await navigator.serviceWorker.ready;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    console.log("✅ Token gerado:", token);

    if (!token) return null;

    // If user is authenticated in Firebase Auth, get idToken and send in Authorization header
    const auth = getAuth();
    let idToken = null;
    if (auth && auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }

    const backendUrl = process.env.NEXT_PUBLIC_BASE_URL_SERVER || "https://mentorialife-backend.onrender.com";

    const headers = {
      "Content-Type": "application/json",
    };
    if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

    const res = await fetch(`${backendUrl}/api/push/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, token, platform: "web" }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha ao registrar token: ${res.status} ${txt}`);
    }

    console.log("✅ Token registrado no backend com sucesso");
    return token;
  } catch (err) {
    console.error("❌ Erro ao obter/registrar token FCM:", err);
    return null;
  }
};

// foreground message handler
export const listenForForegroundMessages = (onPayload) => {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("📩 Foreground message:", payload);
    if (typeof onPayload === "function") onPayload(payload);
    // example: show Notification (careful with duplicates)
    const { title, body } = payload.notification || {};
    if (Notification.permission === "granted" && title) {
      new Notification(title, { body });
    }
  });
};

export default {
  initFirebase,
  requestPermissionAndRegisterToken,
  listenForForegroundMessages,
};

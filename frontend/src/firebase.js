import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: "G-3QLVFTGVX7",
};

// ⚙️ Inicializa Firebase apenas uma vez
let app;
if (typeof window !== "undefined") {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
}

let messaging = null;
export const initFirebase = () => app;

// 📲 Solicita permissão e registra token
export const requestPermissionAndRegisterToken = async (userId) => {
  if (typeof window === "undefined") return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("⚠️ FCM não suportado neste navegador");
      return null;
    }

    if (!messaging) messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey });

    console.log("✅ Token gerado:", token);

    if (token) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL_SERVER}/api/push/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token }),
      });
    }

    return token;
  } catch (error) {
    console.error("❌ Erro ao registrar token:", error);
    return null;
  }
};

// 🔔 Foreground notifications
export const listenForForegroundMessages = async () => {
  if (typeof window === "undefined") return;

  const supported = await isSupported();
  if (!supported) return;

  if (!messaging) messaging = getMessaging(app);

  onMessage(messaging, (payload) => {
    console.log("📩 Notificação recebida:", payload);
    const { title, body } = payload.notification || {};
    if (Notification.permission === "granted") {
      new Notification(title || "Nova mensagem", { body });
    }
  });
};

// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
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

export const initFirebase = async () => {
  if (typeof window === "undefined") return null;

  if (!app) {
    app = initializeApp(firebaseConfig);
    console.log("🔥 Firebase app inicializado");
  }

  // Verifica se o navegador suporta FCM (importante no Safari/iOS)
  const supported = await isSupported();
  if (!supported) {
    console.warn("⚠️ Este navegador não suporta Firebase Cloud Messaging.");
    return null;
  }

  if (!messaging) {
    try {
      messaging = getMessaging(app);
      console.log("💬 Firebase Messaging inicializado com sucesso");
    } catch (err) {
      console.error("❌ Erro ao inicializar messaging:", err);
    }
  }
  return app;
};

async function ensureSWRegistered() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    console.warn("⚠️ Service Worker não suportado neste navegador.");
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("✅ Service Worker registrado:", reg.scope);
    return reg;
  } catch (err) {
    console.warn("⚠️ Falha ao registrar SW (ok se já registrado):", err);
    return null;
  }
}

export const requestPermissionAndRegisterToken = async (userId) => {
  if (typeof window === "undefined") return null;

  try {
    // ✅ Garante inicialização do Firebase e Messaging antes de tudo
    if (!messaging) {
      await initFirebase();
      if (!messaging) {
        console.error("❌ Messaging ainda indefinido após initFirebase");
        return null;
      }
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("🚫 Permissão de notificação não concedida");
      return null;
    }

    await ensureSWRegistered();
    const registration = await navigator.serviceWorker.ready;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("❌ NEXT_PUBLIC_FIREBASE_VAPID_KEY não configurada");
      return null;
    }

    console.log("🔑 VAPID Key carregada:", vapidKey ? "ok" : "faltando");

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.error("⚠️ Nenhum token retornado pelo Firebase");
      return null;
    }

    console.log("✅ Token gerado:", token);

    const auth = getAuth();
    let idToken = null;
    if (auth?.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BASE_URL_SERVER ||
      "https://mentorialife-backend.onrender.com";

    const headers = { "Content-Type": "application/json" };
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

export const listenForForegroundMessages = (onPayload) => {
  if (!messaging) {
    console.warn("⚠️ Messaging não inicializado para listener.");
    return;
  }
  onMessage(messaging, (payload) => {
    console.log("📩 Foreground message recebida:", payload);
    if (typeof onPayload === "function") onPayload(payload);
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

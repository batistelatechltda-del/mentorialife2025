// ✅ Usa os scripts compat (correto para service worker)
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// ⚙️ Configuração do Firebase — pode usar a mesma do frontend
const firebaseConfig = {
  apiKey: "AIzaSyAaGeLnBQ8iArOgd_gW7iVkCdtv50F8B4o",
  authDomain: "mentoria-2330b.firebaseapp.com",
  projectId: "mentoria-2330b",
  storageBucket: "mentoria-2330b.appspot.com", // ⚠️ corrigido (.app -> .appspot.com)
  messagingSenderId: "1079803716485",
  appId: "1:1079803716485:web:caca16eae8d9ead029daec",
  measurementId: "G-3QLVFTGVX7",
};

// 🚀 Inicializa o app (necessário para background notifications)
firebase.initializeApp(firebaseConfig);

// ✅ Obtém o serviço de messaging
const messaging = firebase.messaging();

// 🔔 Escuta mensagens recebidas em background
messaging.onBackgroundMessage((payload) => {
  console.log("📨 Recebida mensagem em background:", payload);

  const notificationTitle = payload.notification?.title || "Lembrete";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/firebase-logo.png", // opcional, pode trocar pelo ícone do app
    data: payload.data || {},
  };

  // Mostra a notificação
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 🖱️ Quando o usuário clica na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url || "https://mentoria-2330b.web.app/"; // ou "/" se for local
  event.waitUntil(clients.openWindow(targetUrl));
});

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const QRCode = require("qrcode");

let sock;
let lastQrBase64 = null;

async function startWhatsApp(onMessage) {
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth");

  sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: false // ❌ desliga terminal
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("📸 QR Code gerado (disponível via /whatsapp/qr)");

      // gera imagem base64
      lastQrBase64 = await QRCode.toDataURL(qr);
    }

    if (connection === "close") {
      lastQrBase64 = null;

      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        startWhatsApp(onMessage);
      }
    }

    if (connection === "open") {
      lastQrBase64 = null;
      console.log("✅ WhatsApp conectado com sucesso");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    const from = msg.key.remoteJid;
    await onMessage({ from, text });
  });
}

// 📌 endpoint vai usar isso
function getWhatsAppQr() {
  return lastQrBase64;
}

async function sendWhatsApp(to, message) {
  if (!sock) throw new Error("WhatsApp não conectado");

  const jid = to.includes("@s.whatsapp.net")
    ? to
    : `${to}@s.whatsapp.net`;

  await sock.sendMessage(jid, { text: message });
}

module.exports = {
  startWhatsApp,
  sendWhatsApp,
  getWhatsAppQr
};

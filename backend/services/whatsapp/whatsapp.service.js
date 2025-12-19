const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const qrcode = require("qrcode-terminal");

let sock;

async function startWhatsApp(onMessage) {
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth");

  sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("📱 Escaneie o QR Code para conectar o WhatsApp");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        startWhatsApp(onMessage);
      }
    }

    if (connection === "open") {
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

    const from = msg.key.remoteJid; // 5511999999999@s.whatsapp.net
    await onMessage({ from, text });
  });
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
  sendWhatsApp
};

 // configs/twilio.js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { prisma } = require('../configs/prisma');
const { pusher } = require('../configs/pusher');

// Envia SMS (usa Messaging Service se configurado, caso contrário usa from)
async function sendSMS(to, body) {
  try {
    if (!to) throw new Error("No 'to' phone number provided");
    const params = {
      body,
      to,
    };

    if (process.env.TWILIO_SERVICE_SID) {
      params.messagingServiceSid = process.env.TWILIO_SERVICE_SID;
    } else if (process.env.TWILIO_PHONE) {
      params.from = process.env.TWILIO_PHONE;
    }

    const msg = await client.messages.create(params);
    console.log(`📲 SMS enviado para ${to}: ${msg.sid}`);
    return msg;
  } catch (error) {
    console.error(`❌ Falha ao enviar SMS para ${to}:`, error && error.message ? error.message : error);
    throw error;
  }
};

// Recebe SMS (webhook Twilio) — salva no chat, dispara pusher.
async function receiveSMS(req, res) {
  const From = req.body.From;
  const Body = req.body.Body;

  if (!From || !Body) {
    console.warn("Twilio webhook called without From/Body");
    return res.type("text/xml").send("<Response></Response>");
  }

  try {
    // **Mapear telefone -> profile -> user**
    // Normalizar números se necessário (ex: remover espaços)
    const normalized = String(From).trim();

    const profile = await prisma.profile.findFirst({
      where: { phone_number: normalized },
      include: { user: true },
    });

    if (!profile || !profile.user) {
      console.warn("SMS from unregistered phone:", normalized);
      // opcional: criar um registro de conversa temporária ou enviar resposta
      return res.type("text/xml").send("<Response></Response>");
    }

    const userId = profile.user.id;

    // Buscar (ou criar) conversa
    let conversation = await prisma.conversation.findFirst({
      where: { user_id: userId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          user_id: userId,
          title: `Chat com ${normalized}`,
        },
      });
    }

    // Criar mensagem
    const msg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "USER",
        message: Body,
      },
    });

    // Notificar frontend via pusher
    try {
      await pusher.trigger(`user-${userId}`, "notification", {
        id: msg.id,
        sender: msg.sender,
        message: msg.message,
        timestamp: msg.created_at,
      });
    } catch (pErr) {
      console.warn("Pusher trigger failed:", pErr && pErr.message ? pErr.message : pErr);
    }

    // Resposta vazia para Twilio
    res.type("text/xml").send("<Response></Response>");
  } catch (err) {
    console.error("Error in receiveSMS:", err);
    res.status(500).type("text/xml").send("<Response></Response>");
  }
};


module.exports = { sendSMS, receiveSMS };

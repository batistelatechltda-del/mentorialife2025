// ===================== TWILIO CONFIG =====================
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ===================== IMPORTAÇÕES =====================
const { prisma } = require("../configs/prisma");
const { pusher } = require("../configs/pusher");

// Importa o CÉREBRO completo do sistema
const { create: processMessage } = require("../controllers/client/messages/messages.controller");

// ===================== NORMALIZA NÚMERO =====================
function normalizePhone(phone) {
  if (!phone) return null;

  return phone
    .replace("whatsapp:", "")
    .replace("+", "")
    .replace(/\D/g, "")
    .trim();
}

// ===================== SEND SMS =====================
async function sendSMS(to, body) {
  try {
    if (!to) throw new Error("Número 'to' não informado");

    const number = to.startsWith("+") ? to : `+${to}`;

    const msg = await client.messages.create({
      from: "+13854027902",
      to: number,
      body,
    });

    console.log(`📲 SMS enviado para ${number}: ${msg.sid}`);
    return msg;

  } catch (error) {
    console.error("❌ Erro ao enviar SMS:", error.message);
    throw error;
  }
}

// ===================== SEND WHATSAPP =====================
async function sendWhatsApp(to, body) {
  try {
    if (!to) throw new Error("Número WhatsApp não informado");

    const number = to.replace(/\D/g, "");

    const params = {
      from: "whatsapp:+13854027902",
      to: `whatsapp:+${number}`,
      body,
    };

    const msg = await client.messages.create(params);
    console.log(`📤 WhatsApp enviado → ${params.to}: ${msg.sid}`);
    return msg;

  } catch (error) {
    console.error("❌ Erro ao enviar WhatsApp:", error.message);
    throw error;
  }
}

// =============================================================
//                    FLUXO DE ENTRADA SMS
// =============================================================
async function receiveSMS(req, res) {
  const From = req.body.From;
  const Body = req.body.Body;

  if (!From || !Body) {
    console.warn("⚠️ SMS vazio recebido");
    return res.type("text/xml").send("<Response></Response>");
  }

  try {
    const normalized = normalizePhone(From);

    console.log("📥 SMS recebido de:", normalized);

    // Procura usuário
    const profile = await prisma.profile.findFirst({
      where: {
        phone_number: {
          in: [
            normalized,
            normalized.slice(-11),
            "+55" + normalized.slice(-11),
            "+" + normalized,
          ],
        },
      },
      include: { user: true },
    });

    if (!profile || !profile.user) {
      console.warn("🚫 Número SMS não cadastrado:", normalized);
      return res.type("text/xml").send("<Response></Response>");
    }

    const userId = profile.user.id;

    // Garante conversa
    let conversation = await prisma.conversation.findFirst({
      where: { user_id: userId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          user_id: userId,
          title: `SMS ${normalized}`,
        },
      });
    }

    // Registrar mensagem do usuário
    const msg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "USER",
        message: Body,
      },
    });

    await pusher.trigger(`user-${userId}`, "notification", msg);

    // ======= 🔥 PASSA PARA O MESSAGESCONTROLLER ==========
    const fakeReq = {
      body: { message: Body },
      user: { userId },
    };

    const fakeRes = {
      status: () => ({
        json: (data) => data,
      }),
    };

    const result = await processMessage(fakeReq, fakeRes);

    // Envia resposta via SMS
    if (result?.reply) {
      await sendSMS(normalized, result.reply);
    }

    console.log("✅ SMS processado via messagesController");
    return res.type("text/xml").send("<Response></Response>");

  } catch (err) {
    console.error("❌ Erro no receiveSMS:", err);
    return res.status(500).type("text/xml").send("<Response></Response>");
  }
}

// =============================================================
//                 FLUXO DE ENTRADA WHATSAPP
// =============================================================
async function receiveWhatsApp(req, res) {
  const From = req.body.From; // whatsapp:+55119....
  const Body = req.body.Body;

  if (!From || !Body) {
    console.warn("⚠️ WhatsApp vazio recebido");
    return res.type("text/xml").send("<Response></Response>");
  }

  try {
    const normalized = normalizePhone(From);

    console.log("📥 WhatsApp recebido de:", From);
    console.log("📨 Conteúdo:", Body);

    // Procura usuário
    const profile = await prisma.profile.findFirst({
      where: {
        phone_number: {
          in: [
            normalized,
            normalized.slice(-11),
            "+55" + normalized.slice(-11),
            "+" + normalized,
          ],
        },
      },
      include: { user: true },
    });

    if (!profile || !profile.user) {
      console.warn("🚫 WhatsApp não cadastrado:", normalized);
      return res.type("text/xml").send("<Response></Response>");
    }

    const userId = profile.user.id;

    // Garante conversa
    let conversation = await prisma.conversation.findFirst({
      where: { user_id: userId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          user_id: userId,
          title: `WhatsApp ${normalized}`,
        },
      });
    }

    // Registrar mensagem do usuário
    const msg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "USER",
        message: Body,
      },
    });

    await pusher.trigger(`user-${userId}`, "notification", msg);

    // ======= 🔥 PASSA PARA O MESSAGESCONTROLLER ==========
    const fakeReq = {
      body: { message: Body },
      user: { userId },
    };

    const fakeRes = {
      status: () => ({
        json: (data) => data,
      }),
    };

    const result = await processMessage(fakeReq, fakeRes);

    // Envia resposta no WhatsApp
    if (result?.reply) {
      await sendWhatsApp(normalized, result.reply);
    }

    console.log("✅ WhatsApp processado via messagesController");
    return res.type("text/xml").send("<Response></Response>");

  } catch (err) {
    console.error("❌ Erro no receiveWhatsApp:", err);
    return res.status(500).type("text/xml").send("<Response></Response>");
  }
}

// =============================================================
module.exports = {
  sendSMS,
  sendWhatsApp,
  receiveSMS,
  receiveWhatsApp,
};

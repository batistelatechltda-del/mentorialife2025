// configs/twilio.js
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const { prisma } = require("../configs/prisma");
const { pusher } = require("../configs/pusher");
const openai = require("../configs/openAi");

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
    if (!to) throw new Error("Número 'to' não informado");

    const number = normalizePhone(to);
    const formatted = `whatsapp:+${number}`;

    const msg = await client.messages.create({
      from: "whatsapp:+13854027902",
      to: formatted,
      body,
    });

    console.log(`✅ WhatsApp enviado para ${formatted}: ${msg.sid}`);
    return msg;

  } catch (error) {
    console.error("❌ Erro ao enviar WhatsApp:", error.message);
    throw error;
  }
}

// ===================== RECEBE SMS =====================
async function receiveSMS(req, res) {
  const From = req.body.From;
  const Body = req.body.Body;

  if (!From || !Body) {
    console.warn("⚠️ SMS vazio recebido");
    return res.type("text/xml").send("<Response></Response>");
  }

  try {
    const normalized = normalizePhone(From);

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

    const userMsg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "USER",
        message: Body,
      },
    });

    await pusher.trigger(`user-${userId}`, "notification", {
      id: userMsg.id,
      sender: userMsg.sender,
      message: userMsg.message,
      timestamp: userMsg.created_at,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Você é um mentor de vida e produtividade." },
        { role: "user", content: Body },
      ],
    });

    const reply = completion.choices[0].message.content;

    const botMsg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "BOT",
        message: reply,
      },
    });

    await sendSMS(normalized, reply);

    await pusher.trigger(`user-${userId}`, "notification", {
      id: botMsg.id,
      sender: "BOT",
      message: reply,
      timestamp: botMsg.created_at,
    });

    console.log("✅ SMS processado com sucesso");
    return res.type("text/xml").send("<Response></Response>");

  } catch (err) {
    console.error("❌ Erro no receiveSMS:", err.message);
    return res.status(500).type("text/xml").send("<Response></Response>");
  }
}

// ===================== RECEBE WHATSAPP =====================
async function receiveWhatsApp(req, res) {
  const From = req.body.From; // whatsapp:+5511...
  const Body = req.body.Body;

  if (!From || !Body) {
    console.warn("⚠️ WhatsApp vazio recebido");
    return res.type("text/xml").send("<Response></Response>");
  }

  try {
    const normalized = normalizePhone(From);

    console.log("📥 WhatsApp recebido de:", From);
    console.log("📨 Mensagem:", Body);

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

    const userMsg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "USER",
        message: Body,
      },
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Você é um mentor de vida e produtividade." },
        { role: "user", content: Body },
      ],
    });

    const reply = completion.choices[0].message.content;

    const botMsg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "BOT",
        message: reply,
      },
    });

    console.log("📤 Enviando resposta para:", normalized);
    console.log("📑 Resposta:", reply);

    await sendWhatsApp(normalized, reply);

    await pusher.trigger(`user-${userId}`, "notification", {
      id: botMsg.id,
      sender: "BOT",
      message: reply,
      timestamp: botMsg.created_at,
    });

    console.log("✅ WhatsApp processado com sucesso");

    return res.type("text/xml").send("<Response></Response>");

  } catch (err) {
    console.error("❌ Erro no receiveWhatsApp:", err.message);
    return res.status(500).type("text/xml").send("<Response></Response>");
  }
}

module.exports = {
  sendSMS,
  sendWhatsApp,
  receiveSMS,
  receiveWhatsApp,
};

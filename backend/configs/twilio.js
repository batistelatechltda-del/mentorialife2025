// configs/twilio.js
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const { prisma } = require("../configs/prisma");
const { pusher } = require("../configs/pusher");
const openai = require("../configs/openAi");

async function sendSMS(to, body) {
  try {
    if (!to) throw new Error("Número 'to' não informado");

    const params = {
      from: "+13854027902",   // ✅ SEU NÚMERO FIXO
      to,
      body
    };

    const msg = await client.messages.create(params);
    console.log(`📲 SMS enviado para ${to}: ${msg.sid}`);
    return msg;

  } catch (error) {
    console.error("❌ Erro ao enviar SMS:", error.message);
    throw error;
  }
}

// ===================== RECEBE SMS =====================
async function receiveSMS(req, res) {
  const From = req.body.From;
  const Body = req.body.Body;

  if (!From || !Body) {
    console.warn("SMS vazio recebido");
    return res.type("text/xml").send("<Response></Response>");
  }

  try {
    const normalized = String(From).trim();

    // Buscar usuário pelo telefone
    const profile = await prisma.profile.findFirst({
      where: { phone_number: normalized },
      include: { user: true },
    });

    if (!profile || !profile.user) {
      console.warn("Telefone não cadastrado:", normalized);
      return res.type("text/xml").send("<Response></Response>");
    }

    const userId = profile.user.id;

    // Buscar ou criar conversa
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

    // Salvar mensagem do usuário
    const userMsg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "USER",
        message: Body,
      },
    });

    // Enviar pro frontend
    await pusher.trigger(`user-${userId}`, "notification", {
      id: userMsg.id,
      sender: userMsg.sender,
      message: userMsg.message,
      timestamp: userMsg.created_at,
    });

    // ================= IA =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Você é um mentor de vida e produtividade." },
        { role: "user", content: Body },
      ],
    });

    const reply = completion.choices[0].message.content;

    // Salvar resposta do BOT
    const botMsg = await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        sender: "BOT",
        message: reply,
      },
    });

    // Enviar resposta por SMS
    await sendSMS(normalized, reply);

    // Enviar pro frontend
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

module.exports = { sendSMS, receiveSMS };

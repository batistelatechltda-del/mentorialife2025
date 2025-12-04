const express = require('express');
const app = express();
const cors = require("cors");
const { reqLogger } = require("./configs/logger");
const errorHandler = require("./middlewares/errorHandler.middleware");
const { sendSMS } = require('./configs/twilio');  
app.use("/twilio", require("./routes/twilio.routes")); 
const { prisma } = require('./configs/prisma');  

// Configurações do servidor
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "50mb",
    extended: true,
    parameterLimit: 5000,
  })
);

app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 5000,
  })
);

app.use(reqLogger);

app.post('/send-message', async (req, res) => {
  const { message, userId } = req.body;

  if (!message || !userId) {
  return res.status(400).json({ 
    success:false,
    message: 'Missing message or userId'
  });
}

  try {
    // Encontrar profile pelo telefone 'from' (remetente do chat no seu sistema)
   const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { profile: true }
});

if(!user || !user.profile?.phone_number){
  return res.status(400).json({ success:false, message: "Usuário sem telefone cadastrado" });
}

const to = user.profile.phone_number;

    let conversation = await prisma.conversation.findFirst({ where: { user_id: userId }});
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { user_id: userId, title: `Chat com ${user.profile.phone_number}` }});
    }

    // Salvar mensagem no chat (sender USER)
    await prisma.chat_message.create({
      data: {
        conversation_id: conversation.id,
        message,
        sender: "USER",
      }
    });

    // Enviar via Twilio (para 'to')
    await sendSMS(to, message);

    return res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    return res.status(500).json({ success:false, message: 'Falha ao enviar a mensagem.' });
  }
});

// Rotas adicionais da aplicação
app.use("/api/auth", require("./routes/auth/auth.routes"));
app.use("/api/client", require("./routes/client"));
app.use(errorHandler);

// Exportando o app para ser usado em outros lugares
module.exports = app;

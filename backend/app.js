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
  const { message, to, from } = req.body;

  if (!message || !to || !from) {
    return res.status(400).json({ success:false, message: 'Missing message, to or from' });
  }

  try {
    // Encontrar profile pelo telefone 'from' (remetente do chat no seu sistema)
    const profile = await prisma.profile.findFirst({ where: { phone_number: from }, include: { user: true } });
    let userId;
    if (profile?.user?.id) {
      userId = profile.user.id;
    } else {
      // Se você quiser permitir envio para números que não são usuários do sistema, crie conversa temporária:
      // criar ou buscar conversation por phone_number, ou retornar erro
      return res.status(400).json({ success:false, message: 'Sender phone not linked to user' });
    }

    let conversation = await prisma.conversation.findFirst({ where: { user_id: userId }});
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { user_id: userId, title: `Chat com ${from}` }});
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

// Rota para registrar mensagens SMS no chat
app.post('/receive-sms', async (req, res) => {
    const { from, body } = req.body;

    try {
        // Buscar ou criar a conversa do usuário
        let conversation = await prisma.conversation.findFirst({
            where: {
                user: {
                    profile: {
                        phone_number: from, // Enviar para o número associado ao 'from'
                    }
                }
            }
        });

        // Se não houver conversa, cria uma nova
        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    user_id: from,
                    title: `Chat com ${from}`,
                    created_at: new Date(),
                }
            });
        }

        // Salvar a mensagem SMS no banco de dados do chat
        await prisma.chat_message.create({
            data: {
                conversation_id: conversation.id,
                message: body, // A mensagem SMS recebida
                sender: "USER", // Indica que a mensagem é do usuário
                created_at: new Date(),
            }
        });

        res.status(200).send({ success: true, message: 'Mensagem recebida e registrada no chat.' });
    } catch (error) {
        console.error('Erro ao registrar mensagem SMS:', error);
        res.status(500).send({ success: false, message: 'Falha ao registrar a mensagem SMS.' });
    }
});

// Rotas adicionais da aplicação
app.use("/api/auth", require("./routes/auth/auth.routes"));
app.use("/api/client", require("./routes/client"));
app.use(errorHandler);

// Exportando o app para ser usado em outros lugares
module.exports = app;

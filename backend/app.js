const express = require('express');
const app = express();
const cors = require("cors");
const { reqLogger } = require("./configs/logger");
const errorHandler = require("./middlewares/errorHandler.middleware");
const { sendSMS } = require('./configs/twilio');  // Importando a função para enviar SMS
const { prisma } = require('./configs/prisma');  // Importando o prisma para interação com o banco de dados

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

// Rota para enviar mensagens no chat e via SMS
app.post('/send-message', async (req, res) => {
    const { message, to, from } = req.body;
    
    try {
        // Enviar mensagem no chat
        // Verificar se já existe uma conversa ou criar uma nova
        let conversation = await prisma.conversation.findFirst({
            where: {
                user: {
                    profile: {
                        phone_number: from, // Buscando pela chave de telefone do perfil
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

        // Salvar a mensagem no banco de dados
        await prisma.chat_message.create({
            data: {
                conversation_id: conversation.id,
                message, // A mensagem que foi enviada
                sender: "USER", // Marca como sendo do usuário
                created_at: new Date(),
            }
        });

        // Enviar mensagem via SMS
        await sendSMS(to, message);

        // Retornar resposta ao usuário
        res.status(200).send({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).send({ success: false, message: 'Falha ao enviar a mensagem.' });
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

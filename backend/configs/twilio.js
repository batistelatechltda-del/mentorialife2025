const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { prisma } = require('../configs/prisma'); // Importando o prisma para interagir com o banco de dados

// Função para enviar SMS
const sendSMS = async (to, body) => {
    try {
        const msg = await client.messages.create({
            body,
            messagingServiceSid: process.env.TWILIO_SERVICE_SID,
            to,
        });
        console.log(`📲 SMS enviado para ${to}: ${msg.sid}`);
    } catch (error) {
        console.error(`❌ Falha ao enviar SMS para ${to}:`, error.message);
    }
};

// Função para receber mensagens SMS e enviá-las para o sistema de chat
const receiveSMS = async (req, res) => {
    const { From, Body } = req.body;

    // Verificando se os dados necessários foram recebidos
    if (!From || !Body) {
        return res.status(400).send({ success: false, message: 'Dados incompletos (Faltando From ou Body).' });
    }

    try {
        // Buscar a conversa do usuário com base no número de telefone
        let conversation = await prisma.conversation.findFirst({
            where: {
                user: {
                    profile: {
                        phone_number: From, // Buscando pelo telefone do perfil
                    }
                }
            }
        });

        // Se não houver conversa, cria uma nova conversa
        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    user_id: From, // Pode associar a conversa ao número ou ao user_id
                    title: `Chat com ${From}`,
                    created_at: new Date(),
                }
            });
        }

        // Cria a mensagem na conversa
        await prisma.chat_message.create({
            data: {
                conversation_id: conversation.id,
                message: Body, // A mensagem recebida via SMS
                sender: "USER", // Indica que a mensagem é do usuário
                created_at: new Date(),
            }
        });

        // Retorna sucesso para o Twilio
        res.status(200).send({ success: true, message: 'Mensagem recebida e registrada no chat.' });
    } catch (error) {
        console.error('Erro ao registrar mensagem SMS:', error);
        res.status(500).send({ success: false, message: 'Erro ao registrar a mensagem.' });
    }
};

module.exports = { sendSMS, receiveSMS };

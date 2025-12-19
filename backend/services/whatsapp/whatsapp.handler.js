const { prisma } = require("../../configs/prisma");
const { processChatMessage } = require("../chat/processChatMessage");
const { sendWhatsApp } = require("./whatsapp.service");

async function handleIncomingWhatsApp({ phone, text }) {
  const profile = await prisma.profile.findFirst({
    where: {
      phone_number: {
        in: [phone, phone.slice(-11), "+55" + phone.slice(-11)],
      },
    },
    include: { user: true },
  });

  if (!profile?.user) return;

  // 🔥 fluxo LITE
  const reply = await processChatMessage({
    userId: profile.user.id,
    message: text,
  });

  await sendWhatsApp(phone, reply);
}

module.exports = { handleIncomingWhatsApp };

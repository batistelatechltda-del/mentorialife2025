const cron = require("node-cron");
const { prisma } = require("../configs/prisma");
const openai = require("../configs/openAi"); // ajuste para o seu caminho

// Executa todo dia às 8 da manhã
cron.schedule("0 8 * * *", async () => {
  console.log(">> Executando rotina diária de reflexão...");

  // Todos os usuários
  const users = await prisma.user.findMany();

  for (const user of users) {
    const journals = await prisma.journal.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "asc" },
    });

    if (!journals.length) continue;

    const first = journals[0];
    const diffMs = new Date().getTime() - new Date(first.created_at).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Só dispara quando completar 7 dias
    if (diffDays < 7) continue;

    const recent = await prisma.journal.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 7,
    });

    const prompt = `
Você é o Jarvis, um assistente reflexivo.
Crie uma breve reflexão motivadora baseada nas últimas anotações do usuário:
${recent.map((j) => `- ${j.content}`).join("\n")}
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const reflection = aiResponse.choices[0].message.content;

    // Salvar automaticamente como um journal
    await prisma.journal.create({
      data: {
        user_id: user.id,
        content: reflection,
        is_auto: true,
        category: "Reflexão",
        emoji: "🧠",
      },
    });

    console.log(`>> Reflexão gerada para o usuário ${user.id}`);
  }
});

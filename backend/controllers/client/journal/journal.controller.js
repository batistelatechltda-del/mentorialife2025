// controllers/client/journal/journal.controller.js
const responses = require("../../../constants/responses");
const { prisma } = require("../../../configs/prisma");
const dayjs = require("dayjs");
const openai = require("../../../configs/openAi");

async function create(req, res) {
  try {
    const { content, is_auto, category, emoji, life_area_id } = req.body;
    const { userId } = req.user;

    const journal = await prisma.journal.create({
      data: {
        user_id: userId,
        content,
        is_auto: is_auto ?? false,
        category: category ?? null,
        emoji: emoji ?? null,
        life_area_id: life_area_id ?? null
      },
      include: {
        life_area: true
      }
    });

    return res.status(201).json(
      responses.createSuccessResponse(journal, "Journal created successfully.")
    );
  } catch (error) {
    console.error("Create Journal Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to create journal."));
  }
}

async function getAll(req, res) {
  try {
    const { userId } = req.user;
    // Optional query to group by life area or filter by life_area_id
    const { life_area_id } = req.query;

    const where = { user_id: userId };
    if (life_area_id) where.life_area_id = life_area_id;

    const journals = await prisma.journal.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: { life_area: true }
    });

    // Map to include is_favorite compatibility
    const mapped = journals.map(j => ({
      ...j,
      is_favorite: j.favorite,
    }));

    return res.status(200).json(
      responses.okResponse(mapped, "Journals fetched successfully.")
    );
  } catch (error) {
    console.error("Fetch Journals Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to fetch journals."));
  }
}

async function getOne(req, res) {
  try {
    const { id } = req.params;

    const journal = await prisma.journal.findUnique({
      where: { id },
      include: { user: true, life_area: true },
    });

    if (!journal) {
      return res
        .status(404)
        .json(responses.badRequestResponse("Journal not found."));
    }

    return res.status(200).json(
      responses.okResponse(journal, "Journal fetched successfully.")
    );
  } catch (error) {
    console.error("Get Journal Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to fetch journal."));
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { content, is_auto, category, emoji, favorite, life_area_id } = req.body;

    const journal = await prisma.journal.update({
      where: { id },
      data: {
        content,
        is_auto: is_auto ?? undefined,
        category: category ?? undefined,
        emoji: emoji ?? undefined,
        favorite: favorite ?? undefined,
        life_area_id: life_area_id ?? undefined,
      },
      include: { life_area: true }
    });

    return res.status(200).json(
      responses.updateSuccessResponse(journal, "Journal updated successfully.")
    );
  } catch (error) {
    console.error("Update Journal Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to update journal."));
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;

    await prisma.journal.delete({
      where: { id },
    });

    return res.status(200).json(
      responses.deleteSuccessResponse(null, "Journal deleted successfully.")
    );
  } catch (error) {
    console.error("Delete Journal Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to delete journal."));
  }
}

async function toggleFavorite(req, res) {
  try {
    const { id } = req.params;
    const { is_favorite } = req.body;

    const journal = await prisma.journal.update({
      where: { id },
      data: { favorite: is_favorite },
      include: { life_area: true }
    });

    return res.status(200).json(
      responses.updateSuccessResponse(
        {
          ...journal,
          is_favorite: journal.favorite,
        },
        "Favorite updated successfully."
      )
    );
  } catch (error) {
    console.error("Toggle Favorite Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to toggle favorite."));
  }
}

async function getStats(req, res) {
  try {
    const { userId } = req.user;
    const { life_area_id } = req.query;

    const where = { user_id: userId };
    if (life_area_id) where.life_area_id = life_area_id;

    const journals = await prisma.journal.findMany({
      where,
      orderBy: { created_at: "desc" }
    });

    const total = journals.length;

    // calcular streak corretamente
    let streak = 0;
    if (journals.length > 0) {
      let last = dayjs(journals[0].created_at).startOf("day");
      streak = 1;
      for (let i = 1; i < journals.length; i++) {
        const cur = dayjs(journals[i].created_at).startOf("day");
        const diff = last.diff(cur, "day");
        if (diff === 1) {
          streak++;
          last = cur;
        } else if (diff === 0) {
          // mesma data, ignora
          continue;
        } else {
          break;
        }
      }
    }

    return res
      .status(200)
      .json(responses.okResponse({ total, streak }, "Stats fetched successfully."));
  } catch (error) {
    console.error("Get Stats Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to fetch stats."));
  }
}

async function getReflection(req, res) {
  try {
    const { userId } = req.user;
    const { life_area_id } = req.query;

    const recent = await prisma.journal.findMany({
      where: {
        user_id: userId,
        ...(life_area_id ? { life_area_id } : {})
      },
      orderBy: { created_at: "desc" },
      take: 7,
    });

    const prompt = `
Você é o Jarvis, um assistente reflexivo.
Aqui estão as últimas anotações do usuário${life_area_id ? " — filtradas por life_area_id: " + life_area_id : ""}:
${recent.map((j) => `- ${j.content}`).join("\n")}

Crie uma reflexão motivadora curta (1 parágrafo), como:
"Ei, há uma semana você escreveu sobre começar sua rotina de academia. Olha até onde chegou."
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const message = aiResponse.choices[0].message.content;

    return res
      .status(200)
      .json(responses.okResponse({ reflection: message }, "Reflection generated."));
  } catch (error) {
    console.error("Get Reflection Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to generate reflection."));
  }
}

module.exports = {
  create,
  getAll,
  getOne,
  update,
  remove,
  toggleFavorite,
  getStats,
  getReflection,
};

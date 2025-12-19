const responses = require("../../../constants/responses");
const { prisma } = require("../../../configs/prisma");

// =======================
// CREATE
// =======================
async function create(req, res) {
  try {
    const { userId } = req.user;
    const { title, description, start_time, end_time, type } = req.body;

    const emoji = inferCalendarEmoji({ title, description, type });
    const event = await prisma.calendar_event.create({
  data: {
    user_id: userId,
    title,
    description,
    start_time: new Date(start_time),
    end_time: end_time ? new Date(end_time) : null,
    type: type || "EVENT",
    emoji,
  },
});

    return res
      .status(201)
      .json(responses.createSuccessResponse(event, "Event created successfully."));
  } catch (error) {
    console.error("Create Calendar Event Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to create event."));
  }
}


// =======================
// GET ALL (✅ AGORA CERTO)
// =======================
async function getAll(req, res) {
  try {
    const { userId } = req.user;

    const events = await prisma.calendar_event.findMany({
      where: { user_id: userId },
      orderBy: { start_time: "asc" },
    });

    const formatted = events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      start: ev.start_time,
      end: ev.end_time,
      type: ev.type,
      isRecurring: ev.is_recurring,
      isCompleted: ev.is_completed,
      color:
        ev.type === "ROUTINE"
          ? "#22c55e" // rotina
          : "#3b82f6", // evento
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("Get All Calendar Events Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to fetch events."));
  }
}

// =======================
// GET ONE
// =======================
async function getOne(req, res) {
  try {
    const { id } = req.params;

    const event = await prisma.calendar_event.findUnique({
      where: { id },
    });

    if (!event) {
      return res
        .status(404)
        .json(responses.badRequestResponse("Event not found."));
    }

    return res
      .status(200)
      .json(responses.okResponse(event, "Event fetched successfully."));
  } catch (error) {
    console.error("Get Event Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to fetch event."));
  }
}

function inferCalendarEmoji({ title, description, type }) {
  const text = `${title} ${description || ""}`.toLowerCase();

  // ✈️ Viagens
  if (text.match(/viagem|voo|aeroporto|hotel|check-in|checkin|avião/)) {
    return "✈️";
  }

  // 🧑‍⚕️ Saúde
  if (text.match(/médico|consulta|dentista|psicólogo|terapia|hospital|exame/)) {
    return "🧑‍⚕️";
  }

  // 💼 Trabalho / carreira
  if (text.match(/reunião|trabalho|cliente|projeto|call|call|apresentação|empresa/)) {
    return "💼";
  }

  // 🧠 Estudo / desenvolvimento
  if (text.match(/estudo|prova|aula|curso|ler|leitura|reflexão|planejar/)) {
    return "🧠";
  }

  // 🎯 Rotinas / metas diárias
  if (type === "ROUTINE") {
    return "🎯";
  }

  // 📅 Default
  return "📅";
}

// =======================
// UPDATE
// =======================
async function update(req, res, next) {
  try {
    const { id } = req.params;

    const event = await prisma.calendar_event.update({
      where: { id },
      data: req.body,
    });

    return res
      .status(200)
      .json(
        responses.updateSuccessResponse(event, "Event updated successfully.")
      );
  } catch (error) {
    next(error);
  }
}

// =======================
// DELETE
// =======================
async function remove(req, res) {
  try {
    const { id } = req.params;

    await prisma.calendar_event.delete({
      where: { id },
    });

    return res
      .status(200)
      .json(
        responses.deleteSuccessResponse(null, "Event deleted successfully.")
      );
  } catch (error) {
    console.error("Delete Event Error:", error);
    return res
      .status(500)
      .json(responses.serverErrorResponse("Failed to delete event."));
  }
}

module.exports = {
  create,
  getAll,
  getOne,
  update,
  remove,
};

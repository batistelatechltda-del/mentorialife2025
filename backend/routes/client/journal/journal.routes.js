const { Router } = require("express");
const router = Router();
const validateRequest = require("../../../middlewares/validateRequestJoi.middleware");
const verifyUserByToken = require("../../../middlewares/verifyUserByToken");

const {
  createJournalSchema,
  updateJournalSchema,
} = require("../../../validations/client/journal");

const {
  create,
  getAll,
  getOne,
  update,
  remove,
  toggleFavorite,
  getStats,
  getReflection,
} = require("../../../controllers/client/journal/journal.controller");

// Rotas públicas (se necessário)
router.get("/get/:id", getOne);
router.put("/update/:id", validateRequest(updateJournalSchema), update);
router.delete("/delete/:id", remove);

// Rotas autenticadas
router.use(verifyUserByToken);

// Criação e listagem padrão
router.post("/create", validateRequest(createJournalSchema), create);
router.get("/get-all", getAll);

// Alternar favorito
router.patch("/:id/favorite", toggleFavorite);

// Estatísticas
router.get("/stats/all", getStats);

// Reflexão automática com optional ?life_area_id=...
router.get("/reflection/ai", getReflection);

module.exports = router;

// notification.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/client/notification/notification.controller");
const verifyUserByToken = require("../middlewares/verifyUserByToken");

router.post("/update-preferences", verifyUserByToken, controller.updatePreferences);
router.post("/save-push-token", verifyUserByToken, controller.savePushToken);
router.post("/remove-push-token", verifyUserByToken, controller.removePushToken);

module.exports = router;

const express = require("express");
const router = express.Router();

const { receiveSMS, receiveWhatsApp } = require("../configs/twilio");

router.post("/webhook", express.urlencoded({ extended: false }), receiveSMS);
router.post("/whatsapp", express.urlencoded({ extended: false }), receiveWhatsApp);

module.exports = router;

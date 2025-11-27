
const express = require("express");
const router = express.Router();
const { receiveSMS } = require("../configs/twilio");

router.post("/webhook", express.urlencoded({ extended: false }), receiveSMS);

module.exports = router;

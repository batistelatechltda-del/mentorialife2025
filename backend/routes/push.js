// backend/routes/push.js
const express = require("express");
const router = express.Router();
const admin = require("../configs/firebaseAdmin"); // certifica-se que exporta admin
const { prisma } = require("../configs/prisma");
// Nota: prisma.push_token é o model no seu schema (conforme você informou)

async function verifyIdTokenFromHeader(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return null;
  const token = parts[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // decoded.uid se for uid do firebase; adaptamos ao campo userId em seu JWT
    return decoded;
  } catch (err) {
    console.warn("verifyIdTokenFromHeader failed:", err.message || err);
    return null;
  }
}

router.post("/register", async (req, res) => {
  try {
    // body esperado: { userId?, token, platform? }
    const { userId: userIdFromBody, token, platform = "web" } = req.body;

    if (!token) {
      return res.status(400).json({ error: "token is required" });
    }

    // Try to verify Authorization header first
    const decoded = await verifyIdTokenFromHeader(req);
    // decoded may contain 'uid' (firebase) or custom claims
    let userId = userIdFromBody || (decoded && (decoded.userId || decoded.uid));

    if (!userId) {
      // If still no userId, reject to avoid orphan tokens
      return res.status(401).json({ error: "userId not provided and Authorization invalid" });
    }

    // Upsert token by unique token value
    const saved = await prisma.push_token.upsert({
  where: { token },
  update: { user_id: userId, platform, updated_at: new Date() },
  create: { user_id: userId, token, platform },
});

    console.log("Token salvo/upsert:", saved.token, "user:", saved.user_id);
    return res.json({ success: true, saved });
  } catch (err) {
    console.error("Erro registrar token push:", err);
    return res.status(500).json({ error: "Erro interno ao registrar token" });
  }
});

module.exports = router;

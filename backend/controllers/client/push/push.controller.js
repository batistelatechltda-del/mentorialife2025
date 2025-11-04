const { prisma } = require("../../../configs/prisma");
const admin = require("../../../configs/firebaseAdmin");

// Registrar token
exports.registerPushToken = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { token, platform } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: "Missing userId or token" });
    }

    await prisma.push_token.upsert({
      where: { token },
      update: { user_id: userId, platform },
      create: { user_id: userId, token, platform },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving token:", err);
    res.status(500).json({ error: "Failed to register push token" });
  }
};

exports.sendPushNotification = async (req, res) => {
  try {
    const { title, body, token } = req.body;

    if (!title || !body || !token) {
      return res.status(400).json({ error: "Missing title, body or token" });
    }

    const message = {
      notification: { title, body },
      token,
    };

    // Verifica se o token FCM é válido
    try {
      await admin.messaging().send(message);
      res.json({ success: true });
    } catch (err) {
      console.error("Error sending push notification:", err);
      res.status(500).json({ error: "Failed to send push notification" });
    }
  } catch (err) {
    console.error("Error sending push:", err);
    res.status(500).json({ error: "Failed to send push notification" });
  }
};

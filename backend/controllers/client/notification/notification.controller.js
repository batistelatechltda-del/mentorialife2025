// notification.controller.js
const { prisma } = require("../../../configs/prisma");
const admin = require("../../../configs/firebaseAdmin"); // assume já exporta admin
const sendSMS = require("../../../configs/twilio"); // seu sendSMS
const { createAndSendEmail } = require("../../../configs/email");

async function updatePreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const { emailEnabled, smsEnabled, pushEnabled } = req.body;

    // Save flags on user record (you already have user.push_notification and user.is_notification)
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        // keep compatibility: we use push_notification and is_notification fields
        push_notification: !!pushEnabled,
        is_notification: !!emailEnabled, // or separate email flag if needed
        // optionally store smsEnabled in profile.phone_number presence + a flag in profile or a separate table
      },
    });

    return res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function savePushToken(req, res, next) {
  try {
    const userId = req.user.id;
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });

    // Upsert push_token table (unique token)
    // If same token already exists for another user, you may want to reassign it.
    const existing = await prisma.push_token.findUnique({ where: { token } });
    if (existing && existing.user_id !== userId) {
      // reassign token to current user
      await prisma.push_token.update({
        where: { token },
        data: { user_id: userId, platform, updated_at: new Date() },
      });
    } else if (!existing) {
      await prisma.push_token.create({
        data: {
          user_id: userId,
          token,
          platform: platform || null,
        },
      });
    } else {
      // exists and same user -> update timestamp/platform
      await prisma.push_token.update({
        where: { token },
        data: { platform: platform || existing.platform },
      });
    }

    // Ensure user's push_notification flag = true
    await prisma.user.update({
      where: { id: userId },
      data: { push_notification: true },
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removePushToken(req, res, next) {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });

    await prisma.push_token.deleteMany({ where: { token, user_id: userId } });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Helper to send a push to a user (used by jobs)
async function sendPushToUser(userId, payload) {
  // Get tokens for user
  const tokens = await prisma.push_token.findMany({
    where: { user_id: userId },
    select: { token: true },
  });
  if (!tokens.length) return { sent: 0, reason: "no_tokens" };

  const results = [];
  for (const t of tokens) {
    try {
      const res = await admin.messaging().send({
        token: t.token,
        notification: {
          title: payload.title || "Mentoria",
          body: payload.body || "",
        },
        data: payload.data || {},
      });
      results.push({ token: t.token, success: true, id: res });
    } catch (err) {
      results.push({ token: t.token, success: false, error: err.message });
      // Optionally: if error indicates invalid token, remove it
      if (err.code === "messaging/registration-token-not-registered" ||
          err.code === "messaging/invalid-registration-token") {
        await prisma.push_token.deleteMany({ where: { token: t.token } });
      }
    }
  }

  return results;
}

module.exports = { updatePreferences, savePushToken, removePushToken, sendPushToUser };

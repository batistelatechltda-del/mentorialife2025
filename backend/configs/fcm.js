// fcm.js
const admin = require("./firebaseAdmin"); // assume configura e exporta admin
async function sendToToken(token, payload) {
  return admin.messaging().send({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
  });
}

module.exports = { sendToToken };

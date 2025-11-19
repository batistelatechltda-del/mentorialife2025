import axios from "./axiosClient";

export const updateNotificationPreferences = async (data) =>
  axios.post("/api/notifications/update-preferences", data);

export const savePushToken = async (token, platform) =>
  axios.post("/api/notifications/save-push-token", { token, platform });

export const sendTestNotification = async () =>
  axios.post("/api/notifications/send-test");

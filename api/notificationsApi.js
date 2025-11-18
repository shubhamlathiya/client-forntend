import apiClient from "../utils/apiClient";

export const getUserNotifications = async (userId) => {
  const res = await apiClient.get(`/notifications/user/${userId}`);
  return res.data;
};

export const markNotificationRead = async (id) => {
  const res = await apiClient.patch(`/notifications/read/${id}`);
  return res.data;
};

export const markAllNotificationsRead = async (userId) => {
  const res = await apiClient.patch(`/notifications/read-all/${userId}`);
  return res.data;
};
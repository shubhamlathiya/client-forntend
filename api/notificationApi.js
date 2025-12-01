import apiClient from "../utils/apiClient";
import {Platform} from "react-native";

export const getUserNotifications = async (userId, params = {}) => {
    const res = await apiClient.get(`/api/notifications`, { params });
    return res.data.notifications;
};

export const getUserUnReadNotifications = async (userId, params = {}) => {
    const res = await apiClient.get(`/api/notifications`, { params });
    console.log(res.data.notifications[0])
    return res.data.notifications;
};


export const markNotificationAsRead = async (id) => {
    const res = await apiClient.patch(`/api/notifications/${id}/read`);
    console.log(res.data);
    return res.data;
};

export const markAllNotificationsAsRead = async () => {
    const res = await apiClient.patch(`/api/notifications/read`);
    console.log(res.data);
    return res.data;
};

export const getUnreadCount = async () => {
    const res = await apiClient.get(`/api/notifications/unread-count`);
    console.log(res.data.count);
    return res.data.count;
};

export const deleteNotification = async (id) => {
    const res = await apiClient.delete(`/api/notifications/${id}`);
    console.log(res.data);
    return res.data;
};

export const createTestNotification = async (data) => {
    const res = await apiClient.post(`/api/notifications/test`, data);
    console.log(res.data);
    return res.data;
};
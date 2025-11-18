import { API_BASE_URL } from '../config/apiConfig';

// Get user notifications
export const getUserNotifications = async (userId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/user/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/read/${notificationId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

// Mark all notifications as read for user
export const markAllNotificationsAsRead = async (userId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/read-all/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};

// Create new notification (for testing or admin use)
export const createNotification = async (notificationData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notificationData),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead} from "../api/notificationApi";


const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Get current user ID from AsyncStorage
  const getCurrentUserId = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedData = JSON.parse(userData);
        return parsedData._id || parsedData.id;
      }
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  // Fetch notifications from API
  const fetchNotifications = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User not found. Please login again.');
      }

      const response = await getUserNotifications(userId);

      // Handle different response structures
      let notificationsData = [];
      if (Array.isArray(response)) {
        notificationsData = response;
      } else if (Array.isArray(response.data)) {
        notificationsData = response.data;
      } else if (Array.isArray(response.notifications)) {
        notificationsData = response.notifications;
      } else if (response.success && Array.isArray(response.data)) {
        notificationsData = response.data;
      }

      // Sort by date (newest first)
      notificationsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setNotifications(notificationsData);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications');

      // Show alert for critical errors
      if (err.message.includes('User not found')) {
        Alert.alert('Session Expired', 'Please login again to continue.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Mark one notification as read
  const markOneAsRead = async (notificationId) => {
    try {
      setNotifications(prev =>
          prev.map(notification =>
              notification._id === notificationId || notification.id === notificationId
                  ? { ...notification, read: true }
                  : notification
          )
      );

      await markNotificationAsRead(notificationId);

      // Refresh to get updated data
      await fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Failed to mark notification as read');

      // Revert optimistic update
      setNotifications(prev =>
          prev.map(notification =>
              notification._id === notificationId || notification.id === notificationId
                  ? { ...notification, read: false }
                  : notification
          )
      );
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User not found');
      }

      // Optimistic update
      setNotifications(prev =>
          prev.map(notification => ({ ...notification, read: true }))
      );

      await markAllNotificationsAsRead(userId);

      // Refresh to get updated data
      await fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Failed to mark all notifications as read');

      // Revert optimistic update
      await fetchNotifications();
    }
  };

  // Refresh notifications
  const refresh = () => {
    fetchNotifications(true);
  };

  // Calculate unread count
  const unreadCount = notifications.filter(notification => !notification.read).length;

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    markOneAsRead,
    markAllAsRead,
    fetchNotifications
  };
};

export default useNotifications;
import { useState, useEffect, useCallback, useRef } from 'react';
import {Alert, AppState, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';

import {
    markNotificationAsRead as apiMarkAsRead,
    markAllNotificationsAsRead as apiMarkAllAsRead,
    deleteNotification as apiDeleteNotification,
    getUserUnReadNotifications
} from '../api/notificationApi';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const useNotifications = () => {
    // State
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

    const router = useRouter();
    const notificationListener = useRef();
    const responseListener = useRef();
    const appStateSubscription = useRef();
    const pollIntervalRef = useRef();

    // ------------------------------------------------------------
    // 1. SEND LOCAL NOTIFICATION (Simplified)
    // ------------------------------------------------------------
    const sendLocalNotification = async (notificationData) => {
        try {

            const notificationId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const content = {
                title: notificationData.title,
                body: notificationData.message,
                data: {
                    ...notificationData.data,
                    notificationId: notificationId,
                    isLocal: true,
                    type: notificationData.type
                },
                sound: 'default',
                badge: unreadCount + 1,
            };

            // Platform specific settings
            if (Platform.OS === 'ios') {
                content.subtitle = notificationData.type === 'order' ? 'Order Update' : 'Notification';
                content.categoryIdentifier = notificationData.type || 'general';
            }

            if (Platform.OS === 'android') {
                content.android = {
                    channelId: 'default',
                    priority: 'high',
                    vibrate: [0, 250, 250, 250],
                    color: '#FF231F7C',
                };
            }

            // Schedule notification
            await Notifications.scheduleNotificationAsync({
                content,
                trigger: null,
                identifier: notificationId
            });

            // Add to local state
            addToLocalNotifications({
                _id: notificationId,
                title: notificationData.title,
                message: notificationData.message,
                type: notificationData.type,
                data: notificationData.data,
                read: false,
                isLocal: true,
                createdAt: new Date().toISOString()
            });

            return notificationId;

        } catch (error) {
            console.log('Error generating notification:', error.message);
            return null;
        }
    };

    // ------------------------------------------------------------
    // 2. ADD TO LOCAL NOTIFICATIONS
    // ------------------------------------------------------------
    const addToLocalNotifications = (notification) => {
        setNotifications(prev => {
            // Check if notification already exists
            const exists = prev.find(n => n._id === notification._id);
            if (exists) return prev;

            const newNotifications = [notification, ...prev];
            return newNotifications;
        });
    };

    // ------------------------------------------------------------
    // 3. CHECK AND GENERATE NOTIFICATIONS FOR UNREAD ITEMS
    // ------------------------------------------------------------
    const checkAndGenerateNotifications = async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            // Fetch notifications from backend

            const backendNotifications = await getUserUnReadNotifications(userId);


            let notificationsList = [];

            // Handle response structure
            if (Array.isArray(backendNotifications)) {
                notificationsList = backendNotifications;
            } else if (backendNotifications?.data && Array.isArray(backendNotifications.data)) {
                notificationsList = backendNotifications.data;
            } else if (backendNotifications?.notifications && Array.isArray(backendNotifications.notifications)) {
                notificationsList = backendNotifications.notifications;
            }

            if (notificationsList.length === 0) {
                setHasUnreadNotifications(false);
                return;
            }

            // Check for unread notifications
            const unreadNotifications = notificationsList.filter(n => !n.read);

            if (unreadNotifications.length > 0) {
                setHasUnreadNotifications(true);

                // Generate local notifications for unread items
                for (const backendNotification of unreadNotifications) {
                    // Check if this notification already exists in local state
                    const exists = notifications.find(n => n._id === backendNotification._id);

                    if (!exists) {

                        // Generate local notification
                        await sendLocalNotification({
                            title: backendNotification.title || 'Notification',
                            message: backendNotification.message || backendNotification.body || '',
                            type: backendNotification.type || 'general',
                            data: backendNotification.data || {},
                            priority: backendNotification.priority || 'medium'
                        });

                        // Mark as read in backend after showing notification
                        await markNotificationAsReadInBackend(backendNotification._id);
                    }
                }
            } else {
                setHasUnreadNotifications(false);
            }

        } catch (error) {
            console.log('Error checking notifications:', error.message);
        }
    };

    // ------------------------------------------------------------
    // 4. MARK NOTIFICATION AS READ IN BACKEND
    // ------------------------------------------------------------
    const markNotificationAsReadInBackend = async (notificationId) => {
        try {
            await apiMarkAsRead(notificationId);
        } catch (error) {
            console.log('Error marking as read in backend:', error.message);
        }
    };

    // ------------------------------------------------------------
    // 5. SETUP NOTIFICATION LISTENERS
    // ------------------------------------------------------------
    const setupNotificationListeners = () => {
        // Remove existing listeners
        if (notificationListener.current) {
            notificationListener.current.remove();
        }
        if (responseListener.current) {
            responseListener.current.remove();
        }

        // User tapped notification listener
        responseListener.current = Notifications.addNotificationResponseReceivedListener(
            async (response) => {
                const data = response.notification.request.content.data;

                // Mark as read if it has an ID
                if (data?.notificationId) {
                    markAsRead(data.notificationId);
                }

                // Handle navigation
                await handleNavigation(data);
            }
        );
    };

    // ------------------------------------------------------------
    // 6. GET USER ID
    // ------------------------------------------------------------
    const getCurrentUserId = async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            if (!userData) return null;
            const parsed = JSON.parse(userData);
            return parsed?.id || parsed?._id || null;
        } catch (error) {
            console.log('Get user ID error:', error.message);
            return null;
        }
    };

    // ------------------------------------------------------------
    // 7. FETCH AND UPDATE NOTIFICATIONS
    // ------------------------------------------------------------
    const fetchAndUpdateNotifications = useCallback(async (isRefreshing = false, showLoader = true) => {
        try {
            if (showLoader) {
                isRefreshing ? setRefreshing(true) : setLoading(true);
            }

            setError(null);

            const userId = await getCurrentUserId();
            if (!userId) {
                throw new Error('Please login to view notifications');
            }


            const response = await getUserUnReadNotifications(userId);


            let notificationsList = [];

            // Handle response structure
            if (Array.isArray(response)) {
                notificationsList = response;
            } else if (response?.data && Array.isArray(response.data)) {
                notificationsList = response.data;
            } else if (response?.notifications && Array.isArray(response.notifications)) {
                notificationsList = response.notifications;
            }

            // Sort by date (newest first)
            notificationsList.sort((a, b) =>
                new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
            );

            setNotifications(notificationsList);
            setLastUpdated(new Date());

            // Calculate unread count
            const unreadCount = notificationsList.filter(n => !n.read).length;
            setUnreadCount(unreadCount);

            // Update hasUnreadNotifications state
            setHasUnreadNotifications(unreadCount > 0);


            // Automatically generate notifications for unread items
            if (unreadCount > 0) {
                await checkAndGenerateNotifications();
            }

        } catch (err) {
            setError(err.message || 'Failed to load notifications');
            console.log('Fetch error:', err.message);
        } finally {
            if (showLoader) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    // ------------------------------------------------------------
    // 8. MARK AS READ (Local and Backend)
    // ------------------------------------------------------------
    const markAsRead = async (notificationId) => {
        try {
            // Optimistic update
            setNotifications(prev =>
                prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
            );

            // Update count
            const newCount = Math.max(0, unreadCount - 1);
            setUnreadCount(newCount);

            // Only call API for non-local notifications
            if (!notificationId.startsWith('local_')) {
                await apiMarkAsRead(notificationId);
            }

            // Update hasUnread state
            if (newCount === 0) {
                setHasUnreadNotifications(false);
            }


        } catch (error) {
            console.log('Mark read error:', error.message);
            fetchAndUpdateNotifications(false, false);
        }
    };

    // ------------------------------------------------------------
    // 9. MARK ALL AS READ
    // ------------------------------------------------------------
    const markAllAsRead = async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            setHasUnreadNotifications(false);

            // API call
            await apiMarkAllAsRead(userId);

            Alert.alert('Success', 'All notifications marked as read');

        } catch (error) {
            console.log('Mark all error:', error.message);
            Alert.alert('Error', 'Failed to mark all as read');
        }
    };

    // ------------------------------------------------------------
    // 10. DELETE NOTIFICATION
    // ------------------------------------------------------------
    const deleteNotification = async (notificationId) => {
        try {
            // Update count if unread
            const notification = notifications.find(n => n._id === notificationId);
            if (notification && !notification.read) {
                const newCount = Math.max(0, unreadCount - 1);
                setUnreadCount(newCount);

                if (newCount === 0) {
                    setHasUnreadNotifications(false);
                }
            }

            // Optimistic removal
            setNotifications(prev => prev.filter(n => n._id !== notificationId));

            // Only call API for non-local notifications
            if (!notificationId.startsWith('local_')) {
                await apiDeleteNotification(notificationId);
            }


        } catch (error) {
            console.log('Delete error:', error.message);
            Alert.alert('Error', 'Failed to delete notification');
        }
    };

    // ------------------------------------------------------------
    // 11. HANDLE NOTIFICATION PRESS
    // ------------------------------------------------------------
    const handleNotificationPress = (notification) => {
        if (!notification) return;
        // // Mark as read
        // if (!notification.read) handleMarkAsRead(notification._id);

        let targetScreen = '/Home';

        if (notification.data?.screen) {
            const screen = notification.data.screen;

            // Custom rules
            if (screen === 'OrderDetails') {
                targetScreen = '/screens/MyOrderScreen';
            }
            else if (screen === 'NegotiationDetails') {

                // Check if it's a negotiation approval with cart
                if (notification.data.action === 'load_cart' && notification.data.cartId) {
                    // Navigate to cart tab with parameters
                    const params = new URLSearchParams();
                    params.append('cartId', notification.data.cartId);
                    params.append('sessionId', notification.data.sessionId);
                    params.append('action', 'load_cart');
                    if (notification.data.negotiationId) {
                        params.append('negotiationId', notification.data.negotiationId);
                    }
                    // Navigate to cart tab (assuming it's /cart or /(tabs)/cart)
                    targetScreen = `/screens/CartScreen?${params.toString()}`;
                } else {
                    targetScreen = '/screens/CartScreen';
                }
            }
            else if (screen === 'ReturnDetails') {
                targetScreen = '/screens/MyOrderScreen';
            }
            else {
                targetScreen = `/screens/${screen}`;
            }

            // Append extra params
            const params = new URLSearchParams();
            Object.entries(notification.data).forEach(([key, value]) => {
                if (key !== 'screen' && value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });

            const queryString = params.toString();
            const url = queryString ? `${targetScreen}?${queryString}` : targetScreen;

            router.replace(url);
        } else {
            router.push(targetScreen);
        }
    };


    const handleNavigation = useCallback(async (data) => {
        if (!data?.screen) {

            router.push('/screens/NotificationScreen');
            return;
        }

        // Handle negotiation approval with cart loading
        if (data.action === 'load_cart' && data.cartId && data.sessionId) {
            // Navigate to cart tab with notification parameters
            const params = new URLSearchParams();
            params.append('cartId', data.cartId);
            params.append('sessionId', data.sessionId);
            params.append('action', 'load_cart');
            if (data.negotiationId) params.append('negotiationId', data.negotiationId);

            // Navigate to cart tab (assuming it's in tabs)
            router.replace(`/Cart?${params.toString()}`);
            return;
        }

        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'screen' && value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });

        const queryString = params.toString();
        const url = `/screens/${data.screen}${queryString ? `?${queryString}` : ''}`;

        router.replace(url);
    }, [router]);


    const startPolling = () => {
        // Clear existing interval
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }


        // Check every 15 seconds when app is active
        pollIntervalRef.current = setInterval(() => {
            if (AppState.currentState === 'active') {
                console.log('Automatic check for notifications');
                fetchAndUpdateNotifications(false, false);
            }
        }, 5000);
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    const setupNotifications = async () => {
        try {
            // Request permissions
            const { status } = await Notifications.getPermissionsAsync();
            setPermissionGranted(status === 'granted');

            if (status === 'granted') {
                // Configure Android channel
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'Default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C',
                        enableVibrate: true,
                        enableLights: true,
                        showBadge: true,
                        sound: 'default',
                    });
                }
            }

        } catch (error) {
            console.log('Notification setup info:', error.message);
        }
    };

    const handleAppStateChange = (nextAppState) => {

        if (nextAppState === 'active') {
            // When app comes to foreground, check for notifications
            fetchAndUpdateNotifications(false, false);
            startPolling();
        } else if (nextAppState === 'background') {
            // When app goes to background, stop polling
            stopPolling();
        }
    };

    useEffect(() => {

        // Initial setup
        setupNotifications();
        setupNotificationListeners();

        appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

        fetchAndUpdateNotifications();

        // Start polling
        startPolling();

        return () => {

            // Cleanup
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
            if (appStateSubscription.current) {
                appStateSubscription.current.remove();
            }
            stopPolling();
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchAndUpdateNotifications(false, false);
        }, [])
    );

    return {

        notifications,
        loading,
        refreshing,
        error,
        permissionGranted,
        unreadCount,
        lastUpdated,
        hasUnreadNotifications,

        // Actions
        refresh: () => fetchAndUpdateNotifications(true, true),
        fetchNotifications: fetchAndUpdateNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        handleNotificationPress,
        handleNavigation,

        // Helper functions
        hasUnread: unreadCount > 0,
    };
};

export default useNotifications;
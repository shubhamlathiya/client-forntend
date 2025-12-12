import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    Pressable,
    Alert,
    RefreshControl,
    StyleSheet,
    SafeAreaView,
    AppState,
    Platform,
    StatusBar,
    Image,
    Dimensions,
    Linking,
    ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} from '../../api/notificationApi';
import * as Notifications from "expo-notifications";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Check if device has notch (iPhone X and above)
const hasNotch = Platform.OS === 'ios' && (screenHeight >= 812 || screenWidth >= 812);

// Safe area insets for different devices
const getSafeAreaInsets = () => {
    if (Platform.OS === 'ios') {
        if (hasNotch) {
            return {
                top: 44, // Status bar + notch area
                bottom: 34 // Home indicator area
            };
        }
        return {
            top: 20, // Regular status bar
            bottom: 0
        };
    }
    // Android
    return {
        top: StatusBar.currentHeight || 25,
        bottom: 0
    };
};

const safeAreaInsets = getSafeAreaInsets();

// Responsive size calculator with constraints
const RF = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    const normalizedSize = size * Math.min(scale, 1.5); // Max 1.5x scaling for tablets
    return Math.round(normalizedSize);
};

const RH = (size) => {
    const scale = screenHeight / 812; // 812 is standard iPhone height
    return Math.round(size * Math.min(scale, 1.5));
};

// Check if device is tablet
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;
const isSmallPhone = screenWidth <= 320;

// Responsive width percentage
const responsiveWidth = (percentage) => {
    return Math.round((screenWidth * percentage) / 100);
};

// Responsive height percentage (excluding safe areas)
const responsiveHeight = (percentage) => {
    const availableHeight = screenHeight - safeAreaInsets.top - safeAreaInsets.bottom;
    return Math.round((availableHeight * percentage) / 100);
};

export default function NotificationScreen() {
    const router = useRouter();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasPermission, setHasPermission] = useState(false);
    const [navigatingToCart, setNavigatingToCart] = useState(false);

    const appState = useRef(AppState.currentState);
    const pollIntervalRef = useRef();

    // Get current user ID
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

    const requestNotificationPermission = async () => {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            Alert.alert(
                'Permission Needed',
                'Please enable notifications in settings to receive updates.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Grant',
                        onPress: async () => {
                            if (Platform.OS === 'ios') {
                                await Notifications.requestPermissionsAsync();
                            } else {
                                Linking.openSettings();
                            }
                        },
                    },
                ],
                { cancelable: false }
            );
            return false;
        }

        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
                name: "Default",
                importance: Notifications.AndroidImportance.MAX,
            });
        }

        setHasPermission(true);
        console.log("Notification permission granted");
    };

    // Fetch notifications
    const fetchNotifications = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            setError(null);

            const userId = await getCurrentUserId();
            if (!userId) throw new Error('Please login to view notifications');

            const response = await getUserNotifications(userId);
            let notificationsList = [];
            if (Array.isArray(response)) notificationsList = response;
            else if (response?.data && Array.isArray(response.data)) notificationsList = response.data;
            else if (response?.notifications && Array.isArray(response.notifications)) notificationsList = response.notifications;

            // Sort newest first
            notificationsList.sort((a, b) =>
                new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
            );

            setNotifications(notificationsList);
            const unread = notificationsList.filter(n => !n.read).length;
            setUnreadCount(unread);
        } catch (err) {
            setError(err.message || 'Failed to load notifications');
            console.log('❌ Fetch error:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Mark single notification as read
    const handleMarkAsRead = async (notificationId) => {
        try {
            setNotifications(prev =>
                prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));

            if (!notificationId.startsWith('local_')) {
                await markNotificationAsRead(notificationId);
            }
        } catch (err) {
            console.log('❌ Error marking notification read:', err.message);
        }
    };

    // Mark all notifications as read
    const handleMarkAllAsRead = async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);

            await markAllNotificationsAsRead(userId);
            Alert.alert('Success', 'All notifications marked as read');
        } catch (err) {
            console.log('❌ Error marking all notifications read:', err.message);
            Alert.alert('Error', 'Failed to mark all as read');
        }
    };

    // Handle navigation to cart with notification context
    const navigateToCartWithNotification = async (notification) => {
        try {
            setNavigatingToCart(true);

            const { data } = notification;
            console.log("🎯 Navigating to cart with notification data:", data);

            // Always mark as read first
            if (!notification.read) {
                await handleMarkAsRead(notification._id);
            }

            // Save notification context for CartScreen
            if (data.cartId && data.sessionId) {
                // Store notification context for CartScreen to pick up
                await AsyncStorage.setItem('notification_cart_id', data.cartId);
                await AsyncStorage.setItem('notification_session_id', data.sessionId);
                if (data.negotiationId) {
                    await AsyncStorage.setItem('notification_negotiation_id', data.negotiationId);
                }
                await AsyncStorage.setItem('notification_action', 'load_cart');
                await AsyncStorage.setItem('notification_source', 'notification_screen');

                console.log("💾 Saved notification context for CartScreen");
            }

            // Build navigation params
            const params = {
                action: 'load_cart',
                cartId: data.cartId,
                sessionId: data.sessionId,
                ...(data.negotiationId && { negotiationId: data.negotiationId }),
                ...(data.negotiationNumber && { negotiationNumber: data.negotiationNumber }),
                ...(data.status && { status: data.status }),
                ...(data.totalAmount && { totalAmount: data.totalAmount.toString() }),
                source: 'notification'
            };

            // Navigate to CartScreen with params
            router.push({
                pathname: '/Cart',
                params: params
            });

        } catch (error) {
            console.error('Error navigating to cart:', error);
            Alert.alert('Error', 'Failed to load the negotiated cart');

            // Fallback to regular cart
            router.push('/Cart');
        } finally {
            setNavigatingToCart(false);
        }
    };

    // Handle notification press
    const handleNotificationPress = async (notification) => {
        if (!notification) return;

        console.log("📱 Notification pressed:", {
            id: notification._id,
            type: notification.type,
            data: notification.data,
            action: notification.data?.action
        });

        // Handle different notification types
        if (notification.data?.action === 'load_cart' &&
            notification.data?.cartId &&
            notification.data?.sessionId) {

            // This is a negotiation approval notification - navigate to cart
            await navigateToCartWithNotification(notification);
            return;
        }

        // Default handling for other notification types
        if (!notification.read) {
            await handleMarkAsRead(notification._id);
        }

        let targetScreen = '/Home';
        let params = {};

        if (notification.data?.screen) {
            const screen = notification.data.screen;

            // Handle different screen types
            switch (screen) {
                case 'OrderDetails':
                    targetScreen = '/screens/MyOrderScreen';
                    if (notification.data.orderId) {
                        params = { orderId: notification.data.orderId };
                    }
                    break;

                case 'NegotiationDetails':
                    targetScreen = '/Cart';
                    // For negotiation details without cart loading
                    if (notification.data.negotiationId) {
                        params = {
                            negotiationId: notification.data.negotiationId,
                            action: 'view_negotiation'
                        };
                    }
                    break;

                case 'ReturnDetails':
                    targetScreen = '/screens/MyOrderScreen';
                    if (notification.data.returnId) {
                        params = { returnId: notification.data.returnId, tab: 'returns' };
                    }
                    break;

                case 'ProductDetail':
                    targetScreen = '/screens/ProductDetailScreen';
                    if (notification.data.productId) {
                        params = { id: notification.data.productId };
                    }
                    break;

                default:
                    targetScreen = `/screens/${screen}`;
                    // Pass all other data as params
                    Object.entries(notification.data).forEach(([key, value]) => {
                        if (key !== 'screen' && value !== undefined && value !== null) {
                            params[key] = String(value);
                        }
                    });
            }
        }

        console.log(`🚀 Navigating to: ${targetScreen}`, params);
        router.push({
            pathname: targetScreen,
            params: params
        });
    };

    // Delete notification
    const handleDeleteNotification = async (notificationId) => {
        Alert.alert(
            'Delete Notification',
            'Are you sure you want to delete this notification?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setNotifications(prev => prev.filter(n => n._id !== notificationId));
                            const deletedNotification = notifications.find(n => n._id === notificationId);
                            if (deletedNotification && !deletedNotification.read) {
                                setUnreadCount(prev => Math.max(0, prev - 1));
                            }
                            await deleteNotification(notificationId);
                        } catch (err) {
                            console.log('Error deleting notification:', err.message);
                        }
                    }
                }
            ]
        );
    };

    // Polling
    const startPolling = () => {
        pollIntervalRef.current = setInterval(() => {
            if (appState.current === 'active') fetchNotifications(false);
        }, 15000);
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };

    // AppState listener
    const handleAppStateChange = (nextAppState) => {
        appState.current = nextAppState;
        if (nextAppState === 'active') fetchNotifications(false);
    };

    useEffect(() => {
        requestNotificationPermission();
        fetchNotifications();
        startPolling();
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            stopPolling();
            subscription.remove();
        };
    }, []);

    // Format time
    const formatTime = (dateString) => {
        if (!dateString) return 'Recently';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Recently';

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Get icon background color
    const getIconBackgroundColor = (notification) => {
        if (notification.data?.action === 'load_cart') {
            return '#34C759'; // Green for approved negotiations
        }

        switch (notification.type) {
            case 'order':
                return '#007AFF';
            case 'negotiation':
                return '#5856D6';
            case 'promotion':
                return '#FF9500';
            case 'system':
                return '#8E8E93';
            default:
                return '#007AFF';
        }
    };

    // Render notification item
    const renderNotificationItem = ({ item }) => (
        <Pressable
            style={[styles.notificationItem, !item.read && styles.unreadItem]}
            onPress={() => handleNotificationPress(item)}
            onLongPress={() => handleDeleteNotification(item._id)}
            activeOpacity={0.7}
            disabled={navigatingToCart}
        >

            {/* Content Section */}
            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>
                        {item.title || 'Notification'}
                    </Text>
                    <Text style={styles.notificationTime}>
                        {formatTime(item.createdAt)}
                    </Text>
                </View>

                <Text style={styles.notificationMessage} numberOfLines={2}>
                    {item.message}
                </Text>

                {/* Action Indicator */}
                {item.data?.action === 'load_cart' && (
                    <View style={styles.actionIndicator}>
                        <Text style={styles.actionIndicatorText}>
                            🛒 Tap to view negotiated cart
                        </Text>
                    </View>
                )}

                {/* Type Badge */}
                {item.type && (
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>
                            {item.type === 'negotiation' ? 'Negotiation' :
                                item.type === 'order' ? 'Order' :
                                    item.type === 'promotion' ? 'Promotion' :
                                        item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Unread Dot */}
            {!item.read && <View style={styles.unreadDot} />}
        </Pressable>
    );

    // Render empty state
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Image
                source={require('../../assets/icons/notification.png')}
                style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
                When you get notifications about orders, negotiations, or promotions, they'll appear here
            </Text>

            {!hasPermission && (
                <Pressable style={styles.permissionButton} onPress={requestNotificationPermission}>
                    <Text style={styles.permissionButtonText}>🔔 Enable Notifications</Text>
                </Pressable>
            )}

            <Pressable
                style={styles.refreshButton}
                onPress={() => fetchNotifications(true)}
                activeOpacity={0.7}
            >
                <Text style={styles.refreshButtonText}>Refresh</Text>
            </Pressable>
        </View>
    );

    // Render header
    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
            <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}
                hitSlop={{ top: RF(10), bottom: RF(10), left: RF(10), right: RF(10) }}
                disabled={navigatingToCart}
            >
                <Image
                    source={require("../../assets/icons/back_icon.png")}
                    style={styles.backIcon}
                />
            </Pressable>

            <Text style={styles.headerTitle}>Notifications</Text>

            {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                </View>
            )}

            <View style={styles.headerPlaceholder} />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {renderHeader()}

            {/* Mark All Read Button */}
            {unreadCount > 0 && !navigatingToCart && (
                <Pressable
                    style={styles.markAllButton}
                    onPress={handleMarkAllAsRead}
                    activeOpacity={0.7}
                    disabled={navigatingToCart}
                >
                    <Image
                        source={require('../../assets/icons/eye_open.png')}
                        style={styles.markAllIcon}
                    />
                    <Text style={styles.markAllText}>Mark All Read</Text>
                </Pressable>
            )}

            {/* Loading Overlay for Cart Navigation */}
            {navigatingToCart && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContent}>
                        <ActivityIndicator size="large" color="#4CAD73" />
                        <Text style={styles.loadingMessage}>Loading negotiated cart...</Text>
                    </View>
                </View>
            )}

            {/* Notifications List */}
            <FlatList
                data={notifications}
                renderItem={renderNotificationItem}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchNotifications(true)}
                        colors={['#FF6B35']}
                        tintColor="#FF6B35"
                    />
                }
                ListEmptyComponent={!loading && renderEmptyState()}
                ListHeaderComponent={
                    loading && notifications.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#4CAD73" />
                            <Text style={styles.loadingText}>Loading Notifications...</Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: RF(16),
        paddingBottom: RF(12),
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8ECF4',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    backButton: {
        width: RF(40),
        height: RF(40),
        borderRadius: RF(20),
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        width: RF(24),
        height: RF(24),
        tintColor: '#1A1A1A',
    },
    headerTitle: {
        fontSize: RF(18),
        fontFamily: 'System',
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: -0.5,
    },
    headerBadge: {
        position: 'absolute',
        right: RF(60),
        backgroundColor: '#FF3B30',
        borderRadius: RF(10),
        width: RF(20),
        height: RF(20),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    headerBadgeText: {
        color: '#FFFFFF',
        fontSize: RF(10),
        fontWeight: '700',
    },
    headerPlaceholder: {
        width: RF(40),
    },
    markAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: RF(16),
        marginTop: RF(12),
        marginBottom: RF(8),
        paddingVertical: RF(12),
        paddingHorizontal: RF(20),
        borderRadius: RF(12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E8ECF4',
    },
    markAllIcon: {
        width: RF(18),
        height: RF(18),
        tintColor: '#5856D6',
        marginRight: RF(8),
    },
    markAllText: {
        fontSize: RF(14),
        fontWeight: '600',
        color: '#5856D6',
        letterSpacing: -0.3,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingContent: {
        backgroundColor: '#FFFFFF',
        padding: RF(24),
        borderRadius: RF(16),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    loadingMessage: {
        marginTop: RF(12),
        fontSize: RF(14),
        color: '#1A1A1A',
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: responsiveHeight(5),
        paddingHorizontal: RF(16),
        paddingTop: RF(8),
    },
    notificationItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: RF(16),
        marginBottom: RF(12),
        padding: RF(16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    unreadItem: {
        backgroundColor: '#F0F7FF',
        borderColor: '#007AFF',
        borderWidth: 1,
    },
    iconContainer: {
        width: RF(48),
        height: RF(48),
        borderRadius: RF(14),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: RF(12),
    },
    notificationIcon: {
        width: RF(24),
        height: RF(24),
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: RF(8),
    },
    notificationTitle: {
        fontSize: RF(15),
        fontWeight: '600',
        color: '#1A1A1A',
        flex: 1,
        marginRight: RF(8),
        lineHeight: RF(20),
    },
    unreadTitle: {
        color: '#007AFF',
    },
    notificationTime: {
        fontSize: RF(12),
        color: '#8E8E93',
        fontWeight: '500',
    },
    notificationMessage: {
        fontSize: RF(14),
        color: '#3C3C43',
        lineHeight: RF(20),
        marginBottom: RF(12),
    },
    actionIndicator: {
        backgroundColor: '#34C75915',
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        borderRadius: RF(8),
        alignSelf: 'flex-start',
        marginBottom: RF(12),
    },
    actionIndicatorText: {
        fontSize: RF(12),
        color: '#34C759',
        fontWeight: '600',
    },
    typeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(120, 120, 128, 0.12)',
        paddingHorizontal: RF(10),
        paddingVertical: RF(4),
        borderRadius: RF(12),
    },
    typeText: {
        fontSize: RF(11),
        color: '#3C3C43',
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    unreadDot: {
        position: 'absolute',
        top: RF(16),
        right: RF(16),
        width: RF(8),
        height: RF(8),
        borderRadius: RF(4),
        backgroundColor: '#007AFF',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: responsiveHeight(15),
        paddingHorizontal: RF(40),
    },
    emptyIcon: {
        width: RF(120),
        height: RF(120),
        marginBottom: RF(24),
        opacity: 0.7,
    },
    emptyTitle: {
        fontSize: RF(18),
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: RF(8),
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: RF(14),
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: RF(20),
        marginBottom: RF(24),
    },
    permissionButton: {
        backgroundColor: '#FF6B35',
        paddingHorizontal: RF(24),
        paddingVertical: RF(14),
        borderRadius: RF(12),
        marginBottom: RF(16),
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontWeight: '600',
    },
    refreshButton: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: RF(32),
        paddingVertical: RF(12),
        borderRadius: RF(12),
        borderWidth: 1,
        borderColor: '#E8ECF4',
    },
    refreshButtonText: {
        color: '#007AFF',
        fontSize: RF(14),
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: RF(40),
    },
    loadingText: {
        marginTop: RF(12),
        fontSize: RF(14),
        color: '#8E8E93',
        fontWeight: '500',
    },
});
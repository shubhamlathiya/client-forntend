import React, {useMemo, useCallback} from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Image,
    RefreshControl,
    Alert,
    Platform
} from "react-native";
import {useRouter} from "expo-router";
import useNotifications from "../../hooks/useNotifications";
import * as Notifications from "expo-notifications";
import * as Device from 'expo-device';

export default function NotificationScreen() {
    const router = useRouter();
    const {
        notifications,
        unreadCount,
        loading,
        refreshing,
        error,
        refresh,
        markOneAsRead,
        markAllAsRead,
        fetchNotifications
    } = useNotifications();

    // Check if we're in Expo Go
    const isExpoGo = useMemo(() => {
        return Constants?.appOwnership === 'expo';
    }, []);

    // Set notification handler at the top level
    React.useEffect(() => {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
            }),
        });
    }, []);

    // Refresh when screen comes into focus
    React.useEffect(() => {
        let isMounted = true;

        const setupNotifications = async () => {
            if (!isExpoGo) {
                await registerForPushNotifications();
            }
            if (isMounted) {
                fetchNotifications();
            }
        };

        setupNotifications();

        const subscription = Notifications.addNotificationReceivedListener(notification => {
            console.log("Received in foreground:", notification);
            if (isMounted) {
                fetchNotifications();
            }
        });

        const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            console.log("User tapped notification:", response);
        });

        return () => {
            isMounted = false;
            subscription.remove();
            responseListener.remove();
        };
    }, [fetchNotifications, isExpoGo]);

    const registerForPushNotifications = useCallback(async () => {
        try {
            // Skip in Expo Go
            if (isExpoGo) {
                console.log("Skipping push notification registration in Expo Go");
                return;
            }

            let { status } = await Notifications.getPermissionsAsync();

            if (status !== "granted") {
                const permission = await Notifications.requestPermissionsAsync();
                status = permission.status;
            }

            if (status !== "granted") {
                Alert.alert("Permission required", "Enable notification permissions to receive alerts");
                return;
            }

            // Get Expo Push Token
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            console.log("Expo Push Token:", token);

            // Send token to your backend here (optional)
            // await saveDeviceToken(token);

            if (Platform.OS === "android") {
                await Notifications.setNotificationChannelAsync("default", {
                    name: "default",
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: "#FF231F7C",
                });
            }

        } catch (error) {
            console.log("Notification register error:", error);
        }
    }, [isExpoGo]);

    const handleBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    }, [router]);

    const formatDate = useCallback((value) => {
        if (!value) return "";
        try {
            const d = new Date(value);
            if (isNaN(d.getTime())) return String(value);

            const now = new Date();
            const diffInMs = now - d;
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
            const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

            if (diffInMinutes < 1) return "Just now";
            if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
            if (diffInHours < 24) return `${diffInHours}h ago`;
            if (diffInDays < 7) return `${diffInDays}d ago`;

            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: diffInDays >= 365 ? 'numeric' : undefined
            });
        } catch {
            return String(value);
        }
    }, []);

    const getNotificationIcon = useCallback((type) => {
        switch (type) {
            case 'order':
                return require('../../assets/icons/order.png');
            case 'promotion':
                return require('../../assets/icons/ticket-discount.png');
            case 'system':
                return require('../../assets/icons/info.png');
            default:
                return require('../../assets/icons/notification.png');
        }
    }, []);

    const getTemplate = useCallback((n) => {
        return n.template || n.text || n.message || n.title || "New notification";
    }, []);

    const getId = useCallback((n) => {
        return n.id || n._id || Math.random().toString();
    }, []);

    const unread = useMemo(() => notifications.filter((n) => !n.read), [notifications]);
    const read = useMemo(() => notifications.filter((n) => !!n.read), [notifications]);

    const NotificationCard = React.useCallback(({item}) => {
        const isUnread = !item.read;

        const handlePress = useCallback(() => {
            const id = getId(item);
            if (id) markOneAsRead(id);
        }, [item, markOneAsRead, getId]);

        return (
            <TouchableOpacity
                style={[styles.card, isUnread ? styles.cardUnread : styles.cardRead]}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <View style={styles.cardContent}>
                    <Image
                        source={getNotificationIcon(item.type)}
                        style={styles.notificationIcon}
                    />
                    <View style={styles.cardTextContent}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, isUnread ? styles.cardTitleUnread : null]}>
                                {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Notification'}
                            </Text>
                            <View style={styles.headerRight}>
                                {isUnread && <View style={styles.unreadDot}/>}
                                <Text style={styles.cardDate}>{formatDate(item.createdAt || item.date)}</Text>
                            </View>
                        </View>
                        <Text style={styles.cardBody}>{getTemplate(item)}</Text>
                        {item.orderId && (
                            <Text style={styles.cardOrder}>Order #: {String(item.orderId)}</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    }, [getNotificationIcon, getTemplate, formatDate, markOneAsRead, getId]);

    const handleMarkAllAsRead = useCallback(() => {
        if (unreadCount > 0) {
            Alert.alert(
                "Mark All as Read",
                "Are you sure you want to mark all notifications as read?",
                [
                    {text: "Cancel", style: "cancel"},
                    {text: "Mark All", onPress: markAllAsRead}
                ]
            );
        }
    }, [unreadCount, markAllAsRead]);

    const handleRefresh = useCallback(() => {
        refresh();
    }, [refresh]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>

            {/* Expo Go Warning Banner */}
            {isExpoGo && (
                <View style={styles.expoGoWarning}>
                    <Text style={styles.expoGoWarningText}>
                        🔔 Push notifications are limited in Expo Go. Use a development build for full functionality.
                    </Text>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={handleBack}>
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.markAllBtn, unreadCount > 0 ? styles.markAllBtnEnabled : styles.markAllBtnDisabled]}
                    onPress={handleMarkAllAsRead}
                    disabled={unreadCount === 0}
                >
                    <Text
                        style={[styles.markAllText, unreadCount > 0 ? styles.markAllTextEnabled : styles.markAllTextDisabled]}>
                        {unreadCount > 0 ? `Mark all as read (${unreadCount})` : "All caught up!"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#EC0505']}
                        tintColor="#EC0505"
                    />
                }
            >
                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* Unread Section */}
                {unread.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Unread</Text>
                        </View>
                        <View style={styles.sectionContent}>
                            {unread.map((n) => (
                                <NotificationCard key={String(getId(n))} item={n}/>
                            ))}
                        </View>
                    </View>
                )}

                {/* Read Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {read.length > 0 ? 'Earlier' : 'No notifications yet'}
                        </Text>
                    </View>
                    <View style={styles.sectionContent}>
                        {read.length === 0 && !loading ? (
                            <View style={styles.emptyState}>
                                <Image
                                    source={require('../../assets/icons/bell.png')}
                                    style={styles.emptyIcon}
                                />
                                <Text style={styles.emptyTitle}>No notifications</Text>
                                <Text style={styles.emptySubtitle}>
                                    We'll notify you when something new arrives
                                </Text>
                                {isExpoGo && (
                                    <Text style={styles.expoGoHint}>
                                        Note: Local notifications work, but push notifications require a development build
                                    </Text>
                                )}
                            </View>
                        ) : (
                            read.map((n) => <NotificationCard key={String(getId(n))} item={n}/>)
                        )}
                    </View>
                </View>

                {loading && notifications.length === 0 && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading notifications...</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    expoGoWarning: {
        backgroundColor: '#FFF3CD',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#FFEAA7',
    },
    expoGoWarningText: {
        fontSize: 12,
        color: '#856404',
        textAlign: 'center',
        fontWeight: '500',
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backIcon: {
        width: 32,
        height: 32,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1B1B1B',
        flex: 1,
        textAlign: 'center',
        marginLeft: -32,
    },
    unreadBadge: {
        backgroundColor: '#EC0505',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    actionsRow: {
        paddingHorizontal: 16,
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    markAllBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    markAllBtnEnabled: {
        backgroundColor: '#EC0505',
    },
    markAllBtnDisabled: {
        backgroundColor: '#F5F5F5',
    },
    markAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    markAllTextEnabled: {
        color: '#FFFFFF',
    },
    markAllTextDisabled: {
        color: '#999',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#666",
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionContent: {
        paddingHorizontal: 16,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardUnread: {
        backgroundColor: '#FFF8E1',
        borderLeftWidth: 4,
        borderLeftColor: '#FFD700',
    },
    cardRead: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    notificationIcon: {
        width: 20,
        height: 20,
        marginRight: 12,
        tintColor: '#666',
    },
    cardTextContent: {
        flex: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EC0505',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        flex: 1,
    },
    cardTitleUnread: {
        color: '#EC0505',
    },
    cardDate: {
        fontSize: 12,
        color: '#999',
    },
    cardBody: {
        fontSize: 14,
        color: '#1B1B1B',
        lineHeight: 20,
        marginBottom: 4,
    },
    cardOrder: {
        fontSize: 12,
        color: '#218D96',
        fontWeight: '500',
    },
    errorBox: {
        padding: 16,
        backgroundColor: '#FFE8E8',
        margin: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#DC1010',
        textAlign: 'center',
        marginBottom: 8,
    },
    retryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#EC0505',
        borderRadius: 6,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        marginBottom: 16,
        opacity: 0.5,
        tintColor: '#666',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginBottom: 8,
    },
    expoGoHint: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: '#666',
    },
});
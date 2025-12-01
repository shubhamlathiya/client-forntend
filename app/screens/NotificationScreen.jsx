import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Alert,
    RefreshControl,
    StyleSheet,
    SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import useNotifications from '../../hooks/useNotifications';

const NotificationScreen = () => {
    const router = useRouter();
    const {
        notifications,
        loading,
        refreshing,
        error,
        unreadCount,
        permissionGranted,
        refresh,
        markAllAsRead,

        handleNotificationPress
    } = useNotifications();

    const renderNotificationItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.notificationItem,
                !item.read && styles.unreadItem
            ]}
            onPress={() => handleNotificationPress(item)}
            onLongPress={() => {
                Alert.alert(
                    'Notification',
                    item.message,
                    [{ text: 'OK' }]
                );
            }}
        >
            <View style={styles.notificationContent}>
                <Text style={[
                    styles.notificationTitle,
                    !item.read && styles.unreadTitle
                ]}>
                    {item.title || 'Notification'}
                </Text>
                <Text style={styles.notificationMessage}>
                    {item.message}
                </Text>
                <Text style={styles.notificationTime}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
                {item.type && (
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>{item.type}</Text>
                    </View>
                )}
            </View>
            {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                )}
            </View>

            {/* Test Buttons */}
            {/*<View style={styles.testButtons}>*/}
            {/*    <TouchableOpacity*/}
            {/*        style={styles.testButton}*/}
            {/*        onPress={() => sendTestNotification('general')}*/}
            {/*    >*/}
            {/*        <Text style={styles.testButtonText}>Test with Backend</Text>*/}
            {/*    </TouchableOpacity>*/}

            {/*    <TouchableOpacity*/}
            {/*        style={[styles.testButton, styles.quickButton]}*/}
            {/*        onPress={sendQuickTest}*/}
            {/*    >*/}
            {/*        <Text style={styles.testButtonText}>Quick Local Test</Text>*/}
            {/*    </TouchableOpacity>*/}
            {/*</View>*/}

            {/* Mark All Read */}
            {unreadCount > 0 && (
                <TouchableOpacity
                    style={styles.markAllButton}
                    onPress={markAllAsRead}
                >
                    <Text style={styles.markAllText}>
                        Mark All Read ({unreadCount})
                    </Text>
                </TouchableOpacity>
            )}

            {/* Notifications List */}
            <FlatList
                data={notifications}
                renderItem={renderNotificationItem}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        colors={['#007AFF']}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No notifications</Text>
                        <Text style={styles.emptySubtitle}>
                            When you get notifications, they'll appear here
                        </Text>
                        {!permissionGranted && (
                            <Text style={styles.permissionHint}>
                                🔔 Enable notifications in settings
                            </Text>
                        )}
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    badge: {
        backgroundColor: '#FF3B30',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        minWidth: 24,
        alignItems: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    testButtons: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
    },
    testButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    quickButton: {
        backgroundColor: '#34C759',
    },
    testButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    markAllButton: {
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 10,
        backgroundColor: '#5856D6',
        borderRadius: 8,
        alignItems: 'center',
    },
    markAllText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 20,
    },
    notificationItem: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginVertical: 6,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    unreadItem: {
        backgroundColor: '#F0F8FF',
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    unreadTitle: {
        color: '#007AFF',
    },
    notificationMessage: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 8,
    },
    notificationTime: {
        fontSize: 12,
        color: '#999',
    },
    typeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    typeText: {
        fontSize: 10,
        color: '#666',
        textTransform: 'uppercase',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#007AFF',
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    permissionHint: {
        fontSize: 12,
        color: '#FF9500',
        marginTop: 16,
    },
});

export default NotificationScreen;
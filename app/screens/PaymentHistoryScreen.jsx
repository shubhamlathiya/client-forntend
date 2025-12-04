import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    SectionList,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from "../../utils/apiClient";

const PaymentHistoryScreen = () => {
    const router = useRouter();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalSpent: 0,
        successfulPayments: 0,
        failedPayments: 0,
        pendingPayments: 0
    });

    useEffect(() => {
        loadPaymentHistory();
    }, []);

    const loadPaymentHistory = async () => {
        try {
            setLoading(true);

            const [transactionsResponse] = await Promise.all([
                apiClient.get('/api/transactions?limit=50')
            ]);

            if (transactionsResponse.data.success) {
                const allTransactions = transactionsResponse.data.data;
                setTransactions(allTransactions);

                // Calculate stats
                const statsData = {
                    totalSpent: 0,
                    successfulPayments: 0,
                    failedPayments: 0,
                    pendingPayments: 0
                };

                allTransactions.forEach(transaction => {
                    if (transaction.status === 'success') {
                        statsData.totalSpent += transaction.amount;
                        statsData.successfulPayments++;
                    } else if (transaction.status === 'failed') {
                        statsData.failedPayments++;
                    } else if (transaction.status === 'pending') {
                        statsData.pendingPayments++;
                    }
                });

                setStats(statsData);
            }
        } catch (error) {
            console.error('Error loading payment history:', error);
            alert('Failed to load payment history');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadPaymentHistory();
    };

    const groupTransactionsByDate = (transactionsList) => {
        const grouped = {};

        transactionsList.forEach(transaction => {
            const date = new Date(transaction.createdAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(transaction);
        });

        return Object.keys(grouped).map(date => ({
            title: date,
            data: grouped[date]
        }));
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'success':
                return '#10B981';
            case 'failed':
                return '#EF4444';
            case 'pending':
                return '#F59E0B';
            case 'refund':
                return '#8B5CF6';
            default:
                return '#6B7280';
        }
    };

    const getPaymentMethodIcon = (method) => {
        switch (method?.toLowerCase()) {
            case 'razorpay':
                return 'card';
            case 'wallet':
                return 'wallet';
            case 'card':
                return 'card';
            case 'upi':
                return 'phone-portrait';
            default:
                return 'card';
        }
    };

    const formatAmount = (amount) => {
        return `₹${amount?.toFixed(2) || '0.00'}`;
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderStatsCard = () => (
        <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Payment Overview</Text>

            <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: '#10B98115' }]}>
                        <Ionicons name="trending-up" size={20} color="#10B981" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{formatAmount(stats.totalSpent)}</Text>
                        <Text style={styles.statLabel}>Total Spent</Text>
                    </View>
                </View>

                <View style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: '#10B98115' }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{stats.successfulPayments}</Text>
                        <Text style={styles.statLabel}>Successful</Text>
                    </View>
                </View>

                <View style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: '#F59E0B15' }]}>
                        <Ionicons name="time" size={20} color="#F59E0B" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{stats.pendingPayments}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                </View>

                <View style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: '#EF444415' }]}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{stats.failedPayments}</Text>
                        <Text style={styles.statLabel}>Failed</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderTransactionItem = ({ item }) => (
        <Pressable
            style={styles.historyItem}
            onPress={() => router.push({
                pathname: '/screens/TransactionDetailScreen',
                params: { transactionId: item._id }
            })}
        >
            <View style={styles.historyLeft}>
                <View style={[styles.methodIcon, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                    <Ionicons
                        name={getPaymentMethodIcon(item.paymentMethod)}
                        size={20}
                        color={getStatusColor(item.status)}
                    />
                </View>
                <View style={styles.historyInfo}>
                    <Text style={styles.historyOrder}>
                        {item.orderNumber?.length > 15 ? `${item.orderNumber.substring(0, 15)}...` : item.orderNumber}
                    </Text>
                    <View style={styles.historyDetails}>
                        <Text style={styles.historyMethod}>
                            {item.paymentMethod?.charAt(0).toUpperCase() + item.paymentMethod?.slice(1)}
                        </Text>
                        <Text style={styles.historyTime}>{formatTime(item.createdAt)}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.historyRight}>
                <Text style={styles.historyAmount}>{formatAmount(item.amount)}</Text>
                <View style={[styles.historyStatus, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.historyStatusText}>{item.status}</Text>
                </View>
            </View>
        </Pressable>
    );

    const renderSectionHeader = ({ section: { title } }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
    );

    const groupedData = groupTransactionsByDate(transactions);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </Pressable>
                <Text style={styles.headerTitle}>Payment History</Text>
                <View style={styles.placeholder} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>Loading payment history...</Text>
                </View>
            ) : (
                <SectionList
                    sections={groupedData}
                    keyExtractor={(item) => item._id}
                    renderItem={renderTransactionItem}
                    renderSectionHeader={renderSectionHeader}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#10B981']}
                            tintColor="#10B981"
                        />
                    }
                    ListHeaderComponent={renderStatsCard}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={80} color="#D1D5DB" />
                            <Text style={styles.emptyStateTitle}>No Payment History</Text>
                            <Text style={styles.emptyStateText}>
                                You haven't made any payments yet.
                            </Text>
                            <Pressable
                                style={styles.shopButton}
                                onPress={() => router.push('/Home')}
                            >
                                <Text style={styles.shopButtonText}>Start Shopping</Text>
                            </Pressable>
                        </View>
                    }
                />
            )}
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        fontFamily: 'Poppins-SemiBold',
    },
    placeholder: {
        width: 32,
    },
    listContainer: {
        flexGrow: 1,
    },
    statsCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    statItem: {
        width: '50%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        marginBottom: 16,
    },
    statIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    statInfo: {
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        fontFamily: 'Poppins-Bold',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
    },
    sectionHeader: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginTop: 8,
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        fontFamily: 'Poppins-SemiBold',
        textTransform: 'uppercase',
    },
    historyItem: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    historyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    methodIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyInfo: {
        flex: 1,
    },
    historyOrder: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 2,
    },
    historyDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historyMethod: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
        marginRight: 8,
    },
    historyTime: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'Poppins-Regular',
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    historyStatus: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    historyStatusText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
        textTransform: 'uppercase',
    },
    loadingContainer: {

        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
        fontFamily: 'Poppins-Medium',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
        fontFamily: 'Poppins-SemiBold',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#9CA3AF',
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 20,
    },
    shopButton: {
        backgroundColor: '#10B981',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 20,
    },
    shopButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
});

export default PaymentHistoryScreen;
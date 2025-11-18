import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    FlatList,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from "../../utils/apiClient";


const TransactionsScreen = () => {
    const router = useRouter();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [filter, setFilter] = useState('all');

    const FILTER_OPTIONS = [
        { id: 'all', label: 'All' },
        { id: 'success', label: 'Successful' },
        { id: 'failed', label: 'Failed' },
        { id: 'refund', label: 'Refunds' },
        { id: 'pending', label: 'Pending' }
    ];

    useEffect(() => {
        loadTransactions();
    }, [filter]);

    const loadTransactions = async (pageNum = 1, shouldRefresh = false) => {
        try {
            if (pageNum === 1) {
                setLoading(true);
            }

            const params = {
                page: pageNum,
                limit: 10
            };

            if (filter !== 'all') {
                params.status = filter;
            }

            const response = await apiClient.get('/api/transactions', { params });

            if (response.data.success) {
                const newTransactions = response.data.data;

                if (shouldRefresh) {
                    setTransactions(newTransactions);
                } else {
                    setTransactions(prev => pageNum === 1 ? newTransactions : [...prev, ...newTransactions]);
                }

                setHasMore(pageNum < response.data.pagination.totalPages);
                setPage(pageNum);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            alert('Failed to load transactions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        setPage(1);
        loadTransactions(1, true);
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            loadTransactions(page + 1);
        }
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

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'success':
                return 'checkmark-circle';
            case 'failed':
                return 'close-circle';
            case 'pending':
                return 'time';
            case 'refund':
                return 'refresh';
            default:
                return 'card';
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
            case 'netbanking':
                return 'business';
            default:
                return 'card';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatAmount = (amount) => {
        return `₹${amount?.toFixed(2) || '0.00'}`;
    };

    const renderTransactionItem = ({ item, index }) => (
        <TouchableOpacity
            style={styles.transactionCard}
            onPress={() => router.push({
                pathname: '/screens/TransactionDetailScreen',
                params: { transactionId: item._id }
            })}
        >
            <View style={styles.transactionHeader}>
                <View style={styles.transactionLeft}>
                    <View style={[styles.statusIcon, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                        <Ionicons
                            name={getStatusIcon(item.status)}
                            size={20}
                            color={getStatusColor(item.status)}
                        />
                    </View>
                    <View style={styles.transactionInfo}>
                        <Text style={styles.orderNumber}>Order #{item.orderNumber}</Text>
                        <Text style={styles.transactionId}>
                            {item.transactionId}
                        </Text>
                    </View>
                </View>
                <View style={styles.amountContainer}>
                    <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.transactionDetails}>
                <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                        <Ionicons name={getPaymentMethodIcon(item.paymentMethod)} size={16} color="#6B7280" />
                        <Text style={styles.detailText}>
                            {item.paymentMethod?.charAt(0).toUpperCase() + item.paymentMethod?.slice(1)}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={16} color="#6B7280" />
                        <Text style={styles.detailText}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
            </View>

            {index < transactions.length - 1 && <View style={styles.separator} />}
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={80} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Transactions</Text>
            <Text style={styles.emptyStateText}>
                {filter === 'all'
                    ? "You haven't made any transactions yet."
                    : `No ${filter} transactions found.`
                }
            </Text>
            <TouchableOpacity
                style={styles.shopButton}
                onPress={() => router.push('/(tabs)/home')}
            >
                <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment History</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Filter Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
            >
                {FILTER_OPTIONS.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.filterTab,
                            filter === option.id && styles.filterTabActive
                        ]}
                        onPress={() => setFilter(option.id)}
                    >
                        <Text style={[
                            styles.filterText,
                            filter === option.id && styles.filterTextActive
                        ]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Transactions List */}
            {loading && page === 1 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderTransactionItem}
                    keyExtractor={(item) => item._id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#10B981']}
                            tintColor="#10B981"
                        />
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={renderEmptyState}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={
                        loading && page > 1 ? (
                            <View style={styles.footerLoading}>
                                <ActivityIndicator size="small" color="#10B981" />
                                <Text style={styles.footerLoadingText}>Loading more...</Text>
                            </View>
                        ) : null
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
    filterContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        backgroundColor: '#F3F4F6',
    },
    filterTabActive: {
        backgroundColor: '#10B981',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
        fontFamily: 'Poppins-Medium',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    listContainer: {
        flexGrow: 1,
        padding: 16,
    },
    transactionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    statusIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    transactionInfo: {
        flex: 1,
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 2,
    },
    transactionId: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
        textTransform: 'uppercase',
    },
    transactionDetails: {
        marginTop: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
        marginLeft: 6,
    },
    separator: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginTop: 12,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
        fontFamily: 'Poppins-Medium',
    },
    footerLoading: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    footerLoadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
    },
});

export default TransactionsScreen;
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
    Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from "../../utils/apiClient";

const { width } = Dimensions.get('window');

const TransactionsScreen = () => {
    const router = useRouter();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [filter, setFilter] = useState('all');

    const FILTER_OPTIONS = [
        { id: 'all', label: 'All', icon: 'list' },
        { id: 'success', label: 'Success', icon: 'checkmark-circle' },
        { id: 'failed', label: 'Failed', icon: 'close-circle' },
        { id: 'refund', label: 'Refunds', icon: 'refresh' },
        { id: 'pending', label: 'Pending', icon: 'time' }
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

    const renderFilterTab = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.filterTab,
                filter === item.id && styles.filterTabActive
            ]}
            onPress={() => setFilter(item.id)}
        >
            <Ionicons
                name={item.icon}
                size={16}
                color={filter === item.id ? '#FFFFFF' : '#6B7280'}
                style={styles.filterIcon}
            />
            <Text style={[
                styles.filterText,
                filter === item.id && styles.filterTextActive
            ]}>
                {item.label}
            </Text>
        </TouchableOpacity>
    );

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
                        <Text style={styles.orderNumber}>
                            {item.orderNumber?.length > 15 ? `${item.orderNumber.substring(0, 15)}...` : item.orderNumber}
                        </Text>
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
                        <Ionicons name={getPaymentMethodIcon(item.paymentMethod)} size={14} color="#6B7280" />
                        <Text style={styles.detailText}>
                            {item.paymentMethod?.charAt(0).toUpperCase() + item.paymentMethod?.slice(1)}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
                <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyStateTitle}>No Transactions Found</Text>
            <Text style={styles.emptyStateText}>
                {filter === 'all'
                    ? "You haven't made any transactions yet."
                    : `No ${filter} transactions found. Try changing the filter.`
                }
            </Text>
            <TouchableOpacity
                style={styles.shopButton}
                onPress={() => router.push('/(tabs)/home')}
            >
                <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
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
                    <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment History</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Filter Tabs - Fixed Size */}
            <View style={styles.filterContainer}>
                <FlatList
                    data={FILTER_OPTIONS}
                    renderItem={renderFilterTab}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContent}
                    scrollEnabled={true}
                />
            </View>

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
                    onEndReachedThreshold={0.3}
                    ListEmptyComponent={renderEmptyState}
                    contentContainerStyle={[
                        styles.listContainer,
                        transactions.length === 0 && styles.emptyListContainer
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={
                        loading && page > 1 ? (
                            <View style={styles.footerLoading}>
                                <ActivityIndicator size="small" color="#10B981" />
                                <Text style={styles.footerLoadingText}>Loading more transactions...</Text>
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
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        padding: 4,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        fontFamily: 'Poppins-Bold',
    },
    placeholder: {
        width: 32,
    },
    filterContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingVertical: 12,
    },
    filterContent: {
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    filterTabActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    filterIcon: {
        marginRight: 4,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        fontFamily: 'Poppins-SemiBold',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    listContainer: {
        flexGrow: 1,
        padding: 16,
    },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    transactionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
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
        width: 44,
        height: 44,
        borderRadius: 22,
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
        marginBottom: 4,
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
        marginBottom: 6,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyStateIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#374151',
        fontFamily: 'Poppins-Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    shopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    shopButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
        marginLeft: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
        fontFamily: 'Poppins-Medium',
    },
    footerLoading: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    footerLoadingText: {
        marginLeft: 12,
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
    },
});

export default TransactionsScreen;
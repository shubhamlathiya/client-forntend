// screens/WalletScreen.js
import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    RefreshControl,
    Alert,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import apiClient from "../../utils/apiClient";
import {useRouter} from "expo-router";


const WalletScreen = () => {
    const router = useRouter();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        loadWalletData();
    }, []);

    const loadWalletData = async () => {
        try {
            setLoading(true);
            const [walletResponse, transactionsResponse] = await Promise.all([
                apiClient.get('/api/wallet'),
                apiClient.get('/api/wallet/transactions'),
            ]);
            setWallet(walletResponse.data.data);
            setTransactions(transactionsResponse.data.data.transactions || []);
        } catch (error) {
            console.error('Error loading wallet data:', error);
            Alert.alert('Error', 'Failed to load wallet data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadWalletData();
    };

    const formatAmount = (amount) => {
        return `₹${amount?.toFixed(2) || '0.00'}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'credit':
                return {name: 'arrow-down-circle', color: '#4CAF50'};
            case 'debit':
                return {name: 'arrow-up-circle', color: '#F44336'};
            case 'refund':
                return {name: 'refresh-circle', color: '#FF9800'};
            default:
                return {name: 'card', color: '#2196F3'};
        }
    };

    const getTransactionTypeText = (type) => {
        switch (type) {
            case 'credit':
                return 'Added';
            case 'debit':
                return 'Spent';
            case 'refund':
                return 'Refund';
            default:
                return type;
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981"/>
                    <Text style={styles.loadingText}>Loading wallet...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333"/>
                </Pressable>
                <Text style={styles.headerTitle}>My Wallet</Text>
                <View style={styles.placeholder}/>
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Wallet Balance Card */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                        <Text style={styles.balanceLabel}>Current Balance</Text>
                        <Ionicons name="wallet" size={24} color="#10B981"/>
                    </View>
                    <Text style={styles.balanceAmount}>
                        {formatAmount(wallet?.balance)}
                    </Text>

                    <View style={styles.balanceStats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Added</Text>
                            <Text style={styles.statValue}>
                                {formatAmount(wallet?.totalAdded)}
                            </Text>
                        </View>
                        <View style={styles.statDivider}/>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Spent</Text>
                            <Text style={styles.statValue}>
                                {formatAmount(wallet?.totalSpent)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionsContainer}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsRow}>
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => router.push('AddMoney')}
                        >
                            <View style={[styles.actionIcon, {backgroundColor: '#E8F5E8'}]}>
                                <Ionicons name="add-circle" size={24} color="#10B981"/>
                            </View>
                            <Text style={styles.actionText}>Add Money</Text>
                        </Pressable>

                        <Pressable
                            style={styles.actionButton}
                            onPress={() => router.push('/screens/TransactionsScreen')}
                        >
                            <View style={[styles.actionIcon, {backgroundColor: '#E3F2FD'}]}>
                                <Ionicons name="list-circle" size={24} color="#2196F3"/>
                            </View>
                            <Text style={styles.actionText}>Transactions</Text>
                        </Pressable>

                        <Pressable
                            style={styles.actionButton}
                            onPress={() => router.push('/screens/PaymentHistoryScreen')}
                        >
                            <View style={[styles.actionIcon, {backgroundColor: '#FFF3E0'}]}>
                                <Ionicons name="time" size={24} color="#FF9800"/>
                            </View>
                            <Text style={styles.actionText}>History</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Recent Transactions */}
                <View style={styles.transactionsContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        <Pressable onPress={() => router.push('/screens/TransactionsScreen')}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </Pressable>
                    </View>

                    {transactions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={64} color="#CCC"/>
                            <Text style={styles.emptyStateText}>No transactions yet</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Your wallet transactions will appear here
                            </Text>
                        </View>
                    ) : (
                        transactions.slice(0, 5).map((transaction, index) => {
                            const icon = getTransactionIcon(transaction.type);
                            return (
                                <Pressable
                                    key={transaction._id || index}
                                    style={styles.transactionItem}
                                >
                                    <View style={styles.transactionLeft}>
                                        <View style={[styles.transactionIcon, {backgroundColor: `${icon.color}15`}]}>
                                            <Ionicons name={icon.name} size={20} color={icon.color}/>
                                        </View>
                                        <View style={styles.transactionDetails}>
                                            <Text style={styles.transactionReference}>
                                                {transaction.reference}
                                            </Text>
                                            <Text style={styles.transactionDate}>
                                                {formatDate(transaction.createdAt)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.transactionRight}>
                                        <Text
                                            style={[
                                                styles.transactionAmount,
                                                {color: transaction.type === 'credit' ? '#4CAF50' : '#F44336'}
                                            ]}
                                        >
                                            {transaction.type === 'credit' ? '+' : '-'}
                                            {formatAmount(transaction.amount)}
                                        </Text>
                                        <Text style={styles.transactionType}>
                                            {getTransactionTypeText(transaction.type)}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })
                    )}
                </View>

                {/* Wallet Benefits */}
                <View style={styles.benefitsContainer}>
                    <Text style={styles.sectionTitle}>Wallet Benefits</Text>
                    <View style={styles.benefitsList}>
                        <View style={styles.benefitItem}>
                            <Ionicons name="flash" size={20} color="#10B981"/>
                            <Text style={styles.benefitText}>Instant checkout</Text>
                        </View>
                        <View style={styles.benefitItem}>
                            <Ionicons name="shield-checkmark" size={20} color="#10B981"/>
                            <Text style={styles.benefitText}>Secure payments</Text>
                        </View>
                        <View style={styles.benefitItem}>
                            <Ionicons name="cash" size={20} color="#10B981"/>
                            <Text style={styles.benefitText}>Cashback offers</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    placeholder: {
        width: 32,
    },
    balanceCard: {
        backgroundColor: '#FFF',
        margin: 16,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    balanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    balanceLabel: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    balanceAmount: {
        fontSize: 36,
        fontWeight: '700',
        color: '#10B981',
        marginBottom: 20,
    },
    balanceStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#E0E0E0',
    },
    actionsContainer: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 16,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionButton: {
        alignItems: 'center',
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionText: {
        fontSize: 12,
        color: '#333',
        fontWeight: '500',
    },
    transactionsContainer: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    seeAllText: {
        color: '#10B981',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        marginTop: 12,
        fontWeight: '500',
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#999',
        marginTop: 4,
        textAlign: 'center',
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionReference: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    transactionDate: {
        fontSize: 12,
        color: '#999',
    },
    transactionRight: {
        alignItems: 'flex-end',
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    transactionType: {
        fontSize: 12,
        color: '#999',
    },
    benefitsContainer: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
    },
    benefitsList: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    benefitText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 6,
    },
});

export default WalletScreen;
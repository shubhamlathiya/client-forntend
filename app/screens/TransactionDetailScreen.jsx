// screens/TransactionDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from "../../utils/apiClient";

const TransactionDetailScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.transactionId) {
            loadTransactionDetails();
        }
    }, [params.transactionId]);

    const loadTransactionDetails = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/api/transactions/${params.transactionId}`);

            if (response.data.success) {
                setTransaction(response.data.data);
            }
        } catch (error) {
            console.error('Error loading transaction details:', error);
            Alert.alert('Error', 'Failed to load transaction details');
        } finally {
            setLoading(false);
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
                return 'help-circle';
        }
    };

    const formatAmount = (amount) => {
        return `₹${amount?.toFixed(2) || '0.00'}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.toLocaleDateString('en-IN', {
            weekday: 'long'
        });
        const datePart = date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const timePart = date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return {
            day,
            date: datePart,
            time: timePart
        };
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>Loading transaction details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!transaction) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={64} color="#EF4444" />
                    <Text style={styles.errorText}>Transaction not found</Text>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const formattedDate = formatDate(transaction.createdAt);

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
                <Text style={styles.headerTitle}>Transaction Details</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
                {/* Status Card */}
                <View style={styles.statusCard}>
                    <View style={[styles.statusIcon, { backgroundColor: `${getStatusColor(transaction.status)}15` }]}>
                        <Ionicons
                            name={getStatusIcon(transaction.status)}
                            size={32}
                            color={getStatusColor(transaction.status)}
                        />
                    </View>
                    <Text style={styles.amount}>{formatAmount(transaction.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status) }]}>
                        <Text style={styles.statusText}>{transaction.status}</Text>
                    </View>
                    <Text style={styles.orderNumber}>Order #{transaction.orderNumber}</Text>
                    <Text style={styles.transactionId}>{transaction.transactionId}</Text>
                </View>

                {/* Details Card */}
                <View style={styles.detailsCard}>
                    <Text style={styles.detailsTitle}>Transaction Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Method</Text>
                        <Text style={styles.detailValue}>
                            {transaction.paymentMethod?.charAt(0).toUpperCase() + transaction.paymentMethod?.slice(1)}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date & Time</Text>
                        <View style={styles.dateTimeContainer}>
                            <Text style={styles.dateText}>{formattedDate.day}</Text>
                            <Text style={styles.dateText}>{formattedDate.date}</Text>
                            <Text style={styles.timeText}>{formattedDate.time}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Currency</Text>
                        <Text style={styles.detailValue}>{transaction.currency || 'INR'}</Text>
                    </View>

                    {transaction.responseData && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Gateway Reference</Text>
                            <Text style={styles.detailValue}>
                                {transaction.responseData.razorpay_payment_id || transaction.responseData.paymentId || 'N/A'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Order Summary Card */}
                {transaction.orderDetails && (
                    <View style={styles.orderCard}>
                        <Text style={styles.detailsTitle}>Order Summary</Text>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Items Total</Text>
                            <Text style={styles.detailValue}>
                                {formatAmount(transaction.orderDetails.totals?.itemsTotal)}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Delivery Fee</Text>
                            <Text style={styles.detailValue}>
                                {formatAmount(transaction.orderDetails.totals?.deliveryFee)}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Taxes</Text>
                            <Text style={styles.detailValue}>
                                {formatAmount(transaction.orderDetails.totals?.tax)}
                            </Text>
                        </View>

                        <View style={[styles.detailRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total Amount</Text>
                            <Text style={styles.totalValue}>
                                {formatAmount(transaction.orderDetails.totals?.grandTotal)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsCard}>
                    <Pressable
                        style={styles.actionButton}
                        onPress={() => router.push({
                            pathname: '/screens/OrderDetailScreen',
                            params: { orderId: transaction.orderId }
                        })}
                    >
                        <Ionicons name="receipt" size={20} color="#10B981" />
                        <Text style={styles.actionText}>View Order Details</Text>
                    </Pressable>

                    <Pressable
                        style={styles.actionButton}
                        onPress={() => {
                            // Handle download receipt
                            Alert.alert('Receipt', 'Receipt download feature coming soon');
                        }}
                    >
                        <Ionicons name="download" size={20} color="#3B82F6" />
                        <Text style={styles.actionText}>Download Receipt</Text>
                    </Pressable>
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
    scrollView: {
        flex: 1,
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
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        fontSize: 18,
        color: '#EF4444',
        fontFamily: 'Poppins-SemiBold',
        marginTop: 16,
        marginBottom: 24,
    },
    statusCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    amount: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        fontFamily: 'Poppins-Bold',
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
        textTransform: 'uppercase',
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
        textAlign: 'center',
    },
    detailsCard: {
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
    detailsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailLabel: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
        flex: 1,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        fontFamily: 'Poppins-Medium',
        flex: 1,
        textAlign: 'right',
    },
    dateTimeContainer: {
        flex: 1,
        alignItems: 'flex-end',
    },
    dateText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        fontFamily: 'Poppins-Medium',
        textAlign: 'right',
        lineHeight: 20,
    },
    timeText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#10B981',
        fontFamily: 'Poppins-Medium',
        textAlign: 'right',
        lineHeight: 20,
    },
    orderCard: {
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
    totalRow: {
        borderBottomWidth: 0,
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        fontFamily: 'Poppins-SemiBold',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10B981',
        fontFamily: 'Poppins-Bold',
    },
    actionsCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#F8F9FA',
        marginBottom: 8,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        fontFamily: 'Poppins-Medium',
        marginLeft: 12,
    },
});

export default TransactionDetailScreen;
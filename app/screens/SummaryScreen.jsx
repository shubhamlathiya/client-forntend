import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter} from 'expo-router';
import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    ToastAndroid,
    Pressable,
    View,
    Platform,
    Image,
    Modal,
} from 'react-native';

import {generateOrderSummary, createOrder, getOrderById} from '../../api/ordersApi';
import {getCart} from '../../api/cartApi';
import {initiatePayment, verifyRazorpayPayment} from '../../api/paymentApi';
import PaymentWebView from './PaymentWebView';
import {API_BASE_URL} from "../../config/apiConfig";

export default function SummaryScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [placing, setPlacing] = useState(false);
    const [address, setAddress] = useState(null);
    const [summary, setSummary] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('razorpay');

    // Payment modal / flow states
    const [startingPayment, setStartingPayment] = useState(false);
    const [paymentInitialized, setPaymentInitialized] = useState(false);
    const [paymentData, setPaymentData] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [lastError, setLastError] = useState(null);
    const [paymentCompleted, setPaymentCompleted] = useState(false);
    const [createdOrderId, setCreatedOrderId] = useState(null);
    const [paymentVerificationData, setPaymentVerificationData] = useState(null);

    const showMessage = (message, isError = false) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, isError ? ToastAndroid.LONG : ToastAndroid.SHORT);
        } else {
            Alert.alert(isError ? 'Error' : 'Success', message);
        }
    };

    // Load summary + address
    const loadSummary = async () => {
        try {
            const selectedAddressRaw = await AsyncStorage.getItem('selectedAddress');
            const selectedAddress = selectedAddressRaw ? JSON.parse(selectedAddressRaw) : null;
            setAddress(selectedAddress);

            if (!selectedAddress) {
                showMessage('Please select an address first', true);
                router.back();
                return;
            }

            // Fetch cart to get cartId
            const cartRes = await getCart();
            const cart = cartRes?.data ?? cartRes;
            if (!cart?.cartId) {
                showMessage('Cart not found', true);
                router.back();
                return;
            }

            // Generate order summary with address
            const summaryRes = await generateOrderSummary(selectedAddress._id || selectedAddress.id, cart.cartId);
            const data = summaryRes?.data ?? summaryRes;

            setSummary(data);

        } catch (error) {
            console.log('Summary load error:', error);
            showMessage('Failed to load order summary', true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
    }, []);

    // Check if payment was completed and redirect
    useEffect(() => {
        if (paymentCompleted && createdOrderId) {
            // Small delay to ensure UI updates
            const timer = setTimeout(() => {
                console.log('Payment completed, redirecting to Orders screen...');
                router.replace('/Order');
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [paymentCompleted, createdOrderId]);

    // NEW: Start payment flow (initiate payment first)
    const startPaymentFlow = async () => {
        // Prevent double clicks
        if (placing || startingPayment || paymentInitialized) return;

        try {
            setStartingPayment(true);
            setPlacing(false); // We'll set placing when actually creating order
            setLastError(null);
            setPaymentCompleted(false);
            setCreatedOrderId(null);
            setPaymentVerificationData(null);

            if (!address) {
                showMessage('Please select an address', true);
                setStartingPayment(false);
                return;
            }
            if (!summary?.cartId) {
                showMessage('Order summary not found', true);
                setStartingPayment(false);
                return;
            }

            // STEP 1: Initiate payment with cart and summary info
            const paymentRes = await initiatePayment({
                cartId: summary.cartId,
                summaryId: summary._id,
                paymentMethod: selectedPaymentMethod
            });

            if (!paymentRes || !paymentRes.success) {
                const err = paymentRes?.message || 'Payment initialization failed';
                showMessage(err, true);
                setStartingPayment(false);
                return;
            }

            const paymentPayload = {
                amount: parseInt(paymentRes.data.amount, 10),
                orderId: paymentRes.data.orderId, // Razorpay order ID
                keyId: paymentRes.data.keyId,
                currency: paymentRes.data.currency || 'INR',
                user: paymentRes.data.user || {},
                billingAddress: paymentRes.data.billingAddress || address || {},
                // Store cart and summary info for order creation later
                cartId: summary.cartId,
                summaryId: summary._id,
                razorpayOrder: paymentRes.data.razorpayOrder
            };

            setPaymentData(paymentPayload);
            setPaymentInitialized(true);

            // Open payment modal
            setShowPaymentModal(true);

        } catch (error) {
            console.error('Start payment flow error:', error);
            showMessage('Failed to start payment', true);
            setLastError(error.message || String(error));
            setStartingPayment(false);
        }
    };

    // NEW: Handle payment success (then create order)
    const handlePaymentSuccess = async (response) => {
        console.log('Payment successful:', response);

        try {
            // STEP 2: Verify payment with backend
            const verificationRes = await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
            });

            if (!verificationRes || !verificationRes.success) {
                throw new Error(verificationRes?.message || 'Payment verification failed');
            }

            // Store verification data for order creation
            const verificationData = {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
            };

            setPaymentVerificationData(verificationData);

            // STEP 3: Create order with verified payment data
            setPlacing(true);
            setShowPaymentModal(false); // Close payment modal

            const orderPayload = {
                summaryId: summary._id,
                cartId: summary.cartId,
                paymentMethod: selectedPaymentMethod,
                shippingAddress: address,
                addressId: address._id || address.id,
                notes: '',
                paymentData: verificationData // Pass verified payment data
            };

            const orderResult = await createOrder(orderPayload);

            if (!orderResult || !orderResult.success) {
                const err = orderResult?.message || orderResult?.error || 'Failed to place order';
                throw new Error(err);
            }

            const orderId = orderResult.data?.orderId || orderResult.data?._id;
            if (!orderId) {
                throw new Error('Invalid order created');
            }

            // Save order ID for redirection
            setCreatedOrderId(orderId);
            setPaymentCompleted(true);
            setPaymentData(null);
            setPaymentInitialized(false);
            setLastError(null);

            showMessage('Order placed successfully!');

            // Don't redirect here - useEffect will handle it
            console.log('Order created successfully:', orderId);

        } catch (error) {
            console.error('Payment/Order creation error:', error);

            // Reset payment states
            setPaymentData(null);
            setPaymentInitialized(false);
            setShowPaymentModal(false);
            setPlacing(false);

            Alert.alert(
                'Payment/Order Error',
                error.message || 'There was an issue processing your order. Please try again.',
                [
                    {
                        text: 'Retry',
                        onPress: () => {
                            // Clear everything and retry
                            setTimeout(() => {
                                startPaymentFlow();
                            }, 300);
                        }
                    },
                    {
                        text: 'Cancel',
                        style: 'destructive',
                        onPress: () => {
                            // Just reset states
                        }
                    }
                ]
            );
        }
    };

    const handlePaymentError = (errorData) => {
        console.error('Payment Error from WebView:', errorData);
        setLastError(errorData?.description || 'Payment failed');
        setShowPaymentModal(false);

        Alert.alert('Payment Failed', errorData?.description || 'Payment failed. Please try again.', [
            {
                text: 'Retry',
                onPress: () => {
                    setPaymentData(null);
                    setPaymentInitialized(false);
                    // Use setTimeout to ensure state is reset
                    setTimeout(() => {
                        startPaymentFlow();
                    }, 300);
                }
            },
            {
                text: 'Cancel',
                style: 'destructive',
                onPress: () => {
                    setPaymentData(null);
                    setPaymentInitialized(false);
                }
            }
        ]);
    };

    const handlePaymentClose = () => {
        // If payment was completed, redirect immediately
        if (paymentCompleted) {
            router.replace('/Order');
            return;
        }

        // If user closes modal without completing payment
        Alert.alert(
            'Payment Incomplete',
            'Your payment has not been completed. Do you want to continue?',
            [
                {
                    text: 'Continue Payment',
                    style: 'default',
                    onPress: () => {
                        // Re-open modal
                        setShowPaymentModal(true);
                    }
                },
                {
                    text: 'Cancel Payment',
                    style: 'destructive',
                    onPress: () => {
                        setPaymentData(null);
                        setPaymentInitialized(false);
                        setShowPaymentModal(false);
                    }
                }
            ]
        );
    };

    // Handle modal dismiss (when user swipes down on iOS)
    const handleModalDismiss = () => {
        // Same as close button
        handlePaymentClose();
    };

    // Loading UI
    if (loading || !summary) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAD73"/>
                <Text style={styles.loadingText}>Loading summary…</Text>
            </View>
        );
    }

    // Extract data from summary
    const items = summary?.items || [];
    const subtotal = Number(summary?.subtotal ?? 0);
    const shipping = Number(summary?.shipping ?? 0);
    const discount = Number(summary?.discount ?? 0);
    const tax = Number(summary?.tax ?? 0);
    const total = Number(summary?.total ?? 0);
    const summaryData = summary?.summary || {};

    // Back handler
    const handleBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/Home');
    };

    return (
        <View style={styles.container}>
            {/* TOP BAR */}
            <View style={styles.topBar}>
                <Pressable onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.iconBox}
                    />
                </Pressable>
                <Text style={styles.heading}>Order Summary</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ADDRESS CARD */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Shipping Address</Text>
                    {address ? (
                        <View>
                            <View style={styles.addressHeader}>
                                <Text style={styles.addressName}>{address.name}</Text>
                                <Text style={styles.addressPhone}>{address.phone}</Text>
                            </View>
                            <Text style={styles.addressText}>{address.address}</Text>
                            <Text style={styles.addressArea}>
                                {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
                            </Text>
                            {address.country && (
                                <Text style={styles.addressCountry}>{address.country}</Text>
                            )}
                            <Pressable
                                style={styles.linkButton}
                                onPress={() => router.push('/screens/AddressListScreen')}
                            >
                                <Text style={styles.linkText}>Change Address</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Text style={styles.textMuted}>No address selected.</Text>
                    )}
                </View>

                {/* ORDER ITEMS CARD */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        Order Items ({summaryData.totalItems || items.length})
                    </Text>
                    {items.length === 0 ? (
                        <Text style={styles.textMuted}>No items in order.</Text>
                    ) : (
                        items.map((item, index) => (
                            <View key={index} style={styles.orderItem}>
                                <View style={styles.itemImageContainer}>
                                    {item.image ? (
                                        <Image
                                            source={{uri: `${API_BASE_URL}${item.image}`}}
                                            style={styles.itemImage}
                                            defaultSource={require('../../assets/sample-product.png')}
                                        />
                                    ) : (
                                        <Image
                                            source={require('../../assets/sample-product.png')}
                                            style={styles.itemImage}
                                        />
                                    )}
                                </View>
                                <View style={styles.itemDetails}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                        {item.name}
                                    </Text>
                                    {item.brand && (
                                        <Text style={styles.itemBrand}>{item.brand}</Text>
                                    )}
                                    {item.variantAttributes && (
                                        <Text style={styles.itemVariant} numberOfLines={1}>
                                            {item.variantAttributes}
                                        </Text>
                                    )}
                                    <View style={styles.itemPriceRow}>
                                        <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                                        <Text style={styles.itemPrice}>₹{item.finalPrice?.toFixed(2)}</Text>
                                    </View>
                                    {item.shippingCharge > 0 && (
                                        <Text style={styles.shippingText}>
                                            Shipping: ₹{item.shippingCharge}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* PAYMENT METHOD CARD */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Payment Method</Text>
                    <Pressable
                        style={[styles.paymentMethod, styles.paymentMethodSelected]}
                    >
                        <View style={styles.paymentMethodLeft}>
                            <View style={[styles.radioButton, styles.radioButtonSelected]}>
                                <View style={styles.radioButtonInner}/>
                            </View>
                            <Text style={styles.paymentMethodName}>Razorpay</Text>
                        </View>
                        <Text style={styles.paymentMethodDesc}>Cards, UPI, Netbanking</Text>
                    </Pressable>
                    <Text style={styles.paymentNote}>
                        You will be redirected to a secure payment page.
                    </Text>
                </View>

                {/* DETAILED SUMMARY CARD */}
                {summaryData && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Price Breakdown</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Subtotal</Text>
                            <Text style={styles.detailValue}>₹{summaryData.subtotal || subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Shipping</Text>
                            <Text style={styles.detailValue}>₹{summaryData.shipping || shipping.toFixed(2)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Tax</Text>
                            <Text style={styles.detailValue}>₹{summaryData.tax || tax.toFixed(2)}</Text>
                        </View>
                        {summaryData.marketplaceFees && Number(summaryData.marketplaceFees) > 0 && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Marketplace Fees</Text>
                                <Text style={styles.detailValue}>₹{summaryData.marketplaceFees}</Text>
                            </View>
                        )}
                        {discount > 0 && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Discount</Text>
                                <Text style={[styles.detailValue, styles.discountValue]}>
                                    -₹{summaryData.discount || discount.toFixed(2)}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.detailRow, styles.finalRow]}>
                            <Text style={styles.finalLabel}>Grand Total</Text>
                            <Text style={styles.finalValue}>₹{summaryData.total || total.toFixed(2)}</Text>
                        </View>
                    </View>
                )}

            </ScrollView>

            {/* ACTION BUTTONS */}
            <View style={styles.footer}>
                <View style={styles.footerTotal}>
                    <Text style={styles.footerTotalLabel}>Total Payable</Text>
                    <Text style={styles.footerTotalValue}>₹{total.toFixed(2)}</Text>
                </View>
                <View style={styles.actions}>
                    <Pressable
                        style={styles.secondaryButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.secondaryButtonText}>Back to Cart</Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.primaryButton,
                            (placing || startingPayment || paymentCompleted) && styles.buttonDisabled,
                            items.length === 0 && styles.buttonDisabled
                        ]}
                        disabled={placing || startingPayment || items.length === 0 || paymentCompleted}
                        onPress={startPaymentFlow}
                    >
                        {startingPayment ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : placing ? (
                            <Text style={styles.primaryButtonText}>Creating Order...</Text>
                        ) : paymentCompleted ? (
                            <Text style={styles.primaryButtonText}>Processing...</Text>
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Pay ₹{total.toFixed(2)}
                            </Text>
                        )}
                    </Pressable>
                </View>
            </View>

            {/* Payment Modal */}
            <Modal
                visible={showPaymentModal && paymentData !== null}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleModalDismiss}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            Secure Payment - ₹{(paymentData?.amount / 100).toFixed(2) || '0.00'}
                        </Text>
                        <Pressable
                            onPress={handlePaymentClose}
                            style={styles.closeButton}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </Pressable>
                    </View>
                    {paymentData && (
                        <PaymentWebView
                            orderData={paymentData}
                            onSuccess={handlePaymentSuccess}
                            onError={handlePaymentError}
                            onClose={handlePaymentClose}
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    topBar: {
        padding: 20,
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    heading: {
        fontSize: 20,
        fontWeight: '600',
        marginLeft: 20,
        color: '#1B1B1B'
    },
    iconBox: {
        width: 32,
        height: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 16,
        color: '#666'
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 180,
    },
    card: {
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
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 12,
    },
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    addressName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    addressPhone: {
        fontSize: 14,
        color: '#666',
    },
    addressText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
        marginBottom: 4,
    },
    addressArea: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    addressCountry: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    linkButton: {
        marginTop: 8,
    },
    linkText: {
        color: '#4CAD73',
        fontSize: 14,
        fontWeight: '600',
    },
    orderItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    itemImageContainer: {
        marginRight: 12,
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#F5F6FA',
    },
    itemDetails: {
        flex: 1,
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 4,
    },
    itemBrand: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    itemVariant: {
        fontSize: 12,
        color: '#888',
        marginBottom: 6,
    },
    itemPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemQuantity: {
        fontSize: 12,
        color: '#666',
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    shippingText: {
        fontSize: 11,
        color: '#666',
        marginTop: 2,
    },
    paymentMethod: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: '#E6E6E6',
        borderRadius: 8,
        marginBottom: 8,
    },
    paymentMethodSelected: {
        borderColor: '#4CAD73',
        backgroundColor: 'rgba(76, 173, 115, 0.05)',
    },
    paymentMethodLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#CCC',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioButtonSelected: {
        borderColor: '#4CAD73',
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4CAD73',
    },
    paymentMethodName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    paymentMethodDesc: {
        fontSize: 12,
        color: '#666',
    },
    paymentNote: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    detailLabel: {
        fontSize: 13,
        color: '#666',
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1B1B1B',
    },
    finalRow: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        marginTop: 6,
        paddingTop: 8,
    },
    finalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    finalValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4CAD73',
    },
    discountValue: {
        color: '#EC0505',
    },
    textMuted: {
        fontSize: 14,
        color: '#777',
        fontStyle: 'italic',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        padding: 16,
        paddingBottom: 34,
    },
    footerTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    footerTotalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    footerTotalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4CAD73',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: '#4CAD73',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4CAD73',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DDD',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        color: '#1B1B1B',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'white'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        paddingTop: 60
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333'
    },
    closeButton: {
        padding: 8
    },
    closeButtonText: {
        fontSize: 20,
        color: '#666',
        fontWeight: 'bold'
    }
});
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
    TouchableOpacity,
    View,
    Platform,
    Image,
} from 'react-native';

import {generateOrderSummary, createOrder} from '../../api/ordersApi';
import {getCart} from '../../api/cartApi';
import {initiatePayment, getPaymentMethods} from '../../api/paymentApi';
import {API_BASE_URL} from "../../config/apiConfig";

export default function SummaryScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [placing, setPlacing] = useState(false);
    const [address, setAddress] = useState(null);
    const [summary, setSummary] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('razorpay');

    const showMessage = (message, isError = false) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, isError ? ToastAndroid.LONG : ToastAndroid.SHORT);
        } else {
            Alert.alert(isError ? 'Error' : 'Success', message);
        }
    };

    // Load payment methods
    // const loadPaymentMethods = async () => {
    //     try {
    //         // const methods = await getPaymentMethods();
    //         // setPaymentMethods(methods.data || methods);
    //     } catch (error) {
    //         console.log('Payment methods load error:', error);
    //         // Continue with default payment method
    //     }
    // };

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
            // console.log('Order Summary:', data);
            setSummary(data);

            // Load payment methods
            // await loadPaymentMethods();

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

    // Handle payment initiation
    const handlePayment = async (orderId) => {
        try {
            const paymentResult = await initiatePayment(orderId, selectedPaymentMethod);

            if (paymentResult.success) {
                if (selectedPaymentMethod === 'razorpay') {
                    showMessage('Redirecting to payment gateway...');
                    setTimeout(() => {
                        handlePaymentSuccess(orderId);
                    }, 2000);
                } else {
                    showMessage(`Processing ${selectedPaymentMethod} payment...`);
                }
            } else {
                showMessage(paymentResult.error || 'Payment initiation failed', true);
            }
        } catch (error) {
            console.log('Payment initiation error:', error);
            showMessage('Failed to initiate payment', true);
        }
    };

    // Handle payment success
    const handlePaymentSuccess = async (orderId) => {
        try {
            showMessage('Payment successful!');

            router.replace({
                pathname: '/screens/OrderConfirmationScreen',
                params: {id: String(orderId)},
            });
        } catch (error) {
            console.log('Payment success handling error:', error);
        }
    };

    // Handle order placement with payment
    const handlePlaceOrder = async () => {
        try {
            setPlacing(true);

            if (!address) return showMessage('Please select an address', true);
            if (!summary?.cartId) return showMessage('Order summary not found', true);
            console.log("shubham",summary._id)
            const orderPayload = {
                summaryId : summary._id,
                cartId: summary.cartId,
                paymentMethod: selectedPaymentMethod,
                shippingAddress: address,
                addressId: address._id || address.id,
                notes: ''
            };

            const orderResult = await createOrder(orderPayload);

            if (orderResult.success) {
                const orderId = orderResult.data?.orderId || orderResult.data?._id;
                await handlePayment(orderId);
            } else {
                showMessage(orderResult.error || 'Failed to place order', true);
            }
        } catch (error) {
            console.log('Place order error:', error);
            showMessage('Failed to place order', true);
        } finally {
            setPlacing(false);
        }
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
                <TouchableOpacity onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.iconBox}
                    />
                </TouchableOpacity>
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
                            <TouchableOpacity
                                style={styles.linkButton}
                                onPress={() => router.push('/screens/AddressListScreen')}
                            >
                                <Text style={styles.linkText}>Change Address</Text>
                            </TouchableOpacity>
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
                    {paymentMethods.length > 0 ? (
                        paymentMethods.map((method) => (
                            <TouchableOpacity
                                key={method._id || method.id}
                                style={[
                                    styles.paymentMethod,
                                    selectedPaymentMethod === method.code && styles.paymentMethodSelected
                                ]}
                                onPress={() => setSelectedPaymentMethod(method.code)}
                            >
                                <View style={styles.paymentMethodLeft}>
                                    <View style={[
                                        styles.radioButton,
                                        selectedPaymentMethod === method.code && styles.radioButtonSelected
                                    ]}>
                                        {selectedPaymentMethod === method.code && (
                                            <View style={styles.radioButtonInner}/>
                                        )}
                                    </View>
                                    <Text style={styles.paymentMethodName}>{method.name}</Text>
                                </View>
                                {method.description && (
                                    <Text style={styles.paymentMethodDesc}>{method.description}</Text>
                                )}
                            </TouchableOpacity>
                        ))
                    ) : (
                        <TouchableOpacity
                            style={[styles.paymentMethod, styles.paymentMethodSelected]}
                        >
                            <View style={styles.paymentMethodLeft}>
                                <View style={[styles.radioButton, styles.radioButtonSelected]}>
                                    <View style={styles.radioButtonInner}/>
                                </View>
                                <Text style={styles.paymentMethodName}>Razorpay</Text>
                            </View>
                            <Text style={styles.paymentMethodDesc}>Cards, UPI, Netbanking</Text>
                        </TouchableOpacity>
                    )}
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

                {/* ORDER INFO CARD */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Order Information</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Order ID</Text>
                        <Text style={styles.infoValue}>#{summary._id?.slice(-8).toUpperCase() || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Cart ID</Text>
                        <Text style={styles.infoValue}>#{summary.cartId?.slice(-8).toUpperCase() || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Total Items</Text>
                        <Text style={styles.infoValue}>
                            {summaryData.totalItems || items.reduce((total, item) => total + item.quantity, 0)} items
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Order Date</Text>
                        <Text style={styles.infoValue}>
                            {new Date(summary.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Estimated Delivery</Text>
                        <Text style={styles.infoValue}>3-5 business days</Text>
                    </View>
                </View>

            </ScrollView>

            {/* ACTION BUTTONS */}
            <View style={styles.footer}>
                <View style={styles.footerTotal}>
                    <Text style={styles.footerTotalLabel}>Total Payable</Text>
                    <Text style={styles.footerTotalValue}>₹{total.toFixed(2)}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.secondaryButtonText}>Back to Cart</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            placing && styles.buttonDisabled,
                            items.length === 0 && styles.buttonDisabled
                        ]}
                        disabled={placing || items.length === 0}
                        onPress={handlePlaceOrder}
                    >
                        {placing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Pay ₹{total.toFixed(2)}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
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
    // Address Styles
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
    // Order Items Styles
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
    // Payment Method Styles
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
    // Summary Styles
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1B1B1B',
    },
    discountValue: {
        color: '#EC0505',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 8,
    },
    totalRow: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4CAD73',
    },
    savingsContainer: {
        marginTop: 8,
        padding: 8,
        backgroundColor: 'rgba(76, 173, 115, 0.1)',
        borderRadius: 6,
    },
    savingsText: {
        fontSize: 12,
        color: '#4CAD73',
        fontWeight: '500',
        textAlign: 'center',
    },
    // Detailed Summary Styles
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
    // Info Styles
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    infoLabel: {
        fontSize: 14,
        color: '#666',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1B1B1B',
    },
    textMuted: {
        fontSize: 14,
        color: '#777',
        fontStyle: 'italic',
    },
    // Footer Styles
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
});
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
} from "react-native";
// Assuming these are implemented elsewhere:
import { getOrderById } from "../../api/ordersApi";
import { initiatePayment, verifyRazorpayPayment } from "../../api/paymentApi";
import PaymentWebView from "./PaymentWebView";

// NOTE: Add your AsyncStorage utility here if you don't use a separate file
// import { fetchUserData } from "../../utils/asyncStorageUtils";

export default function OrderConfirmationScreen() {
    const router = useRouter();
    const { id: orderId } = useLocalSearchParams();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startingPayment, setStartingPayment] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState(null);
    const [paymentInitialized, setPaymentInitialized] = useState(false);
    const [lastError, setLastError] = useState(null);

    useEffect(() => {
        loadOrder();
    }, []);

    const loadOrder = async () => {
        try {
            const res = await getOrderById(orderId);
            const orderData = res?.data?.data || res?.data || res;
            setOrder(orderData);
        } catch (err) {
            console.log("❌ Load Order Error:", err);
            Alert.alert("Error", "Unable to load order");
        } finally {
            setLoading(false);
        }
    };

    const formatDisplayAmount = (amount) => {
        if (!amount && amount !== 0) return "0.00";

        // If amount is in paise (like from Razorpay), convert to rupees
        if (amount >= 100) {
            return (amount / 100).toFixed(2);
        }
        // If amount is already in rupees
        return parseFloat(amount).toFixed(2);
    };

    const initializePayment = async () => {
        if (!order) {
            Alert.alert("Error", "Order not loaded");
            return;
        }

        try {
            setStartingPayment(true);
            setLastError(null);

            // 1. Call backend to initiate Razorpay payment
            const res = await initiatePayment(orderId, "razorpay");
            const data = res?.data?.data || res?.data || res;


            if (!data) {
                throw new Error("No response from payment server");
            }

            if (!data.orderId || !data.keyId || !data.amount) {
                console.error("❌ Payment information is incomplete:", data);
                const errorMsg = data.message || "Payment information is incomplete from server";
                throw new Error(errorMsg);
            }

            // Verify amount is valid
            const amountNum = parseInt(data.amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                console.error("❌ Invalid payment amount:", data.amount);
                throw new Error("Invalid payment amount received from server");
            }

            // Store payment data for WebView
            const paymentData = {
                amount: amountNum, // This amount is in paise, e.g., 226756
                orderId: data.orderId,
                keyId: data.keyId,
                currency: data.currency || "INR",
                // Assuming user/billing info is attached to order/user state
                user: order.user,
                billingAddress: order.billingAddress,
            };

            setPaymentData(paymentData);
            setPaymentInitialized(true);

            // Show confirmation with amount details
            const displayAmount = formatDisplayAmount(amountNum);
            setShowPaymentModal(true);

        } catch (error) {
            console.error("❌ Payment Initialization Error:", error);
            const errorMsg = error.message || "Failed to initialize payment. Please try again.";
            Alert.alert("Payment Error", errorMsg);
            setLastError(errorMsg);
        } finally {
            setStartingPayment(false);
        }
    };

    const handlePaymentSuccess = async (response) => {
        // Close modal immediately
        setShowPaymentModal(false);

        try {
            // Verify payment with your backend
            await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId,
            });

            Alert.alert("Success", "Payment completed successfully!");

            // Reset payment states
            setPaymentData(null);
            setPaymentInitialized(false);
            setLastError(null);

            // Reload order to get updated data
            loadOrder();
            router.push("/Order")
        } catch (verificationError) {
            console.error("❌ Payment verification failed:", verificationError);
            const errorMsg = verificationError.response?.data?.message || "Payment verification failed";
            Alert.alert("Verification Failed", errorMsg);
            setPaymentData(null);
            setPaymentInitialized(false);
            setLastError(errorMsg);
        }
    };

    const startNewPayment = () => {
        // Reset any existing payment data to force a new API call
        setPaymentData(null);
        setPaymentInitialized(false);
        setShowPaymentModal(false);
        setLastError(null);

        // Initialize new payment
        initializePayment();
    };

    const handlePaymentError = (errorData) => {
        // 1. Log and set the error for display
        const errorMessage = errorData.description || "Payment failed. Please try again.";
        console.error('Payment Error Details:', errorData);

        // Set last error for display in the error card
        setLastError(errorMessage);

        // 2. Close the WebView modal immediately
        setShowPaymentModal(false);

        // 3. Provide a specific, actionable message to the user
        const message = errorData.description === "Please use another method"
            ? "Payment failed. Please try a different card/method, or your previous session may have expired."
            : errorData.description || "Payment failed. Please try again.";

        // 4. Prompt the user to retry (which forces new order initialization)
        Alert.alert("Payment Failed", message, [
            {
                text: "Try New Payment",
                onPress: () => {
                    startNewPayment(); // Will call initializePayment()
                }
            },
            { text: "Cancel", style: 'cancel' }
        ]);

        // Reset payment states to force new initialization upon retry
        setPaymentData(null);
        setPaymentInitialized(false);
    };

    const handlePaymentClose = () => {
        setShowPaymentModal(false);
    };

    const resumePayment = () => {
        if (paymentInitialized && paymentData) {
            setShowPaymentModal(true);
        } else {
            startNewPayment();
        }
    };

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#4CAD73" />
                <Text>Loading order...</Text>
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.loading}>
                <Text>Order not found</Text>
            </View>
        );
    }

    const displayOrderNumber = order.orderNumber || order._id;

    // Get amount from order - handle multiple possible locations
    let rawAmount = 0;
    if (order.originalTotals?.grandTotal) {
        rawAmount = order.originalTotals.grandTotal;
    } else if (order.totals?.grandTotal) {
        rawAmount = order.totals.grandTotal;
    } else if (order.summary?.totalAmount) {
        rawAmount = parseFloat(order.summary.totalAmount) || 0;
    } else if (order.payment?.paidAmount) {
        rawAmount = order.payment.paidAmount;
    }

    const displayAmount = formatDisplayAmount(rawAmount);
    const displayStatus = order?.payment?.status || order?.summary?.status || "pending";
    const paymentCompleted = displayStatus.toLowerCase() === "completed";

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.replace("/Home")}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.icon}
                    />
                </TouchableOpacity>
                <Text style={styles.heading}>Order Confirmation</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>

                {/* Error Display */}
                {lastError && (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>⚠️ Last Error</Text>
                        <Text style={styles.errorText}>{lastError}</Text>
                    </View>
                )}

                <View style={styles.card}>
                    <Text style={styles.title}>
                        {paymentCompleted ? "Order Confirmed" : "Payment Pending"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {paymentCompleted
                            ? "Your order has been placed successfully"
                            : "Complete your payment to confirm the order"}
                    </Text>

                    <View style={styles.info}>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Order ID</Text>
                            <Text style={styles.value}>#{displayOrderNumber}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Amount</Text>
                            <Text style={styles.value}>₹{displayAmount *100}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Payment Status</Text>
                            <Text style={[
                                styles.value,
                                paymentCompleted ? styles.successText : styles.pendingText
                            ]}>
                                {displayStatus.toUpperCase()}
                            </Text>
                        </View>

                        {/* Payment Session Status */}
                        {paymentInitialized && !paymentCompleted && paymentData && (
                            <View style={styles.sessionInfo}>
                                <Text style={styles.sessionText}>
                                    💳 Payment session ready - ₹{formatDisplayAmount(paymentData.amount)}
                                </Text>
                                <Text style={styles.sessionSubText}>
                                    Use test card: 4111 1111 1111 1111
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.actions}>
                    {!paymentCompleted && (
                        <>
                            {paymentInitialized ? (
                                <>
                                    <TouchableOpacity
                                        style={styles.primaryButton}
                                        onPress={resumePayment}
                                    >
                                        <Text style={styles.primaryText}>
                                            Continue to Payment
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        onPress={startNewPayment}
                                    >
                                        <Text style={styles.secondaryText}>
                                            Start New Payment Session
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={initializePayment}
                                    disabled={startingPayment}
                                >
                                    {startingPayment ? (
                                        <View style={styles.buttonContent}>
                                            <ActivityIndicator color="white" size="small" />
                                            <Text style={[styles.primaryText, { marginLeft: 10 }]}>
                                                Initializing...
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.primaryText}>
                                            Initialize Payment - ₹{displayAmount * 100}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </>
                    )}

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.push(`/screens/OrderDetailsScreen?id=${orderId}`)}
                    >
                        <Text style={styles.secondaryText}>View Order Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.replace("/Home")}
                    >
                        <Text style={styles.primaryText}>Continue Shopping</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Payment Modal - Only shows when paymentData exists */}
            <Modal
                visible={showPaymentModal && paymentData !== null}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handlePaymentClose}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            Secure Payment - ₹{paymentData ? formatDisplayAmount(paymentData.amount) : '0.00'}
                        </Text>
                        <TouchableOpacity
                            onPress={handlePaymentClose}
                            style={styles.closeButton}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
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
    container: { flex: 1, backgroundColor: "#F8F9FA" },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        padding: 20,
        paddingTop: 60,
        backgroundColor: "white",
        elevation: 2
    },
    icon: { width: 32, height: 32 },
    heading: { fontSize: 22, fontWeight: "600", marginLeft: 20 },
    loading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8F9FA"
    },
    scroll: { padding: 20, paddingTop: 10 },
    errorCard: {
        backgroundColor: "#FFEAA7",
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: "#FDCB6E"
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#E17055",
        marginBottom: 4
    },
    errorText: {
        color: "#E17055",
        fontSize: 14,
        lineHeight: 18
    },
    card: {
        backgroundColor: "#FFF",
        padding: 24,
        borderRadius: 12,
        elevation: 3,
        marginBottom: 20
    },
    title: { fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 8 },
    subtitle: { textAlign: "center", color: "#666", marginBottom: 20 },
    info: { backgroundColor: "#F8F9FA", padding: 16, borderRadius: 10 },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
    },
    sessionInfo: {
        backgroundColor: "#E8F5E8",
        padding: 12,
        borderRadius: 6,
        marginTop: 8,
        alignItems: "center"
    },
    sessionText: {
        color: "#2E7D32",
        fontSize: 14,
        fontWeight: "500"
    },
    sessionSubText: {
        color: "#2E7D32",
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8
    },
    label: { fontSize: 14, color: "#555" },
    value: { fontSize: 16, fontWeight: "600" },
    successText: { color: "#4CAF50" },
    pendingText: { color: "#FF9800" },
    actions: { gap: 12 },
    primaryButton: {
        backgroundColor: "#4CAD73",
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: "center",
        minHeight: 56,
        justifyContent: 'center'
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    primaryText: { color: "white", fontSize: 16, fontWeight: "600" },
    secondaryButton: {
        borderWidth: 1,
        borderColor: "#4CAD73",
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: "center"
    },
    secondaryText: { color: "#4CAD73", fontSize: 16, fontWeight: "600" },
    modalContainer: {
        flex: 1,
        backgroundColor: "white"
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#E0E0E0",
        paddingTop: 60
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333"
    },
    closeButton: {
        padding: 8
    },
    closeButtonText: {
        fontSize: 20,
        color: "#666",
        fontWeight: "bold"
    }
});
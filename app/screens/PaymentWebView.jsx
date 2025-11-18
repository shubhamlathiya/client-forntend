import React, { useRef, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export default function PaymentWebView({ orderData, onSuccess, onError, onClose }) {
    const { amount, orderId, keyId, currency = "INR", billingAddress = {}, user = {} } = orderData;
    const amountInPaise = parseInt(amount); // Razorpay expects amount in paise
    const webviewRef = useRef(null);

    // Use billingAddress and user info for prefill
    const customerName = billingAddress.name || user.name || "Customer";
    const customerEmail = user.email || "customer@example.com";
    const customerPhone = billingAddress.phone || user.phone || "+919876543210";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Razorpay Payment</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
            body { margin: 0; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f5f5f5; }
            .container { text-align: center; padding: 20px; }
            .loading { font-size: 18px; color: #333; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="loading">Loading Payment Gateway...</div>
        </div>
        <script>
            var modalOpen = false;

            var options = {
                key: "${keyId}",
                amount: "${amountInPaise}",
                currency: "${currency}",
                name: "Your Store",
                description: "Order Payment",
                order_id: "${orderId}",
                handler: function (response) {
                    modalOpen = false;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SUCCESS', data: response }));
                },
                prefill: {
                    name: "${customerName}",
                    email: "${customerEmail}",
                    contact: "${customerPhone}"
                },
                notes: { order_id: "${orderId}" },
                theme: { color: "#4CAD73" }
            };

            var rzp1 = new Razorpay(options);

            function openRazorpay() {
                if (!modalOpen) {
                    modalOpen = true;
                    rzp1.open();
                }
            }

            rzp1.on('payment.failed', function (response) {
                modalOpen = false;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FAILED', data: response.error }));
            });

            rzp1.on('payment.cancelled', function (response) {
                modalOpen = false;
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CANCELLED', data: response }));
            });

            document.addEventListener('visibilitychange', function() {
                if (document.hidden && modalOpen) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MODAL_CLOSED' }));
                    modalOpen = false;
                }
            });
        </script>
    </body>
    </html>
  `;

    const handleMessage = (event) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);
            switch (message.type) {
                case 'SUCCESS':
                    onSuccess(message.data);
                    break;
                case 'FAILED':
                    onError(message.data);
                    break;
                case 'CANCELLED':
                case 'MODAL_CLOSED':
                    onClose();
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing WebView message:', error);
        }
    };

    const handleLoadEnd = () => {
        // Open Razorpay after WebView loads
        webviewRef.current.injectJavaScript('openRazorpay();');
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        onError({ description: 'Failed to load payment page' });
        console.error('WebView error:', nativeEvent);
    };

    return (
        <View style={{ flex: 1 }}>
            <WebView
                ref={webviewRef}
                source={{ html: htmlContent }}
                onMessage={handleMessage}
                onLoadEnd={handleLoadEnd}
                onError={handleError}
                startInLoadingState={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                renderLoading={() => (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                        <ActivityIndicator size="large" color="#4CAD73" />
                        <Text style={{ marginTop: 10, color: '#666' }}>Loading payment gateway...</Text>
                    </View>
                )}
                style={{ flex: 1 }}
            />
        </View>
    );
}

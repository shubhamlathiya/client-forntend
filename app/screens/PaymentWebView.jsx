import React, { useRef, useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from "@react-native-async-storage/async-storage";

async function fetchUserDataFromStorage() {
    try {
        const jsonValue = await AsyncStorage.getItem('userData');
        if (jsonValue !== null) {
            return JSON.parse(jsonValue);
        }
        return null;
    } catch (error) {
        console.error('❌ Error fetching user data:', error);
        return null;
    }
}

export default function PaymentWebView({ orderData, onSuccess, onError, onClose }) {
    const {
        amount,
        orderId,
        keyId,
        currency = "INR",
        billingAddress: propBillingAddress = {},
        user: propUser = {}
    } = orderData;

    const [fetchedUser, setFetchedUser] = useState(null);
    const [isDataLoading, setIsDataLoading] = useState(true);

    const webviewRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPrefillData = async () => {
            if (!propUser || !propUser.email || !propUser.phone) {
                const storedUser = await fetchUserDataFromStorage();
                if (storedUser) {
                    setFetchedUser(storedUser);
                }
            }
            setIsDataLoading(false);
        };
        loadPrefillData();
    }, [propUser]);

    const finalUser = {
        ...propUser,
        ...(fetchedUser || {})
    };
    const finalBillingAddress = propBillingAddress;

    // Amount handling
    const amountInPaise = typeof amount === 'string' ?
        Math.round(parseFloat(amount)) :
        Math.round(Number(amount));

    // Prefill Data
    const customerName = finalBillingAddress.name || finalUser.name || "Customer";
    const customerEmail = finalUser.email || "customer@example.com";
    const phoneFromBilling = finalBillingAddress.phone ? String(finalBillingAddress.phone) : '';
    const phoneFromUser = finalUser.phone ? String(finalUser.phone) : '';
    const customerPhone = phoneFromBilling || phoneFromUser || "9876543210";

    // Format phone properly
    const formattedPhone = customerPhone.replace(/^(\+91|91|0)/, '').substring(0, 10);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Razorpay Payment</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                background: #f7f7f7;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container { 
                text-align: center; 
                padding: 20px;
                max-width: 90%;
            }
            .loading { 
                font-size: 16px; 
                color: #4CAD73; 
                margin-bottom: 10px; 
            }
            .debug-info {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 15px;
                margin: 10px 0;
                text-align: left;
                font-size: 12px;
                max-height: 200px;
                overflow-y: auto;
            }
            .debug-title {
                font-weight: bold;
                margin-bottom: 5px;
                color: #495057;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="loading">Initializing Payment Gateway...</div>
            <div id="status"></div>
            <div id="debug" class="debug-info" style="display: none;">
                <div class="debug-title">Debug Information:</div>
                <div id="debug-content"></div>
            </div>
            <div id="error" style="color: red; margin-top: 10px; display: none;"></div>
        </div>

        <script>
            // Capture ALL console logs and send to React Native
            const originalConsoleLog = console.log;
            const originalConsoleError = console.error;
            const originalConsoleWarn = console.warn;

            console.log = function(...args) {
                originalConsoleLog.apply(console, args);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CONSOLE_LOG',
                    data: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
                }));
            };

            console.error = function(...args) {
                originalConsoleError.apply(console, args);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CONSOLE_ERROR',
                    data: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
                }));
            };

            console.warn = function(...args) {
                originalConsoleWarn.apply(console, args);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CONSOLE_WARN',
                    data: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
                }));
            };

            let modalOpen = false;
            let debugLogs = [];

            function addDebugLog(message) {
                debugLogs.push(new Date().toISOString() + ' - ' + message);
                const debugContent = document.getElementById('debug-content');
                if (debugContent) {
                    debugContent.innerHTML = debugLogs.join('<br>');
                }
            }

            function showStatus(message, isError = false) {
                const statusEl = document.getElementById('status');
                if (statusEl) {
                    statusEl.textContent = message;
                    statusEl.style.color = isError ? 'red' : '#4CAD73';
                }
            }

            function showError(message) {
                const errorEl = document.getElementById('error');
                if (errorEl) {
                    errorEl.textContent = message;
                    errorEl.style.display = 'block';
                }
                showStatus(message, true);
            }

            function initializePayment() {
                try {
                    addDebugLog('Starting Razorpay initialization...');
                    showStatus('Creating payment session...');

                    // Show debug panel
                    const debugEl = document.getElementById('debug');
                    if (debugEl) debugEl.style.display = 'block';
                    

                    const options = {
                        key: "${keyId}",
                        amount: ${amountInPaise},
                        currency: "${currency}",
                        name: "Your Store",
                        description: "Order Payment",
                        order_id: "${orderId}",
                        prefill: {
                            name: "${customerName}",
                            email: "${customerEmail}",
                            contact: "${formattedPhone}"
                        },
                        notes: {
                            order_id: "${orderId}",
                            source: "react_native_app",
                            app_name: "YourApp"
                        },
                        theme: {
                            color: "#4CAD73",
                            backdrop_color: "#00000080"
                        },
                        // Try with minimal configuration first
                        method: {
                            netbanking: true,
                            card: true,
                            upi: true,
                            wallet: true
                        },
                        retry: {
                            enabled: false // Disable retry for debugging
                        },
                        modal: {
                            ondismiss: function() {
                                addDebugLog('Modal dismissed by user');
                                if (modalOpen) {
                                    modalOpen = false;
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ 
                                        type: 'MODAL_CLOSED' 
                                    }));
                                }
                            },
                            escape: true,
                            handleback: true
                        },
                        // Add handler for payment success
                        handler: function(response) {
                            addDebugLog('Payment success handler called');
                            console.log('💰 Payment Success Response:', response);
                            modalOpen = false;
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'SUCCESS',
                                data: response
                            }));
                        }
                    };

                    addDebugLog('Razorpay options configured');

                    // Validate key
                    if (!options.key || options.key === 'undefined') {
                        throw new Error('Razorpay key is missing or invalid');
                    }

                    addDebugLog('Creating Razorpay instance...');
                    const rzp1 = new Razorpay(options);

                    // SUCCESS handler (backup)
                    rzp1.on('payment.success', function(response) {
                        addDebugLog('Payment success event received');
                        console.log('✅ Payment Success Event:', response);
                        modalOpen = false;
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'SUCCESS',
                            data: response
                        }));
                    });

                    // FAILED handler with maximum details
                    rzp1.on('payment.failed', function (response) {
    addDebugLog('Payment failed event received');
    console.log('❌ Payment Failed - RAW Response:', response);

    const safeError = response?.error || {};

    const errorDetail = {
        code: safeError.code || 'UNKNOWN',
        description: safeError.description || response?.description || 'Payment failed',
        source: safeError.source || null,
        step: safeError.step || null,
        reason: safeError.reason || null,
        metadata: safeError.metadata || {},
        payment_id: safeError.metadata?.payment_id || null,
        order_id: safeError.metadata?.order_id || "${orderId}",
        full_response: response,
        full_error: safeError
    };
    
    modalOpen = false;
    window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FAILED',
        data: errorDetail
    }));
});


                    // Other handlers
                    rzp1.on('payment.cancelled', function(response) {
                        addDebugLog('Payment cancelled by user');
                        console.log('⚠️ Payment Cancelled:', response);
                        modalOpen = false;
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'CANCELLED',
                            data: response
                        }));
                    });

                    rzp1.on('modal.close', function() {
                        addDebugLog('Modal close event');
                        modalOpen = false;
                    });

                    // Open the modal
                    addDebugLog('Opening Razorpay modal...');
                    showStatus('Opening payment interface...');
                    modalOpen = true;
                    
                    setTimeout(() => {
                        rzp1.open();
                        addDebugLog('Razorpay open() called');
                    }, 1000);

                    // Safety timeout
                    setTimeout(() => {
                        if (modalOpen) {
                            addDebugLog('Modal timeout - forcing close');
                            modalOpen = false;
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'MODAL_TIMEOUT'
                            }));
                        }
                    }, 300000);

                } catch (error) {
                    addDebugLog('Initialization error: ' + error.message);
                    console.error('💥 Initialization Error Details:', error);
                    showError('Failed to initialize payment: ' + error.message);
                    
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'INIT_ERROR',
                        data: { 
                            description: error.message,
                            stack: error.stack
                        }
                    }));
                }
            }

            // Check Razorpay SDK
            addDebugLog('Checking Razorpay SDK availability...');
            
            if (typeof Razorpay === 'undefined') {
                const errorMsg = 'Razorpay SDK not loaded - check internet connection';
                addDebugLog(errorMsg);
                showError(errorMsg);
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SDK_LOAD_ERROR',
                    data: { description: errorMsg }
                }));
            } else {
                addDebugLog('Razorpay SDK loaded successfully');
                console.log('✅ Razorpay SDK Version:', Razorpay.version);
                
                // Initialize when ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                        addDebugLog('DOM loaded, initializing payment...');
                        initializePayment();
                    });
                } else {
                    addDebugLog('DOM already ready, initializing payment...');
                    initializePayment();
                }
            }

            // Global error handler
            window.addEventListener('error', function(e) {
                addDebugLog('Global error: ' + e.message);
                console.error('🌐 Global Error Event:', e);
            });

        </script>
    </body>
    </html>
    `;

    const handleMessage = (event) => {
        setIsLoading(false);
        try {
            const message = JSON.parse(event.nativeEvent.data);
            console.log('📨 WebView Message:', message.type, message.data);

            switch (message.type) {
                case 'SUCCESS':
                    onSuccess(message.data);
                    break;

                case 'FAILED':
                    console.error('💥 Payment failed with COMPLETE details:', JSON.stringify(message.data, null, 2));


                    onError(message.data);
                    break;

                case 'CANCELLED':
                    console.log('👤 Payment cancelled by user');
                    onClose();
                    break;

                case 'MODAL_CLOSED':
                    console.log('🔒 Payment modal closed');
                    onClose();
                    break;

                case 'CONSOLE_LOG':

                    break;

                case 'CONSOLE_ERROR':

                    break;

                case 'CONSOLE_WARN':
                    console.warn('🌐 WebView Warn:', message.data);
                    break;

                case 'INIT_ERROR':
                    console.error('🚨 Payment initialization error:', message.data);
                    onError(message.data);
                    break;

                case 'SDK_LOAD_ERROR':
                    console.error('🌐 Razorpay SDK load error:', message.data);
                    onError(message.data);
                    break;

                default:
                    console.log('❓ Unknown message type:', message.type, message.data);
            }
        } catch (error) {
            console.error('❌ Error parsing WebView message:', error);
            onError({ description: 'Error processing payment response.' });
        }
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('🌐 WebView loading error:', nativeEvent);
        onError({ description: 'Failed to load payment page.' });
        setIsLoading(false);
    };

    const handleLoadEnd = () => {
        setIsLoading(false);
    };

    if (isDataLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#4CAD73" />
                <Text style={styles.loadingText}>Loading payment data...</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <WebView
                ref={webviewRef}
                source={{ html: htmlContent }}
                onMessage={handleMessage}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={handleLoadEnd}
                onError={handleError}
                startInLoadingState={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback={true}
                renderLoading={() => (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#4CAD73" />
                        <Text style={styles.loadingText}>Initializing payment gateway...</Text>
                    </View>
                )}
                style={{ flex: 1 }}
            />
        </View>
    );
}

const styles = {
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 20
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 16
    }
};
import apiClient from '../utils/apiClient';

/* -----------------------------------------------
   Get all enabled payment methods
------------------------------------------------ */
export const getPaymentMethods = async () => {
    try {
        const response = await apiClient.get('/api/payments/methods');
        console.log(response.data)
        return response.data;
    } catch (error) {
        console.error('Get payment methods error:', error);
        throw error;
    }
};

/* -----------------------------------------------
   Initiate payment for an order
   (COD / Razorpay / Stripe / PayPal / PayTM)
------------------------------------------------ */
export const initiatePayment = async (orderId, paymentMethod) => {
    try {
        const response = await apiClient.post('/api/payments/initiate', {
            orderId,
            paymentMethod
        });
        return response.data;
    } catch (error) {
        console.error('Initiate payment error:', error);
        throw error;
    }
};

/* -----------------------------------------------
   Create Razorpay Order (used by Razorpay checkout)
------------------------------------------------ */
export const createRazorpayOrder = async (payload) => {
    try {
        const response = await apiClient.post('/api/payments/razorpay/order', payload);
        return response.data;
    } catch (error) {
        console.error('Create Razorpay order error:', error);
        throw error;
    }
};

/* -----------------------------------------------
   Verify Razorpay Payment
------------------------------------------------ */
export const verifyRazorpayPayment = async (verificationData) => {
    try {
        const response = await apiClient.post('/api/payments/razorpay/verify', verificationData);
        return response.data;
    } catch (error) {
        console.error('Verify Razorpay payment error:', error);
        throw error;
    }
};

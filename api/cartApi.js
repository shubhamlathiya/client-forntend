import apiClient from "../utils/apiClient";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getOrCreateSessionId = async () => {
    try {
        let sid = await AsyncStorage.getItem('sessionId');
        if (sid) return sid;
        // Create a new guest session id and store it
        sid = `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('sessionId', sid);
        // console.log('Session ID created:', sid);
        return sid;
    } catch (err) {
        console.warn('getOrCreateSessionId error:', err);
        return null;
    }
};

const getIdentity = async () => {
    try {
        const token = await SecureStore.getItemAsync('accessToken');
        const sessionId = await getOrCreateSessionId();
        return {isAuthenticated: !!token, sessionId};
    } catch (_) {
        const sessionId = await getOrCreateSessionId();
        return {isAuthenticated: false, sessionId};
    }
};

// Add item to cart (product or variant)
export const addCartItem = async ({productId, variantId = null, quantity = 1}) => {
    const {isAuthenticated, sessionId} = await getIdentity();
    const body = {
        productId,
        ...(variantId ? {variantId} : {}),
        quantity,
        sessionId, // Always send sessionId
    };
    const res = await apiClient.post('/api/cart/item', body);
    console.log('Cart Add Response:', res?.data);
    return res.data;
};

// Fetch current cart
export const getCart = async () => {
    try {
        const {sessionId} = await getIdentity();

        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        const params = {sessionId};
        const res = await apiClient.get('/api/cart', {params});
        // console.log('Cart Fetch Response:', res?.data);
        return res.data;

    } catch (error) {
        // If cart not found (404), create a new one
        if (error.response?.status === 404) {
            console.log('Cart not found, creating new cart...');
            return await createNewCart();
        }

        // Re-throw other errors
        console.error('Get cart error:', error);
        throw error;
    }
};

// Helper function to create a new cart
export const createNewCart = async () => {
    try {
        const {sessionId, isAuthenticated} = await getIdentity();

        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        // Create a new empty cart
        const newCart = {
            sessionId,
            userId: isAuthenticated ? (await getCurrentUserId()) : null,
            items: [],
            cartTotal: 0,
            discount: 0,
            couponCode: null
        };

        // You might need to create an API endpoint for creating carts
        // For now, we'll simulate creating a cart by returning an empty cart structure
        console.log('Created new empty cart for session:', sessionId);

        return {
            success: true,
            data: newCart,
            message: 'New cart created'
        };

    } catch (error) {
        console.error('Create cart error:', error);
        throw error;
    }
};

// Helper function to get current user ID (you'll need to implement this based on your auth system)
const getCurrentUserId = async () => {
    try {
        // Get user ID from your auth system
        // This is just an example - adjust based on your actual auth implementation
        const userData = await SecureStore.getItemAsync('userData');
        if (userData) {
            const user = JSON.parse(userData);
            return user.id;
        }
        return null;
    } catch (error) {
        console.error('Get user ID error:', error);
        return null;
    }
};

// Remove cart item
export const removeCartItem = async (productId, variantId = null) => {
    if (!productId) throw new Error('productId is required');

    const {sessionId} = await getIdentity();

    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    const body = {
        sessionId,
        productId: String(productId),
        variantId: variantId ? String(variantId) : null
    };
    console.log(body);
    const res = await apiClient.delete(`/api/cart/item`, {data: body});
    console.log('Cart Remove Response:', res?.data);
    return res.data;
};

// Update quantity for cart item
export const updateCartItem = async (itemId, quantity) => {
    if (!itemId) throw new Error('itemId is required');

    const {sessionId} = await getIdentity();

    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    const body = {
        sessionId,
        quantity: quantity
    };

    const res = await apiClient.put(`/api/cart/item/${itemId}`, body);
    console.log('Cart Update Response:', res?.data);
    return res.data;
};

// Clear entire cart
export const clearCart = async () => {
    const {sessionId} = await getIdentity();

    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    const res = await apiClient.delete(`/api/cart/${sessionId}`);
    console.log('Cart Clear Response:', res?.data);
    return res.data;
};

export const applyCoupon = async (couponCode) => {
    try {
        // Validate required parameters
        if (!couponCode || typeof couponCode !== 'string' || couponCode.trim() === '') {
            throw new Error('Valid coupon code is required');
        }

        const {sessionId} = await getIdentity();

        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        // Construct request body
        const body = {
            couponCode: couponCode.trim(),
            sessionId: sessionId
        };

        // console.log('Applying coupon with body:', body);

        const response = await apiClient.post('/api/cart/coupon', body);

        // console.log('Cart Coupon Apply Response:', response?.data.message);

        return {
            success: true,
            data: response.data,
            message: response?.data.message
        };

    } catch (error) {
        console.error('Apply coupon error:', {
            message: error.message,
            response: error.response?.data,
            couponCode
        });

        // Return structured error response
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            code: error.response?.status,
            data: null
        };
    }
};

export const removeCoupon = async () => {
    const {sessionId} = await getIdentity();

    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    const body = {sessionId};
    const res = await apiClient.delete('/api/cart/coupon', {data: body});
    console.log('Cart Coupon Remove Response:', res?.data);
    return res.data;
};

export const mergeGuestCart = async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
        console.warn('Merge Cart Skipped: no access token');
        return null;
    }
    const sessionId = await AsyncStorage.getItem('sessionId');
    if (!sessionId) {
        console.warn('Merge Cart Skipped: no sessionId');
        return null;
    }
    const res = await apiClient.post(`/api/cart/merge/${sessionId}`);
    console.log('Cart Merge Response:', res?.data);
    return res.data;
};

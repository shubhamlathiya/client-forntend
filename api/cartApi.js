import apiClient from "../utils/apiClient";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {getCurrentSessionId, getIdentity, getSelectedAddressId, getUserType} from "./sessionManager";
import {isNotificationCart, restoreOriginalSession} from "./cartNotificationHelpers";


// Helper function to get current user ID
const getCurrentUserId = async () => {
    try {
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

const getFreshSessionId = async () => {
    return await getCurrentSessionId();
};

let lastSessionId = null;
// Fetch current cart
export const getCart = async (forceRefresh = false) => {
    try {
        const sessionId = await getFreshSessionId();
        const loginType = await getUserType();
        const addressId = await getSelectedAddressId();

        lastSessionId = sessionId;

        const params = {
            sessionId,
            loginType,
            addressId,
            isNotificationCart: await isNotificationCart(),
        };

        // console.log("🔍 getCart REQUEST:", params);

        const res = await apiClient.get("/api/cart", { params });

        // console.log("📦 getCart RESPONSE:", {
        //     status: res.status,
        //     cartId: res.data?._id,
        //     items: res.data?.items?.length
        // });

        return res.data;
    } catch (err) {
        console.error("getCart error:", err);

        // Handle missing notification cart
        if (err.response?.status === 404) {
            if (await isNotificationCart()) {
                console.log("Notification cart missing. Restoring original session.");
                await restoreOriginalSession();
            }
            return createNewCart();
        }

        // Token expired
        if (err.response?.status === 401) {
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            return createNewCart();
        }

        throw err;
    }
};


// Add item to cart
export const addCartItem = async ({productId, variantId = null, quantity = 1}) => {
    const {sessionId} = await getIdentity();

    const body = {
        productId,
        ...(variantId ? {variantId} : {}),
        quantity,
        sessionId,
    };
    console.log(body)
    const res = await apiClient.post('/api/cart/item', body);
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
    return res.data;
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

    const res = await apiClient.delete(`/api/cart/item`, {data: body});
    return res.data;
};

// Clear entire cart - SIMPLIFIED VERSION
export const clearCart = async () => {
    const {sessionId} = await getIdentity();

    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    try {
        // Try the clear endpoint if it exists
        const res = await apiClient.delete(`/api/cart/clear`, {data: {sessionId}});
        return res.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('Clear cart endpoint not found, creating new cart instead...');
            return await createNewCart();
        }
        throw error;
    }
};

// Alternative clear cart that always works
export const safeClearCart = async () => {
    try {
        // Simply create a new session ID which effectively clears the cart
        const newSessionId = `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('sessionId', newSessionId);

        return {
            success: true,
            data: {
                sessionId: newSessionId,
                items: [],
                cartTotal: 0,
                discount: 0,
                couponCode: null
            },
            message: 'Cart cleared successfully'
        };
    } catch (error) {
        console.error('Safe clear cart error:', error);
        throw error;
    }
};

export const applyCoupon = async (couponCode) => {
    try {
        if (!couponCode || typeof couponCode !== 'string' || couponCode.trim() === '') {
            throw new Error('Valid coupon code is required');
        }

        const {sessionId} = await getIdentity();

        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        const body = {
            couponCode: couponCode.trim(),
            sessionId: sessionId
        };

        const response = await apiClient.post('/api/cart/coupon', body);

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
    return res.data;
};

export const applyTierPricing = async () => {
    try {
        const {sessionId} = await getIdentity();

        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        const body = {sessionId};
        const res = await apiClient.post('/api/cart/apply-tier-pricing', body);
        return res.data;

    } catch (error) {
        console.error('Apply tier pricing error:', error);
        throw error;
    }
};

export const getTierPricing = async (productId = null, variantId = null) => {
    try {
        const params = {};
        if (productId) params.productId = productId;
        if (variantId) params.variantId = variantId;

        const res = await apiClient.get('/api/pricing/tier', { params })
        return res.data;
    } catch (error) {
        console.error("Get tier pricing error:", error);
        throw error;
    }
};

export const createBulkNegotiation = async (negotiationData) => {
    try {
        const res = await apiClient.post('/api/negotiation/create', negotiationData);
        return res.data;
    } catch (error) {
        console.error('Create negotiation error:', error);
        throw error;
    }
};

export const clearAllSessions = async () => {
    try {
        await AsyncStorage.multiRemove([
            'sessionId_individual',
            'sessionId_business',
            'cart',
            'couponCode',
            'userTier',
            'canNegotiate'
        ]);
    } catch (error) {
        console.error('clearAllSessions error:', error);
    }
};

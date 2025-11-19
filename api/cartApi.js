import apiClient from "../utils/apiClient";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getUserType = async () => {
    try {
        const loginType = await AsyncStorage.getItem("loginType");
        return loginType || "individual";
    } catch (error) {
        console.error("getUserType error:", error);
        return "individual";
    }
};

export const getOrCreateSessionId = async (loginType = null) => {
    try {
        // If no loginType provided, get from storage
        if (!loginType) {
            loginType = await getUserType();
        }

        // Create storage key based on login type
        const sessionKey = `sessionId_${loginType}`;
        let sid = await AsyncStorage.getItem(sessionKey);

        console.log(`Session ID for ${loginType}:`, sid);

        if (sid) return sid;

        // Create a new session id for this login type
        sid = `sid_${loginType}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(sessionKey, sid);

        console.log(`Created new session for ${loginType}:`, sid);
        return sid;
    } catch (err) {
        console.warn('getOrCreateSessionId error:', err);
        return null;
    }
};

export const getCurrentSessionId = async () => {
    try {
        const loginType = await getUserType();
        const sessionKey = `sessionId_${loginType}`;
        return await AsyncStorage.getItem(sessionKey);
    } catch (error) {
        console.error('getCurrentSessionId error:', error);
        return null;
    }
};
const getIdentity = async () => {
    try {
        const token = await SecureStore.getItemAsync('accessToken');
        const loginType = await getUserType();
        const sessionId = await getOrCreateSessionId(loginType);
        return {isAuthenticated: !!token, sessionId, loginType};
    } catch (_) {
        const loginType = await getUserType();
        const sessionId = await getOrCreateSessionId(loginType);
        return {isAuthenticated: false, sessionId, loginType};
    }
};

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

// Fetch current cart
export const getCart = async () => {
    try {
        const { sessionId } = await getIdentity();
        const loginType = await getUserType();

        const params = { sessionId, loginType };
        const res = await apiClient.get("/api/cart", { params });
        return res.data;

    } catch (error) {
        const status = error.response?.status;

        if (status === 404) {
            console.log("Cart not found. Creating new cart...");
            await AsyncStorage.removeItem("sessionId");
            return await createNewCart();
        }

        if (status === 401) {
            console.log("Token invalid. Creating fresh cart...");
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            return await createNewCart();
        }

        console.error("Get cart error:", error);
        throw error;
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
        // If clear endpoint doesn't exist, fallback to creating new cart
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

export const getTierPricing = async (productId, variantId = null) => {
    try {
        const res = await apiClient.get('/api/pricing/tier', {
            params: {
                productId,
                variantId: variantId || undefined
            }
        });
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

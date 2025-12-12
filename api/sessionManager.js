import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const getUserType = async () => {
    try {
        const loginType = await AsyncStorage.getItem("loginType");
        return loginType || "individual";
    } catch (error) {
        console.error("getUserType error:", error);
        return "individual";
    }
};

export const getOrCreateSessionId = async (loginType = null, forceNew = false) => {
    try {
        // If no loginType provided, get from storage
        if (!loginType) {
            loginType = await getUserType();
        }

        // Create storage key based on login type
        const sessionKey = `sessionId_${loginType}`;

        if (!forceNew) {
            let sid = await AsyncStorage.getItem(sessionKey);
            if (sid) return sid;
        }

        // Create a new session id
        const sid = `sid_${loginType}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(sessionKey, sid);

        // Also set as current sessionId for compatibility
        await AsyncStorage.setItem("sessionId", sid);

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

export const setCurrentSessionId = async (sessionId) => {
    try {
        const loginType = await getUserType();
        const sessionKey = `sessionId_${loginType}`;
        await AsyncStorage.setItem(sessionKey, sessionId);
        await AsyncStorage.setItem("sessionId", sessionId);
    } catch (error) {
        console.error('setCurrentSessionId error:', error);
    }
};

export const getIdentity = async () => {
    try {
        const token = await SecureStore.getItemAsync('accessToken');
        const loginType = await getUserType();
        const sessionId = await getCurrentSessionId();
        return {isAuthenticated: !!token, sessionId, loginType};
    } catch (_) {
        const loginType = await getUserType();
        const sessionId = await getCurrentSessionId();
        return {isAuthenticated: false, sessionId, loginType};
    }
};

export const getSelectedAddressId = async () => {
    try {
        const saved = await AsyncStorage.getItem('selectedAddress');
        if (!saved) return null;

        const parsed = JSON.parse(saved);
        return parsed?._id || null;
    } catch (e) {
        console.warn("getSelectedAddressId error:", e);
        return null;
    }
};


export const apiCartApi = {
    getUserType,
    getOrCreateSessionId,
    getCurrentSessionId,
    getIdentity
};
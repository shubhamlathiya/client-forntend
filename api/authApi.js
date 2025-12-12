import apiClient, {clearMemoryTokens} from '../utils/apiClient';
import {API_BASE_URL, AUTH_ENDPOINTS} from '../config/apiConfig';
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const registerUser = async ({name = '', email, phone = '', password}) => {
    try {
        const res = await apiClient.post(AUTH_ENDPOINTS.register, {
            name, email, phone: phone || undefined, password
        });

        const data = res.data;

        // Backend returns success: false for errors
        if (data?.success === false) {
            // Throw with the backend message — do NOT enter catch
            throw new Error(data?.message || 'Registration failed');
        }

        return data;

    } catch (error) {
        // Only network / axios errors end up here
        console.log("API Error:", error?.response?.data || error.message);

        // Don't overwrite real backend errors
        throw new Error(error.message || 'Network error. Try again.');
    }
};

export const verifyEmail = async ({email, otp}) => {
    const body = {email, otp};
    const res = await apiClient.post(AUTH_ENDPOINTS.verifyEmail, body);
    return res.data;
};

export const resendVerification = async ({type = 'email', contact}) => {
    const body = {type, contact};
    const res = await apiClient.post(AUTH_ENDPOINTS.resendVerification, body);
    return res.data;
};

export const loginUser = async ({email, password}) => {
    // Backend expects email/phone, but let's keep email for login
    const body = {email, password};
    const res = await apiClient.post(AUTH_ENDPOINTS.login, body);
    return res.data;
};

export const forgotPassword = async ({type = 'email', contact}) => {
    const body = {type, contact};
    const res = await apiClient.post(AUTH_ENDPOINTS.forgotPassword, body);
    return res.data;
};

export const resetPassword = async ({type = 'email', contact, token, newPassword}) => {
    const body = {type, contact, token, newPassword};
    const res = await apiClient.post(AUTH_ENDPOINTS.resetPassword, body);
    return res.data;
};

export const verifyResetOTP = async (data) => {
    const response = await apiClient.post('/api/auth/verify-reset-otp', data);
    return response.data;
};

export const resendResetOTP = async (data) => {
    const response = await apiClient.post('/api/auth/resend-reset-otp', data);
    return response.data;
};


export const uploadProfileImage = async (userId, formData) => {
    try {


        // Validate FormData
        if (!(formData instanceof FormData)) {
            throw new Error("Invalid FormData: expected FormData object");
        }


        formData._parts?.forEach((p) => console.log(" →", p[0], p[1]));

        // Build final URL
        const uploadUrl = `/api/users/profile/${userId}`;
        const fullUrl = API_BASE_URL + uploadUrl;


        // Prepare headers
        const token = await AsyncStorage.getItem("token");
        const headers = {
            Accept: "application/json",
            "Content-Type": "multipart/form-data",
            Authorization: token ? `Bearer ${token}` : "",
        };

        const response = await apiClient.post(uploadUrl, formData, {
            headers, timeout: 20000, maxContentLength: Infinity, maxBodyLength: Infinity,
        });
        return response.data;

    } catch (error) {
        console.log("Error message:", error?.message);
        const backendMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Upload failed";

        throw new Error(backendMessage);
    }
};


export const updateUserPhone = async (userId, name, phone) => {
    try {
        const response = await apiClient.put(`/api/users/updatephone`, {name, phone});

        return response.data;
    } catch (error) {
        console.error('Update phone API error:', error.response?.data || error.message);
        throw error;
    }
};

// Get user profile
export const getUserProfile = async (userId) => {
    try {
        const response = await apiClient.get(`/api/users/profile/${userId}`);
        return response.data;
    } catch (error) {
        console.error('Get profile API error:', error.response?.data || error.message);
        throw error;
    }
};

export const updateUserProfile = async (userId, userData) => {
    try {
        const response = await apiClient.put(`/api/users/update/${userId}`, userData);
        return response.data;
    } catch (error) {
        console.error('Update user error:', error);
        throw error;
    }
};

export const logoutUser = async () => {
    try {
        console.log("🔴 Logging out user…");

        // 1. Clear AsyncStorage
        try {
            const keys = await AsyncStorage.getAllKeys();
            if (keys.length > 0) {
                await AsyncStorage.multiRemove(keys);
            }
        } catch (err) {
            console.log("AsyncStorage clear failed:", err);
        }

        // 2. Clear SecureStore
        const secureKeys = ["accessToken", "refreshToken", "userData", "loginType", "sessionId_individual", "sessionId_business"];

        for (const key of secureKeys) {
            try {
                await SecureStore.deleteItemAsync(key);
            } catch {
            }
        }

        // 3. Remove in-memory tokens
        // Note: clearMemoryTokens should be imported from apiClient
        if (typeof clearMemoryTokens === 'function') {
            clearMemoryTokens();
        }

        // 4. Backend logout (optional)
        try {
            await apiClient.post("/api/auth/logout");
        } catch {
            console.log("Backend logout failed (ignored)");
        }
        console.log("logout success");
        return {success: true};

    } catch (err) {
        console.log("Logout error:", err);
        return {success: false, error: err.message};
    }
};
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { API_BASE_URL } from "../config/apiConfig";

// ---------------------------
// In-memory tokens
// ---------------------------
let accessTokenInMemory = null;

export const setAccessToken = (token) => {
    accessTokenInMemory = token;
};

export const clearMemoryTokens = () => {
    accessTokenInMemory = null;
};

// ---------------------------
// Global logout (safe)
// ---------------------------
export const clearAuthAndLogout = async () => {
    console.log("🔴 Logging out…");

    accessTokenInMemory = null;

    try {
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        await SecureStore.deleteItemAsync("user");
    } catch (err) {
        console.log("Failed to clean tokens:", err);
    }

    router.replace("/screens/LoginScreen");
};

// ---------------------------
// Axios client
// ---------------------------
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
    withCredentials: true,
});

// ---------------------------
// Inject token into requests
// ---------------------------
apiClient.interceptors.request.use(
    async (config) => {
        // Load token only once
        if (!accessTokenInMemory) {
            try {
                accessTokenInMemory = await SecureStore.getItemAsync("accessToken");
            } catch (error) {
                console.log("Error reading token from SecureStore:", error);
            }
        }

        if (accessTokenInMemory) {
            config.headers.Authorization = `Bearer ${accessTokenInMemory}`;
        }

        console.log("🔵 Request:", config.method?.toUpperCase(), config.url);
        return config;
    },
    (err) => Promise.reject(err)
);

// ---------------------------
// Handle token errors
// ---------------------------
apiClient.interceptors.response.use(
    (response) => {
        console.log("✅ Response:", response.status, response.config.url);
        return response;
    },
    async (error) => {
        const status = error?.response?.status || 0;
        const data = error?.response?.data || {};
        const msg = data?.message || "";

        // Token expired / invalid handling
        const tokenExpired =
            status === 401 ||
            msg.toLowerCase().includes("expired") ||
            msg.toLowerCase().includes("invalid token") ||
            JSON.stringify(data).toLowerCase().includes("expired") ||
            JSON.stringify(data).toLowerCase().includes("invalid");

        if (tokenExpired) {
            console.log("🔴 Token expired or invalid");
            await clearAuthAndLogout();
        }

        // Silent handling for "Cart not found"
        if (status === 404 && msg === "Cart not found") {
            console.log("⚠️ Cart not found, returning empty cart silently");
            return Promise.resolve({ data: { items: [] } }); // simulate empty cart response
        }

        // For other errors, return a proper message
        const errorMessage =
            data?.message || data?.error || error.message || "An unknown error occurred";

        return Promise.reject(new Error(errorMessage));
    }
);


export default apiClient;
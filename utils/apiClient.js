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
});

// ---------------------------
// Inject token into requests
// ---------------------------
apiClient.interceptors.request.use(
    async (config) => {
        // Load token only once
        if (!accessTokenInMemory) {
            accessTokenInMemory = await SecureStore.getItemAsync("accessToken");
        }

        if (accessTokenInMemory) {
            config.headers.Authorization = `Bearer ${accessTokenInMemory}`;
        } else {
            // Block all API calls if no token
            if (!config.url.includes("/login")) {
                await clearAuthAndLogout();
                throw new axios.Cancel("Missing token → logout");
            }
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
        const msg = error?.response?.data?.message || "";

        const tokenExpired =
            status === 401 ||
            msg.toLowerCase().includes("expired") ||
            JSON.stringify(error?.response?.data).toLowerCase().includes("expired");

        if (tokenExpired) {
            console.log("🔴 Token expired");
            await clearAuthAndLogout();
        }

        return Promise.reject(error);
    }
);

export default apiClient;

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { API_BASE_URL } from '../config/apiConfig';

// In-memory token to avoid async race conditions
let accessTokenInMemory = null;
export const setAccessToken = (token) => {
    accessTokenInMemory = token;
};

const clearAuthDataAndLogout = async () => {
    console.log('🔴 Logging out and redirecting to login screen...');
    accessTokenInMemory = null;
    try {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
    } catch (e) {
        console.error('Error clearing secure store items:', e);
    }
    router.replace('/screens/LoginScreen');
};

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
    // Use in-memory token first
    if (!accessTokenInMemory) {
        accessTokenInMemory = await SecureStore.getItemAsync('accessToken');
    }

    if (accessTokenInMemory) {
        config.headers.Authorization = `Bearer ${accessTokenInMemory}`;
    } else {
        if (!config.url.includes('/login')) {
            clearAuthDataAndLogout();
            return Promise.reject(new axios.Cancel('Access Token Not Found. Redirecting to Login.'));
        }
    }

    console.log(`🔵 Request → ${config.method?.toUpperCase()} ${config.url}`);
    console.log('   Headers:', config.headers);
    return config;
});

apiClient.interceptors.response.use(
    (response) => {
        console.log(`✅ Response → ${response.status} ${response.config.url}`);
        return response;
    },
    async (error) => {
        if (axios.isCancel(error)) {
            console.log('Request cancelled:', error.message);
            return Promise.reject(error);
        }

        const status = error?.response?.status;
        const msg = error?.response?.data?.message || '';
        const errData = error?.response?.data;

        const isTokenExpired =
            (status === 401 && msg.toLowerCase().includes('expired')) ||
            (status === 500 && JSON.stringify(errData).toLowerCase().includes('jwt expired'));

        if (isTokenExpired || status === 401) {
            console.log(`🔴 Token expired or unauthorized (Status: ${status})`);
            await clearAuthDataAndLogout();
        }

        return Promise.reject(error);
    }
);

export default apiClient;

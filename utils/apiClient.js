import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/apiConfig';
import { router } from 'expo-router';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach access token
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  } catch (e) {}
  return config;
});

apiClient.interceptors.response.use(
    (response) => response,

    async (error) => {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message;
      const errData = error?.response?.data;

      const expired =
          (status === 401 && msg?.toLowerCase()?.includes('expired')) ||
          (status === 500 &&
              typeof errData === 'object' &&
              JSON.stringify(errData).toLowerCase().includes('jwt expired'));

      if (expired) {
        console.log('🔴 JWT expired. Logging out...');

        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');

        router.replace('/screens/LoginScreen');
        return Promise.reject(error);
      }

      return Promise.reject(error);
    }
);

export default apiClient;

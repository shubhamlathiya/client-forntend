import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/apiConfig';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach access token if available
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  } catch (e) {
    // No-op: token read failures should not block requests
  }
  // Dev logging for requests
  try {
    const { method, url, params, data } = config;
    // console.log('[API REQUEST]', method?.toUpperCase(), url, {
    //   params,
    //   data,
    // });
  } catch (_) {}
  return config;
});

// Basic response normalization
apiClient.interceptors.response.use(
  (response) => {
    // try {
    //   const { config, status, data } = response;
    //   console.log('[API RESPONSE]', config?.method?.toUpperCase(), config?.url, {
    //     status,
    //     data,
    //   });
    // } catch (_) {}
    return response;
  },
  async (error) => {
    // Optionally handle refresh flows or global errors here
    try {
      const cfg = error?.config || {};
      const payload = {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      };
      console.warn('[API ERROR]', cfg?.method?.toUpperCase(), cfg?.url, payload);
    } catch (_) {}
    return Promise.reject(error);
  }
);

export default apiClient;

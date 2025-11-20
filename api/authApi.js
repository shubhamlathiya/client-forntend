import apiClient from '../utils/apiClient';
import { AUTH_ENDPOINTS } from '../config/apiConfig';
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const registerUser = async ({ name = '', email, phone = '', password }) => {
  // frontend validation
  const errors = [];

  // email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Must be a valid email address');
  }

  // phone validation (basic)
  if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) {
    errors.push('Must be a valid phone number');
  }

  // password validation
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character');
  }

  // name validation
  if (name && typeof name !== 'string') {
    errors.push('Name must be a string');
  }

  if (errors.length > 0) {
    // show error before API call
    throw new Error(errors.join(', '));
  }

  const formattedPhone = phone.trim() === '' ? null : phone;
  // proceed with API call if valid
  const body = { name, email,  phone: formattedPhone, password };

  const res = await apiClient.post(AUTH_ENDPOINTS.register, body);

  return res.data;
};

export const verifyEmail = async ({ email, otp }) => {
  const body = { email, otp };
  const res = await apiClient.post(AUTH_ENDPOINTS.verifyEmail, body);
  return res.data;
};

export const resendVerification = async ({ type = 'email', contact }) => {
  const body = { type, contact };
  const res = await apiClient.post(AUTH_ENDPOINTS.resendVerification, body);
  return res.data;
};

export const loginUser = async ({ email, password }) => {
  const body = { email, password };
  const res = await apiClient.post(AUTH_ENDPOINTS.login, body);
  return res.data;
};

export const forgotPassword = async ({ type = 'email', contact }) => {
  const body = { type, contact };
  const res = await apiClient.post(AUTH_ENDPOINTS.forgotPassword, body);
  return res.data;
};

export const resetPassword = async ({ type = 'email', contact, token, newPassword }) => {
  const body = { type, contact, token, newPassword };
  const res = await apiClient.post(AUTH_ENDPOINTS.resetPassword, body);
  return res.data;
};


export const logoutUser = async () => {
  try {

    // Clear AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }

    // Clear common SecureStore keys
    const secureKeys = ["accessToken", "refreshToken", "userData"];
    for (const key of secureKeys) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {

      }
    }
    const res = await apiClient.post('/api/auth/logout');
    return res.data;

  } catch (error) {
    console.log("❌ Quick cleanup failed:", error);
    return { success: false, error: error.message };
  }
};
import { Platform } from 'react-native';

// Detect base URL based on platform/runtime
const getBaseURL = () => {
  if (Platform.OS === 'web') {
    return 'https://e-commerce-rho-nine-36.vercel.app';
    // return 'http://192.168.0.119:8000';
  }
  if (Platform.OS === 'android') {
    // Android emulator loopback
    // return 'https://e-commerce-rho-nine-36.vercel.app';
    return 'http://192.168.1.15:8000';

  }
  if (Platform.OS === 'ios') {
    // iOS simulator loopback
    return 'https://e-commerce-rho-nine-36.vercel.app';
    // return 'http://192.168.0.119:8000';
  }

  return 'https://e-commerce-rho-nine-36.vercel.app';
  // return 'http://192.168.0.119:8000';
};

export const API_BASE_URL = getBaseURL();
export const BASE_URL = API_BASE_URL;

// Common endpoints used by auth APIs
export const AUTH_ENDPOINTS = {
  register: '/api/auth/register',
  verifyEmail: '/api/auth/verify-email',
  resendVerification: '/api/auth/resend-verification',
  login: '/api/auth/login',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
};
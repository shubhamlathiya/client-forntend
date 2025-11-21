import apiClient from '../utils/apiClient';
import { getCart } from "./cartApi";
import {getIdentity} from "./sessionManager";

// Generate order summary from current cart and selected address
export const generateOrderSummary = async (addressId = null , cartId = null) => {
  const { sessionId } = await getIdentity();

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const body = {
    sessionId,
    cartId,
    ...(addressId ? { addressId } : {})
  };

  const res = await apiClient.post('/api/orders/summary', body);
  return res.data;
};

// Create final order
export const createOrder = async (payload = {}) => {
  const { sessionId } = await getIdentity();

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  // Get cart ID from storage or payload
  let cartId = payload.cartId;
  if (!cartId) {
    const cartResponse = await getCart();
    cartId = cartResponse.data?._id;
  }

  if (!cartId) {
    throw new Error('Cart ID is required');
  }

  const body = {
    sessionId,
    cartId,
    ...payload
  };

  const res = await apiClient.post('/api/orders', body);

  return res.data;
};

// Get all orders for the current user
export const getOrders = async (params = {}) => {
  const { status, page = 1, limit = 10 } = params;
  const queryParams = new URLSearchParams();

  if (status) queryParams.append('status', status);
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());

  const res = await apiClient.get(`/api/orders?${queryParams.toString()}`);
  return res.data;
};

// Get order by id
export const getOrderById = async (orderId) => {
  const res = await apiClient.get(`/api/orders/${orderId}`);
  return res.data;
};

// Request a return
export const requestReturn = async ({ orderId, items, reason, resolution = 'refund' }) => {
  const body = {
    orderId,
    items,
    reason,
    resolution
  };
  const res = await apiClient.post('/api/orders/return', body);
  return res.data;
};

// Request a replacement
export const requestReplacement = async ({ orderId, items, reason, images = [] }) => {
  const body = {
    orderId,
    items,
    reason,
    ...(Array.isArray(images) && images.length ? { images } : {})
  };
  const res = await apiClient.post('/api/orders/replacement', body);
  return res.data;
};

// Admin APIs
export const adminGetAllOrders = async (params = {}) => {
  const { status, userId, page = 1, limit = 20 } = params;
  const queryParams = new URLSearchParams();

  if (status) queryParams.append('status', status);
  if (userId) queryParams.append('userId', userId);
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());

  const res = await apiClient.get(`/api/orders/admin/all?${queryParams.toString()}`);
  return res.data;
};

export const adminUpdateOrderStatus = async (orderId, status, comment = '') => {
  const body = {
    status,
    ...(comment && { comment })
  };
  const res = await apiClient.put(`/api/orders/admin/${orderId}/status`, body);
  return res.data;
};

export const adminProcessOrderAction = async (type, requestId, payload = {}) => {
  const res = await apiClient.put(`/api/orders/admin/${type}/${requestId}`, payload);
  return res.data;
};

// Additional utility functions
export const validateCoupon = async (couponCode) => {
  try {
    const { sessionId } = await getIdentity();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const body = {
      couponCode: couponCode.trim(),
      sessionId
    };

    const response = await apiClient.post('/api/cart/validate-coupon', body);

    return {
      success: true,
      data: response.data,
      isValid: true
    };

  } catch (error) {
    console.error('Validate coupon error:', error);

    return {
      success: false,
      error: error.response?.data?.message || error.message,
      isValid: false,
      data: null
    };
  }
};

// Get order summary by ID
export const getOrderSummary = async (cartId) => {
  if (!cartId) {
    throw new Error('Cart ID is required');
  }

  // This would typically be a GET request to fetch existing summary
  // For now, we'll generate a new one
  return await generateOrderSummary();
};

// Send invoice email
export const sendOrderInvoice = async (orderId) => {
  const res = await apiClient.post(`/api/orders/${orderId}/invoice`);
  return res.data;
};

// Create admin order directly
export const adminCreateOrder = async (orderData) => {
  const res = await apiClient.post('/api/orders/admin/create', orderData);
  return res.data;
};

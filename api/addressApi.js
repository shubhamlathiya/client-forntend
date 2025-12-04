import apiClient from "../utils/apiClient";

// Fetch all addresses for the logged-in user
export const getAddresses = async () => {
  try {
    const res = await apiClient.get('/api/address');
    return res.data;
  } catch (error) {
    console.error('Get addresses error:', error.response?.data || error.message);
    throw error;
  }
};

// Add a new address
export const addAddress = async (body) => {
  try {
    const res = await apiClient.post('/api/address', body);
    return res.data;
  } catch (error) {
    console.error('Add address error:', error.response?.data || error.message);
    throw error;
  }
};

// Update an existing address by id
export const updateAddress = async (id, body) => {
  try {
    if (!id) throw new Error('Address id is required');
    const res = await apiClient.put(`/api/address/${id}`, body);
    return res.data;
  } catch (error) {
    console.error('Update address error:', error.response?.data || error.message);
    throw error;
  }
};

// Delete an address by id
export const deleteAddress = async (id) => {
  try {
    if (!id) throw new Error('Address id is required');
    const res = await apiClient.delete(`/api/address/${id}`);
    return res.data;
  } catch (error) {
    console.error('Delete address error:', error.response?.data || error.message);
    throw error;
  }
};

// Set address as default
export const setDefaultAddress = async (id) => {
  try {
    if (!id) throw new Error('Address id is required');
    const res = await apiClient.post(`/api/address/${id}/default`);
    return res.data;
  } catch (error) {
    console.error('Set default address error:', error.response?.data || error.message);
    throw error;
  }
};

// Select address for checkout
export const selectAddressForCheckout = async (id) => {
  try {
    if (!id) throw new Error('Address id is required');
    const res = await apiClient.post(`/api/address/${id}/select`);
    return res.data;
  } catch (error) {
    console.error('Select address error:', error.response?.data || error.message);
    throw error;
  }
};

// Check if address already exists (helper function)
export const checkAddressExists = async (addressData) => {
  try {
    const res = await apiClient.post('/api/address/check', addressData);
    return res.data;
  } catch (error) {
    // If endpoint doesn't exist, just return null
    return null;
  }
};
import apiClient from "../utils/apiClient";

// Fetch all addresses for the logged-in user
export const getAddresses = async () => {
  const res = await apiClient.get('/api/address');
  return res.data;
};

// Add a new address
export const addAddress = async (body) => {
  const res = await apiClient.post('/api/address', body);
  return res.data;
};

// Update an existing address by id
export const updateAddress = async (id, body) => {
  if (!id) throw new Error('Address id is required');
  const res = await apiClient.put(`/api/address/${id}`, body);
  return res.data;
};

// Delete an address by id
export const deleteAddress = async (id) => {
  if (!id) throw new Error('Address id is required');
  const res = await apiClient.delete(`/api/address/${id}`);
  return res.data;
};

// Set address as default
export const setDefaultAddress = async (id) => {
  if (!id) throw new Error('Address id is required');
  const res = await apiClient.post(`/api/address/${id}/default`);
  return res.data;
};

// Select address for checkout
export const selectAddressForCheckout = async (id) => {
  if (!id) throw new Error('Address id is required');
  const res = await apiClient.post(`/api/address/${id}/select`);
  return res.data;
};


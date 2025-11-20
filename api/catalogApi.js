import apiClient from "../utils/apiClient";

export const getCategories = async () => {
  try {
    const response = await apiClient.get(`/api/catalog/categories`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch categories', error);
    throw error;
  }
};

// Fetch all products
export const getProducts = async ({ page = 1, limit = 20, categoryId = undefined } = {}) => {
  try {
    const params = { page, limit };
    if (categoryId) params.categoryId = categoryId;
    const response = await apiClient.get(`/api/catalog/products`, { params });
    // console.log('[Catalog getProducts] resp:', response?.data.data.items);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch products', error);
    throw error;
  }
};

export const getProductsByCategory = async (categoryId) => {
  try {
    const response = await apiClient.get(`/api/catalog/products?category=${categoryId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching products by category:', error);
    throw error;
  }
};

// Fetch product by id
export const getProductById = async (id) => {
  if (!id) throw new Error('Product id is required');
  try {
    const response = await apiClient.get(`/api/catalog/products/${id}`);

    return response.data;
  } catch (error) {
    console.error(`Failed to fetch product ${id}`, error);
    throw error;
  }
};

// Fetch variants for a product
export const getVariants = async ({ productId, page = 1, limit = 20 }) => {
  if (!productId) throw new Error('productId is required');
  try {
    const params = { productId, page, limit };
    const response = await apiClient.get(`/api/catalog/variants`, { params });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch variants for product ${productId}`, error);
    throw error;
  }
};

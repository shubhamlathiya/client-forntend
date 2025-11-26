import apiClient from "../utils/apiClient";

export const getSaleCategories = async ({
                                            page = 1,
                                            limit = 20,
                                            sort = "sortOrder:asc,name:asc",
                                        } = {}) => {
    try {
        const params = {
            isOnSale: true,
            status: true,
            page,
            limit,
            sort,
        };

        const response = await apiClient.get(`/api/catalog/categories`, {params});
        return response.data;
    } catch (error) {
        console.error("Failed to fetch sale categories", error);
        throw error;
    }
};

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
export const getProducts = async ({page = 1, limit = 20, categoryId = undefined} = {}) => {
    try {
        const params = {page, limit};
        if (categoryId) params.categoryId = categoryId;
        const response = await apiClient.get(`/api/catalog/products`, {params});
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
export const getVariants = async ({productId, page = 1, limit = 20}) => {
    if (!productId) throw new Error('productId is required');
    try {
        const params = {productId, page, limit};
        const response = await apiClient.get(`/api/catalog/variants`, {params});
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch variants for product ${productId}`, error);
        throw error;
    }
};

export const getProductFaqs = async (productId) => {
    if (!productId) throw new Error('Product id is required');
    try {
        const response = await apiClient.get(`/api/catalog/product-faqs/${productId}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch FAQs for product ${productId}`, error);
        throw error;
    }
};

// Wishlist APIs
export const addToWishlist = async (userId, productId) => {
    try {
        const response = await apiClient.post(`/api/wishlist/add`, { userId, productId });
        return response.data;
    } catch (error) {
        console.error('Failed to add to wishlist', error);
        throw error;
    }
};

export const removeFromWishlist = async (userId, productId) => {
    try {
        const response = await apiClient.delete(`/api/wishlist/remove`, { data: { userId, productId } });
        return response.data;
    } catch (error) {
        console.error('Failed to remove from wishlist', error);
        throw error;
    }
};

export const toggleWishlist = async (userId, productId) => {
    try {
        const response = await apiClient.post(`/api/wishlist/toggle`, { userId, productId });
        return response.data;
    } catch (error) {
        console.error('Failed to toggle wishlist', error);
        throw error;
    }
};

export const getWishlist = async (userId) => {
    try {
        const response = await apiClient.get(`/api/wishlist/${userId}`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch wishlist', error);
        throw error;
    }
};

export const checkWishlist = async (userId, productId) => {
    try {
        const response = await apiClient.get(`/api/wishlist/checked/${productId}` );
        return response.data;
    } catch (error) {
        console.error('Failed to check wishlist', error);
        throw error;
    }
};
//
// // Dynamic Tab Category Integration
// export const getTabCategories = async () => {
//     try {
//         const response = await apiClient.get(`/api/tabCategory/tab-categories`);
//         return response.data;
//     } catch (error) {
//         console.error('Failed to fetch tab categories', error);
//         throw error;
//     }
// };
//
// export const getProductsByTab = async (tabId) => {
//     try {
//         const response = await apiClient.get(`/products/by-tab/${tabId}`);
//         return response.data;
//     } catch (error) {
//         console.error('Failed to fetch products by tab', error);
//         throw error;
//     }
// };

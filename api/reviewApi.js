import apiClient from "../utils/apiClient";

export const createReview = async (reviewData) => {
    const response = await apiClient.post('/api/catalog/reviews', reviewData);
    return response.data;
};

export const updateReview = async (reviewId, reviewData) => {
    const response = await apiClient.patch(`/api/catalog/reviews/${reviewId}`, reviewData);
    return response.data;
};

export const deleteReview = async (reviewId) => {
    const response = await apiClient.delete(`/api/catalog/reviews/${reviewId}`);
    return response.data;
};

export const getProductReviews = async (productId, page = 1, limit = 10) => {
    const response = await apiClient.get(`/api/catalog/reviews/product/${productId}`, {
        params: { page, limit }
    });
    return response.data;
};
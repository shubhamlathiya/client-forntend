import React, {useState, useEffect} from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Image,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    TextInput,
    Dimensions
} from "react-native";
import {useRouter, useLocalSearchParams} from "expo-router";
import {createReview, updateReview, getProductReviews} from "../../api/reviewApi";
import {API_BASE_URL} from "../../config/apiConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

const {height: screenHeight, width: screenWidth} = Dimensions.get("window");

export default function FeedbackScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [product, setProduct] = useState(null);
    const [order, setOrder] = useState(null);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);
    const [productReviews, setProductReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    const {product: productParam, order: orderParam} = params;

    // Load user info once
    const loadCurrentUser = async () => {
        try {
            const stored = await AsyncStorage.getItem("userData");
            if (stored) {
                const parsed = JSON.parse(stored);
                setCurrentUserId(parsed?._id || parsed?.id);
            }
        } catch (err) {
            console.log("Error loading user:", err);
        }
    };

    // Parse product and order params
    useEffect(() => {
        if (productParam) {
            try {
                setProduct(JSON.parse(productParam));
            } catch (err) {
                console.error("Error parsing product:", err);
            }
        }
        if (orderParam) {
            try {
                setOrder(JSON.parse(orderParam));
            } catch (err) {
                console.error("Error parsing order:", err);
            }
        }
        loadCurrentUser();
    }, [productParam, orderParam]);

    // Load reviews when product changes
    useEffect(() => {
        if (product) {
            loadProductReviews(product.productId || product._id);
        }
    }, [product]);

    const loadProductReviews = async (productId) => {
        try {
            setReviewsLoading(true);
            const response = await getProductReviews(productId);
            setProductReviews(Array.isArray(response.data?.productReviews) ? response.data.productReviews : []);
        } catch (error) {
            console.error("Error loading reviews:", error);
            setProductReviews([]);
        } finally {
            setReviewsLoading(false);
        }
    };

    // Set rating/comment if user has already reviewed
    useEffect(() => {
        if (!currentUserId || !productReviews.length) return;

        const review = productReviews.find((r) => r.userId === currentUserId);
        if (review) {
            setRating(review.rating);
            setComment(review.comment || "");
        }
    }, [productReviews, currentUserId]);

    const submitReview = async () => {
        if (!rating) return Alert.alert("Error", "Please select a rating");
        if (!product) return Alert.alert("Error", "No product selected");

        try {
            setSubmittingReview(true);
            const reviewData = {
                productId: product.productId || product._id, rating, comment: comment.trim() || ""
            };
            await createReview(reviewData);

            Alert.alert("Success", "Review submitted successfully!", [{
                text: "OK", onPress: () => router.replace("/screens/MyOrderScreen")
            }]);
        } catch (error) {
            console.error("Error submitting review:", error);
            Alert.alert("Error", "Failed to submit review. Please try again.");
        } finally {
            setSubmittingReview(false);
        }
    };

    const updateExistingReview = async (reviewId) => {
        if (!rating) return Alert.alert("Error", "Please select a rating");

        try {
            setSubmittingReview(true);
            const reviewData = {rating, comment: comment.trim() || ""};
            await updateReview(reviewId, reviewData);

            Alert.alert("Success", "Review updated successfully!", [{
                text: "OK", onPress: () => router.replace("/screens/MyOrderScreen")
            }]);
        } catch (error) {
            console.error("Error updating review:", error);
            Alert.alert("Error", "Failed to update review. Please try again.");
        } finally {
            setSubmittingReview(false);
        }
    };

    const hasUserReviewed = () => currentUserId && productReviews.some((r) => r.userId === currentUserId);

    const getUserReview = () => currentUserId && productReviews.find((r) => r.userId === currentUserId);

    const userReview = getUserReview();
    const isEditing = !!userReview;

    const formatDate = (dateString) => {
        if (!dateString) return "Date not available";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"});
    };

    const getProductImage = () => {
        if (!product?.image) return require("../../assets/icons/order.png");
        if (product.image.startsWith("http") || product.image.startsWith("file://")) return {uri: product.image};
        return {uri: `${API_BASE_URL}${product.image.startsWith("/") ? product.image : "/" + product.image}`};
    };

    const handleBack = () => {
        if (router.canGoBack()) router.back(); else router.replace("/screens/MyOrderScreen");
    };

    if (!product) {
        return (<SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAD73"/>
                    <Text style={styles.loadingText}>Loading product information...</Text>
                </View>
            </SafeAreaView>);
    }

    const StarRating = ({rating, onRatingChange, size = 32, editable = true}) => (<View style={styles.starContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => editable && onRatingChange(star)} style={styles.starButton}
                                  disabled={!editable}>
                    <Image
                        source={star <= rating ? require("../../assets/icons/star_filled.png") : require("../../assets/icons/star_empty.png")}
                        style={{width: size, height: size}}
                    />
                </TouchableOpacity>))}
        </View>);

    return (<View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>

            {/* Header */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack}>
                    <Image source={require("../../assets/icons/back_icon.png")} style={styles.iconBox}/>
                </TouchableOpacity>
                <Text style={styles.heading}>{isEditing ? "Edit Review" : "Write a Review"}</Text>
                <View style={styles.placeholder}/>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Product Info */}
                <View style={styles.productReviewSection}>
                    <Image source={getProductImage()} style={styles.reviewProductImage}
                           defaultSource={require("../../assets/icons/order.png")}/>
                    <View style={styles.reviewProductInfo}>
                        <Text style={styles.reviewProductName} numberOfLines={2}>
                            {product.name || product.title || "Product"}
                        </Text>
                        <Text style={styles.reviewProductBrand}>{product.brand || ""}</Text>
                        {order && <Text style={styles.orderInfo}>Order
                            #{(order.orderNumber || order._id?.substring(18) || "N/A").substring(0, 18)}...</Text>}
                    </View>
                </View>

                {/* Rating Section */}
                <View style={styles.ratingSection}>
                    <Text style={styles.ratingTitle}>How would you rate this product?</Text>
                    <StarRating rating={rating} onRatingChange={setRating} size={32} editable={true}/>
                    <Text
                        style={styles.ratingText}>{rating > 0 ? `${rating} Star${rating > 1 ? "s" : ""}` : "Tap to rate"}</Text>
                </View>

                {/* Comment Section */}
                <View style={styles.commentSection}>
                    <Text style={styles.commentTitle}>Share your experience (optional)</Text>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="What did you like or dislike about this product?"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        placeholderTextColor="#999"
                    />
                </View>

                {/* Existing Reviews */}
                {productReviews.length > 0 && (<View style={styles.existingReviewsSection}>
                        <Text style={styles.sectionTitle}>Recent Reviews</Text>
                        {productReviews.slice(0, 3).map((review, index) => (
                            <View key={review._id || index} style={styles.reviewItem}>
                                <View style={styles.reviewHeader}>
                                    <Text style={styles.reviewerName}>{review.userId?.name || "Anonymous User"}</Text>
                                    <View style={styles.reviewRating}>
                                        <Text style={styles.reviewRatingText}>{review.rating}</Text>
                                        <Image source={require("../../assets/icons/star_filled.png")}
                                               style={styles.smallStar}/>
                                    </View>
                                </View>
                                {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                                <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                            </View>))}
                    </View>)}
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.reviewActions}>
                <TouchableOpacity
                    style={[styles.submitButton, (!rating || submittingReview) && styles.submitButtonDisabled]}
                    onPress={isEditing ? () => updateExistingReview(userReview._id) : submitReview}
                    disabled={!rating || submittingReview}
                >
                    {submittingReview ? <ActivityIndicator size="small" color="#FFFFFF"/> :
                        <Text style={styles.submitButtonText}>{isEditing ? "Update Review" : "Submit Review"}</Text>}
                </TouchableOpacity>
            </View>
        </View>);
}

const styles = StyleSheet.create({
    container: {flex: 1, backgroundColor: "#FFFFFF"},
    topBar: {padding: 20, marginTop: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center"},
    heading: {fontSize: 20, fontWeight: "600", color: "#1B1B1B", textAlign: "center", flex: 1},
    iconBox: {width: 32, height: 32, borderRadius: 8},
    placeholder: {width: 32},
    scrollView: {flex: 1, padding: 16},
    loadingContainer: {flex: 1, justifyContent: "center", alignItems: "center", gap: 16},
    loadingText: {fontSize: 16, color: "#868889"},
    productReviewSection: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
        padding: 16,
        backgroundColor: "#F9F9F9",
        borderRadius: 12
    },
    reviewProductImage: {width: 80, height: 80, borderRadius: 8, marginRight: 16},
    reviewProductInfo: {flex: 1},
    reviewProductName: {fontSize: 18, fontWeight: "600", color: "#000000", marginBottom: 4},
    reviewProductBrand: {fontSize: 14, color: "#868889", marginBottom: 4},
    orderInfo: {fontSize: 12, color: "#4CAD73", fontWeight: "500"},
    ratingSection: {alignItems: "center", marginBottom: 24, padding: 20, backgroundColor: "#F9F9F9", borderRadius: 12},
    ratingTitle: {fontSize: 18, fontWeight: "600", color: "#000000", marginBottom: 20, textAlign: "center"},
    starContainer: {flexDirection: "row", marginBottom: 12},
    starButton: {padding: 8},
    star: {width: 32, height: 32},
    smallStar: {width: 16, height: 16, marginLeft: 4},
    ratingText: {fontSize: 16, color: "#868889", textAlign: "center"},
    commentSection: {marginBottom: 24},
    commentTitle: {fontSize: 16, fontWeight: "600", color: "#000000", marginBottom: 12},
    commentInput: {
        borderWidth: 1,
        borderColor: "#E5E5E5",
        borderRadius: 8,
        padding: 16,
        fontSize: 16,
        minHeight: 120,
        textAlignVertical: "top",
        color: "#000000",
        backgroundColor: "#F9F9F9"
    },
    existingReviewsSection: {marginBottom: 24},
    sectionTitle: {fontSize: 18, fontWeight: "600", color: "#000000", marginBottom: 16},
    reviewItem: {padding: 16, backgroundColor: "#F9F9F9", borderRadius: 8, marginBottom: 12},
    reviewHeader: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8},
    reviewerName: {fontSize: 16, fontWeight: "600", color: "#000000"},
    reviewRating: {flexDirection: "row", alignItems: "center"},
    reviewRatingText: {fontSize: 16, fontWeight: "600", color: "#000000", marginRight: 4},
    reviewComment: {fontSize: 14, color: "#000000", marginBottom: 8, lineHeight: 20},
    reviewDate: {fontSize: 12, color: "#868889"},
    reviewActions: {padding: 16, borderTopWidth: 1, borderTopColor: "#F5F5F5"},
    submitButton: {backgroundColor: "#4CAD73", paddingVertical: 16, borderRadius: 8, alignItems: "center"},
    submitButtonDisabled: {backgroundColor: "#CCCCCC"},
    submitButtonText: {color: "#FFFFFF", fontSize: 16, fontWeight: "600"}
});

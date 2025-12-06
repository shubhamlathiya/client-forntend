import React, {useState, useEffect} from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    StatusBar,
    Image,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    TextInput,
    Dimensions,
    Platform
} from "react-native";
import {useRouter, useLocalSearchParams} from "expo-router";
import {getProductRatingByUser} from "../../api/catalogApi";
import {API_BASE_URL} from "../../config/apiConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {createReview, getProductReviews, updateReview} from "../../api/reviewApi";

const {height: screenHeight, width: screenWidth} = Dimensions.get("window");

// Check if device has notch (iPhone X and above)
const hasNotch = Platform.OS === 'ios' && (screenHeight >= 812 || screenWidth >= 812);

// Safe area insets for different devices
const getSafeAreaInsets = () => {
    if (Platform.OS === 'ios') {
        if (hasNotch) {
            return {
                top: 44, // Status bar + notch area
                bottom: 34 // Home indicator area
            };
        }
        return {
            top: 20, // Regular status bar
            bottom: 0
        };
    }
    // Android
    return {
        top: StatusBar.currentHeight || 25,
        bottom: 0
    };
};

const safeAreaInsets = getSafeAreaInsets();

// Responsive size calculator with constraints
const RF = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    const normalizedSize = size * Math.min(scale, 1.5); // Max 1.5x scaling for tablets
    return Math.round(normalizedSize);
};

const RH = (size) => {
    const scale = screenHeight / 812; // 812 is standard iPhone height
    return Math.round(size * Math.min(scale, 1.5));
};

// Check if device is tablet
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;
const isSmallPhone = screenWidth <= 320;

// Responsive width percentage
const responsiveWidth = (percentage) => {
    return Math.round((screenWidth * percentage) / 100);
};

// Responsive height percentage (excluding safe areas)
const responsiveHeight = (percentage) => {
    const availableHeight = screenHeight - safeAreaInsets.top - safeAreaInsets.bottom;
    return Math.round((availableHeight * percentage) / 100);
};

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
    const [userReviewId, setUserReviewId] = useState(null);
    const [loadingUserReview, setLoadingUserReview] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [existingReview, setExistingReview] = useState(null);

    const {product: productParam, order: orderParam, mode = 'new', existingRating: existingRatingParam} = params;

    // Load user info
    const loadCurrentUser = async () => {
        try {
            const stored = await AsyncStorage.getItem("userData");
            if (stored) {
                const parsed = JSON.parse(stored);
                const uid = parsed?._id || parsed?.id;
                setCurrentUserId(uid);
                return uid;
            }
        } catch (err) {
            console.log("Error loading user:", err);
        }
        return null;
    };

    // Parse product and order params
    useEffect(() => {
        const parseData = async () => {
            try {
                // Load current user first
                await loadCurrentUser();

                // Parse product data
                if (productParam) {
                    try {
                        const parsedProduct = typeof productParam === 'string' ? JSON.parse(productParam) : productParam;
                        setProduct(parsedProduct);
                    } catch (err) {
                        console.error("Error parsing product:", err);
                    }
                }

                // Parse order data
                if (orderParam) {
                    try {
                        const parsedOrder = typeof orderParam === 'string' ? JSON.parse(orderParam) : orderParam;
                        setOrder(parsedOrder);
                    } catch (err) {
                        console.error("Error parsing order:", err);
                    }
                }
            } catch (error) {
                console.error("Error in parseData:", error);
            }
        };

        parseData();
    }, [productParam, orderParam]);

    // Check if user has already reviewed this product
    useEffect(() => {
        const checkUserReview = async () => {
            if (!currentUserId || !product) return;

            try {
                setLoadingUserReview(true);
                const productId = product.productId || product._id || product.id;

                // Use the API endpoint to check user rating
                const response = await getProductRatingByUser(currentUserId, productId);

                // Handle response based on your API structure
                if (response.success) {
                    if (response.hasRated && response.data) {
                        // User has already reviewed this product
                        setUserReviewId(response.data.reviewId || response.data._id);
                        setExistingReview(response.data);

                        // Pre-fill form with existing review data
                        setRating(response.data.rating || 0);
                        setComment(response.data.comment || "");

                        setIsEditing(true);
                    } else {
                        // User hasn't reviewed yet
                        setIsEditing(false);
                    }
                } else {
                    // Check if we have existing rating from params
                    if (existingRatingParam) {
                        try {
                            const parsedRating = typeof existingRatingParam === 'string' ? JSON.parse(existingRatingParam) : existingRatingParam;
                            setExistingReview(parsedRating);

                            if (parsedRating.rating) setRating(parsedRating.rating);
                            if (parsedRating.comment) setComment(parsedRating.comment);
                            if (parsedRating.reviewId) setUserReviewId(parsedRating.reviewId);

                            setIsEditing(true);
                        } catch (err) {
                            console.error("Error parsing existing rating:", err);
                            setIsEditing(false);
                        }
                    } else {
                        setIsEditing(false);
                    }
                }
            } catch (error) {
                console.error("Error checking user review:", error);
                setIsEditing(false);
            } finally {
                setLoadingUserReview(false);
            }
        };

        if (currentUserId && product) {
            checkUserReview();
        }
    }, [currentUserId, product, existingRatingParam]);

    // Load product reviews for display
    useEffect(() => {
        if (product) {
            loadProductReviews(product.productId || product._id || product.id);
        }
    }, [product]);

    const loadProductReviews = async (productId) => {
        try {
            setReviewsLoading(true);
            const response = await getProductReviews(productId);

            // Handle different response formats
            let reviews = [];
            if (response.data) {
                reviews = response.data.items ||
                    response.data.productReviews ||
                    response.data.reviews ||
                    [];
            } else if (response.productReviews) {
                reviews = response.productReviews;
            } else if (Array.isArray(response)) {
                reviews = response;
            }

            setProductReviews(Array.isArray(reviews) ? reviews : []);
        } catch (error) {
            console.error("Error loading reviews:", error);
            setProductReviews([]);
        } finally {
            setReviewsLoading(false);
        }
    };

    // Handle review submission
    const handleSubmitReview = async () => {
        if (!rating) {
            Alert.alert("Rating Required", "Please select a rating before submitting.");
            return;
        }

        if (!product) {
            Alert.alert("Error", "No product selected.");
            return;
        }

        if (!currentUserId) {
            Alert.alert("Login Required", "Please login to submit a review.");
            return;
        }

        const productId = product.productId || product._id || product.id;

        try {
            setSubmittingReview(true);

            const reviewData = {
                productId,
                rating,
                comment: comment.trim() || ""
            };

            let result;

            if (isEditing && userReviewId) {
                // Update existing review
                result = await updateReview(userReviewId, reviewData);
            } else {
                // Create new review
                result = await createReview(reviewData);
            }

            if (result.success) {
                const message = isEditing ? "Review updated successfully!" : "Review submitted successfully!";
                Alert.alert("Success", message, [
                    {
                        text: "OK",
                        onPress: () => {
                            // Navigate back to orders screen
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace("/screens/MyOrderScreen");
                            }
                        }
                    }
                ]);
            } else {
                // Handle duplicate review error
                if (result.message?.includes("already") || result.status === 409) {
                    Alert.alert(
                        "Already Reviewed",
                        "You have already reviewed this product. Would you like to edit your review instead?",
                        [
                            {
                                text: "Cancel",
                                style: "cancel"
                            },
                            {
                                text: "Edit Review",
                                onPress: () => {
                                    // Set editing mode
                                    setIsEditing(true);
                                    // Try to get the review ID from response
                                    if (result.reviewId || result.data?._id) {
                                        setUserReviewId(result.reviewId || result.data._id);
                                    }
                                    // Refresh user review data
                                    checkUserReview();
                                }
                            }
                        ]
                    );
                } else {
                    throw new Error(result.message || "Failed to submit review");
                }
            }
        } catch (error) {
            console.error("Review submission error:", error);
            Alert.alert(
                "Error",
                error.message || "Failed to submit review. Please try again."
            );
        } finally {
            setSubmittingReview(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Date not available";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"});
    };

    const getProductImage = () => {
        if (!product?.image) return require("../../assets/icons/order.png");
        if (product.image.startsWith("http") || product.image.startsWith("file://")) {
            return {uri: product.image};
        }
        return {uri: `${API_BASE_URL}${product.image.startsWith("/") ? product.image : "/" + product.image}`};
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.replace("/screens/MyOrderScreen");
        } else {
            router.replace("/screens/MyOrderScreen");
        }
    };

    const StarRating = ({rating, onRatingChange, size = RF(36), editable = true}) => (
        <View style={styles.starContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                    key={star}
                    onPress={() => editable && onRatingChange(star)}
                    style={styles.starButton}
                    disabled={!editable}
                >
                    <Image
                        source={star <= rating ?
                            require("../../assets/icons/star_filled.png") :
                            require("../../assets/icons/star_empty.png")}
                        style={{width: size, height: size}}
                    />
                </Pressable>
            ))}
        </View>
    );

    if (loadingUserReview) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
                    <Pressable
                        onPress={handleBack}
                        style={styles.backButton}
                        activeOpacity={0.7}
                        hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                    >
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </Pressable>
                    <Text style={styles.headerTitle}>
                        {isEditing ? "Edit Review" : "Write a Review"}
                    </Text>
                    <View style={styles.headerPlaceholder}/>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={isTablet ? "large" : "large"} color="#4CAD73"/>
                    <Text style={styles.loadingText}>Loading Review Information...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!product) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
                    <Pressable
                        onPress={handleBack}
                        style={styles.backButton}
                        activeOpacity={0.7}
                        hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                    >
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </Pressable>
                    <Text style={styles.headerTitle}>
                        {isEditing ? "Edit Review" : "Write a Review"}
                    </Text>
                    <View style={styles.headerPlaceholder}/>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Product information not available</Text>
                    <Pressable style={styles.goBackButton} onPress={handleBack}>
                        <Text style={styles.goBackButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const productId = product.productId || product._id || product.id;
    const productName = product.name || product.title || "Product";
    const productBrand = product.brand || "";
    const orderNumber = order?.orderNumber || order?._id?.substring(0, 8) || "N/A";

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#FFFFFF"
                translucent={false}
            />

            {/* Header - Updated to match OrderScreen */}
            <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
                <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
                    <Pressable
                        onPress={handleBack}
                        style={styles.backButton}
                        activeOpacity={0.7}
                        hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                    >
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </Pressable>
                    <Text style={styles.headerTitle}>
                        {isEditing ? "Edit Review" : "Write a Review"}
                    </Text>
                    <View style={styles.headerPlaceholder} />
                </View>
            </SafeAreaView>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingBottom: safeAreaInsets.bottom + RF(20),
                    paddingTop: RF(16),
                    paddingHorizontal: RF(16)
                }}
            >
                {/* Product Info */}
                <View style={styles.productReviewSection}>
                    <Image
                        source={getProductImage()}
                        style={styles.reviewProductImage}
                        defaultSource={require("../../assets/icons/order.png")}
                    />
                    <View style={styles.reviewProductInfo}>
                        <Text style={styles.reviewProductName} numberOfLines={2}>
                            {productName}
                        </Text>
                        {productBrand ? (
                            <Text style={styles.reviewProductBrand}>{productBrand}</Text>
                        ) : null}
                        {order && (
                            <Text style={styles.orderInfo}>
                                Order #{orderNumber}
                            </Text>
                        )}
                        {isEditing && (
                            <View style={styles.editBadge}>
                                <Text style={styles.editBadgeText}>
                                    You have already reviewed this product
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Rating Section */}
                <View style={styles.ratingSection}>
                    <Text style={styles.ratingTitle}>
                        {isEditing ? "Update your rating" : "How would you rate this product?"}
                    </Text>
                    <StarRating
                        rating={rating}
                        onRatingChange={setRating}
                        size={RF(36)}
                        editable={!submittingReview}
                    />
                    <Text style={styles.ratingText}>
                        {rating > 0 ? `${rating} Star${rating > 1 ? "s" : ""}` : "Tap to rate"}
                    </Text>
                </View>

                {/* Comment Section */}
                <View style={styles.commentSection}>
                    <Text style={styles.commentTitle}>
                        {isEditing ? "Update your comment (optional)" : "Share your experience (optional)"}
                    </Text>
                    <TextInput
                        style={styles.commentInput}
                        placeholder={isEditing ?
                            "Update what you liked or disliked about this product..." :
                            "What did you like or dislike about this product?"}
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        placeholderTextColor="#999"
                        editable={!submittingReview}
                    />
                </View>

                {/* Submit Button */}
                <View style={styles.reviewActions}>
                    <Pressable
                        style={[
                            styles.submitButton,
                            (!rating || submittingReview) && styles.submitButtonDisabled
                        ]}
                        onPress={handleSubmitReview}
                        disabled={!rating || submittingReview}
                    >
                        {submittingReview ? (
                            <ActivityIndicator size="small" color="#FFFFFF"/>
                        ) : (
                            <Text style={styles.submitButtonText}>
                                {isEditing ? "Update Review" : "Submit Review"}
                            </Text>
                        )}
                    </Pressable>

                    <Pressable
                        style={styles.cancelButton}
                        onPress={handleBack}
                        disabled={submittingReview}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF"
    },
    safeAreaTop: {
        backgroundColor: '#FFFFFF',
    },

    // Header Styles - Updated to match OrderScreen
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: RF(16),
        paddingVertical: RF(12),
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
    },
    backButton: {
        padding: RF(4),
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        width: RF(24),
        height: RF(24),
    },
    headerTitle: {
        fontSize: RF(18),
        fontWeight: "600",
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        textAlign: "center",
        flex: 1,
        marginHorizontal: RF(8),
    },
    headerPlaceholder: {
        width: RF(32),
    },

    // Loading Styles
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: RH(20),
    },
    loadingText: {
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
        color: "#868889",
        marginTop: RF(12),
    },

    // Error Styles
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: RF(20),
    },
    errorText: {
        fontSize: RF(16),
        fontFamily: "Poppins-Regular",
        color: "#666",
        marginBottom: RF(20),
        textAlign: "center"
    },
    goBackButton: {
        backgroundColor: "#4CAD73",
        paddingHorizontal: RF(20),
        paddingVertical: RF(12),
        borderRadius: RF(8)
    },
    goBackButtonText: {
        color: "#FFFFFF",
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        fontWeight: "600"
    },

    // ScrollView Styles
    scrollView: {
        flex: 1,
    },

    // Product Info Section
    productReviewSection: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: RF(24),
        padding: RF(16),
        backgroundColor: "#F9F9F9",
        borderRadius: RF(12)
    },
    reviewProductImage: {
        width: RF(80),
        height: RF(80),
        borderRadius: RF(8),
        marginRight: RF(16)
    },
    reviewProductInfo: {
        flex: 1
    },
    reviewProductName: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        fontWeight: "600",
        color: "#000000",
        marginBottom: RF(4)
    },
    reviewProductBrand: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#868889",
        marginBottom: RF(4)
    },
    orderInfo: {
        fontSize: RF(12),
        fontFamily: "Poppins-Medium",
        color: "#4CAD73",
        fontWeight: "500"
    },
    editBadge: {
        backgroundColor: "#FFF5E6",
        paddingHorizontal: RF(8),
        paddingVertical: RF(4),
        borderRadius: RF(4),
        alignSelf: "flex-start",
        marginTop: RF(4)
    },
    editBadgeText: {
        fontSize: RF(12),
        fontFamily: "Poppins-Medium",
        color: "#FFA500",
        fontWeight: "500"
    },

    // Rating Section
    ratingSection: {
        alignItems: "center",
        marginBottom: RF(24),
        padding: RF(20),
        backgroundColor: "#F9F9F9",
        borderRadius: RF(12)
    },
    ratingTitle: {
        fontSize: RF(18),
        fontFamily: "Poppins-SemiBold",
        fontWeight: "600",
        color: "#000000",
        marginBottom: RF(20),
        textAlign: "center"
    },
    starContainer: {
        flexDirection: "row",
        marginBottom: RF(12),
        gap: RF(8)
    },
    starButton: {
        padding: RF(4)
    },
    ratingText: {
        fontSize: RF(16),
        fontFamily: "Poppins-Regular",
        color: "#868889",
        textAlign: "center",
        marginTop: RF(8)
    },

    // Comment Section
    commentSection: {
        marginBottom: RF(24)
    },
    commentTitle: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        fontWeight: "600",
        color: "#000000",
        marginBottom: RF(12)
    },
    commentInput: {
        borderWidth: 1,
        borderColor: "#E5E5E5",
        borderRadius: RF(8),
        padding: RF(16),
        fontSize: RF(14),
        minHeight: RH(120),
        textAlignVertical: "top",
        color: "#000000",
        backgroundColor: "#F9F9F9",
        fontFamily: "Poppins-Regular"
    },

    // Action Buttons
    reviewActions: {
        gap: RF(12)
    },
    submitButton: {
        backgroundColor: "#4CAD73",
        paddingVertical: RF(16),
        borderRadius: RF(8),
        alignItems: "center"
    },
    submitButtonDisabled: {
        backgroundColor: "#CCCCCC"
    },
    submitButtonText: {
        color: "#FFFFFF",
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        fontWeight: "600"
    },
    cancelButton: {
        paddingVertical: RF(16),
        borderRadius: RF(8),
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E5E5E5",
        backgroundColor: "#FFFFFF"
    },
    cancelButtonText: {
        color: "#666666",
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        fontWeight: "600"
    }
});
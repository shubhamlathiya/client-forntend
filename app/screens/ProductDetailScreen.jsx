import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    SafeAreaView,
    Dimensions
} from "react-native";
import { addCartItem } from '../../api/cartApi';
import { getProductById, getProductFaqs, toggleWishlist, checkWishlist } from '../../api/catalogApi';
import { API_BASE_URL } from '../../config/apiConfig';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getOrCreateSessionId } from "../../api/sessionManager";

const { width: screenWidth } = Dimensions.get('window');

export default function ProductDetailScreen() {
    const router = useRouter();
    const { id, product: productParam } = useLocalSearchParams();

    // State management
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [related, setRelated] = useState([]);
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [loadingRelated, setLoadingRelated] = useState(false);
    const [faqs, setFaqs] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [userId, setUserId] = useState(null);

    // Navigation handlers
    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    // User type check
    const checkUserType = async () => {
        try {
            const loginType = await AsyncStorage.getItem('loginType');
            setIsBusinessUser(loginType === 'business');
        } catch (error) {
            console.error('Error checking user type:', error);
        }
    };

    // Load product data
    useEffect(() => {
        checkUserType();
        let mounted = true;

        const loadProductData = async () => {
            setLoading(true);
            try {
                let productData = null;

                // Parse product from params if available
                if (productParam) {
                    try {
                        productData = typeof productParam === 'string'
                            ? JSON.parse(productParam)
                            : productParam;
                    } catch (err) {
                        console.warn('Failed to parse product from params', err);
                    }
                }

                // Fetch from API if no product data
                if (!productData && id) {
                    const response = await getProductById(String(id));
                    productData = response?.data || response?.product || response || null;
                }

                if (productData && mounted) {
                    setProduct(productData);

                    // Set variants
                    const variantData = productData.variants || [];
                    setVariants(variantData);

                    // Set reviews
                    const reviewData = productData.reviews || [];
                    setReviews(reviewData);

                    // Set initial selected variant
                    if (variantData.length > 0) {
                        const firstAvailable = variantData.find(v => (v?.stock ?? 1) > 0) || variantData[0];
                        setSelectedVariantId(firstAvailable?._id || firstAvailable?.id);
                    }

                    // Fetch FAQs
                    try {
                        const faqResponse = await getProductFaqs(String(id));
                        const faqData = faqResponse?.data || [];
                        setFaqs(Array.isArray(faqData) ? faqData : []);
                    } catch (faqError) {
                        console.warn('Failed to fetch FAQs:', faqError);
                        setFaqs([]);
                    }
                }
            } catch (error) {
                console.warn('Product load error:', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadProductData();

        return () => {
            mounted = false;
        };
    }, [id, productParam]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('userData');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const uid = parsed?._id || parsed?.id || parsed?.userId || null;
                    if (mounted) setUserId(uid);
                    const pid = String(product?._id || product?.id || id || '');
                    if (uid && pid) {
                        try {
                            const res = await checkWishlist(uid, pid);
                            const liked = Boolean(res?.liked ?? res?.data?.liked ?? res?.inWishlist ?? res?.data?.inWishlist);
                            if (mounted) setIsLiked(liked);
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        })();
        return () => { mounted = false; };
    }, [id, product]);

    // Image scroll handler
    const handleImageScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / screenWidth);
        setActiveImageIndex(index);
    };

    // Quantity handlers
    const increaseQuantity = () => {
        setQuantity(prev => prev + 1);
    };

    const decreaseQuantity = () => {
        setQuantity(prev => prev > 1 ? prev - 1 : 1);
    };

    // Add to cart handler
    const handleAddToCart = async () => {
        try {
            const productId = product?._id || product?.id || id;
            const variantId = variants.length > 0 ? selectedVariantId : null;

            const cartData = {
                productId: String(productId),
                variantId: variantId ? String(variantId) : null,
                quantity: Number(quantity),
            };

            console.log("Adding to cart:", cartData);

            await addCartItem(cartData);
            router.push("/Cart");
        } catch (error) {
            console.warn('Add to Cart Error:', error);
            // You might want to show an error message to the user here
        }
    };

    const handleWishlist = async () => {
        try {
            const pid = String(product?._id || product?.id || id || '');
            if (!userId || !pid) return;
            const res = await toggleWishlist(userId, pid);
            const liked = Boolean(res?.data?.liked ?? res?.liked);
            setIsLiked(liked);
        } catch (_) {}
    };

    // Utility functions
    const getSelectedVariant = () => {
        return variants.find(v => (v?._id || v?.id) === selectedVariantId);
    };

    const getDisplayPrice = () => {
        const selectedVariant = getSelectedVariant();
        if (variants.length > 0 && selectedVariant) {
            return selectedVariant.finalPrice || selectedVariant.basePrice || 0;
        }
        return product?.finalPrice || product?.basePrice || product?.price || 0;
    };

    const getDiscountPercentage = () => {
        let basePrice, finalPrice;
        const selectedVariant = getSelectedVariant();

        if (variants.length > 0 && selectedVariant) {
            basePrice = selectedVariant.basePrice;
            finalPrice = selectedVariant.finalPrice;
        } else {
            basePrice = product?.basePrice;
            finalPrice = product?.finalPrice;
        }

        if (basePrice && finalPrice && basePrice > finalPrice) {
            return Math.round(((basePrice - finalPrice) / basePrice) * 100);
        }
        return 0;
    };

    const isOutOfStock = () => {
        const selectedVariant = getSelectedVariant();
        if (variants.length > 0 && selectedVariant) {
            return selectedVariant.stock === 0;
        }
        return product?.stock === 0;
    };

    const hasVariants = variants.length > 0;
    const selectedVariant = getSelectedVariant();
    const displayPrice = getDisplayPrice();
    const discountPercentage = getDiscountPercentage();
    const outOfStock = isOutOfStock();
    const productImages = product?.images || [];
    const productCategories = product?.categoryIds || [];

    // Loading state
    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#4CAD73" />
                <Text style={styles.loaderText}>Loading product details...</Text>
            </View>
        );
    }

    // If no product data
    if (!product) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Product not found</Text>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with Back Button - Separate from image section */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Main Content */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Product Images Section - Clean without header overlap */}
                <View style={styles.imageSection}>
                    <TouchableOpacity
                        style={styles.wishlistButton}
                        onPress={handleWishlist}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={
                                isLiked
                                    ? require("../../assets/icons/heart_filled.png")   // when liked
                                    : require("../../assets/icons/heart_empty.png")    // when not liked
                            }
                            style={styles.wishlistIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleImageScroll}
                        scrollEventThrottle={16}
                    >
                        {productImages.map((img, index) => {
                            const imageUrl = typeof img === 'string' ? img : (img?.url || img?.path);
                            console.log(`${API_BASE_URL}${imageUrl}`)
                            const source = imageUrl
                                ? { uri: `${API_BASE_URL}${imageUrl}` }
                                : require("../../assets/sample-product.png");

                            return (
                                <View key={`image-${index}`} style={styles.imageWrapper}>
                                    <Image
                                        source={source}
                                        style={styles.productImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Image Indicators */}
                    {productImages.length > 1 && (
                        <View style={styles.indicatorContainer}>
                            {productImages.map((_, index) => (
                                <View
                                    key={`indicator-${index}`}
                                    style={[
                                        styles.dot,
                                        index === activeImageIndex ? styles.dotActive : styles.dotInactive
                                    ]}
                                />
                            ))}
                        </View>
                    )}

                    {/* Discount Badge */}
                    {discountPercentage > 0 && (
                        <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>{discountPercentage}% OFF</Text>
                        </View>
                    )}
                </View>

                {/* Product Details Section */}
                <View style={styles.detailsSection}>
                    {/* Product Basic Info */}
                    <View style={styles.productBasicInfo}>
                        <Text style={styles.productName}>
                            {product?.title || product?.name || 'Product Name'}
                        </Text>

                        {/* Brand Info */}
                        {product?.brandId?.name && (
                            <View style={styles.brandRow}>
                                {product.brandId.logo && (
                                    <Image
                                        source={{ uri: `${API_BASE_URL}${product.brandId.logo}` }}
                                        style={styles.brandLogo}
                                    />
                                )}
                                <Text style={styles.brandName}>{product.brandId.name}</Text>
                            </View>
                        )}

                        {/* Rating */}
                        <View style={styles.ratingRow}>
                            <View style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Text
                                        key={`star-${star}`}
                                        style={[
                                            styles.star,
                                            star <= Math.floor(product?.ratingAverage || 0)
                                                ? styles.starFilled
                                                : styles.starEmpty
                                        ]}
                                    >
                                        ★
                                    </Text>
                                ))}
                            </View>
                            <Text style={styles.ratingValue}>
                                {product?.ratingAverage?.toFixed(1) || '0.0'}
                            </Text>
                            <Text style={styles.reviewsText}>
                                ({product?.ratingCount || reviews.length || 0} reviews)
                            </Text>
                        </View>

                        {/* Pricing */}
                        <View style={styles.pricingSection}>
                            <View style={styles.priceRow}>
                                {((hasVariants && selectedVariant?.basePrice) || product?.basePrice) &&
                                    ((hasVariants && selectedVariant?.basePrice > displayPrice) ||
                                        (product?.basePrice > displayPrice)) && (
                                        <Text style={styles.oldPrice}>
                                            ₹{Number(hasVariants ? selectedVariant.basePrice : product.basePrice).toFixed(2)}
                                        </Text>
                                    )}
                                <Text style={styles.currentPrice}>₹{Number(displayPrice).toFixed(2)}</Text>
                                {discountPercentage > 0 && (
                                    <Text style={styles.discountText}>{discountPercentage}% off</Text>
                                )}
                            </View>

                            {/* Stock Status */}
                            <Text style={[
                                styles.stockStatus,
                                outOfStock ? styles.outOfStock : styles.inStock
                            ]}>
                                {outOfStock ? 'Out of stock' : `${hasVariants ? selectedVariant?.stock : product?.stock} in stock`}
                            </Text>
                        </View>
                    </View>

                    {/* Description */}
                    <View style={styles.descriptionSection}>
                        <Text style={styles.sectionTitle}>Description</Text>
                        <Text style={styles.descriptionText}>
                            {product?.description || 'No description available.'}
                        </Text>
                    </View>

                    {/* Categories */}
                    {productCategories.length > 0 && (
                        <View style={styles.categoriesSection}>
                            <Text style={styles.sectionTitle}>Categories</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.categoriesContainer}>
                                    {productCategories.map((category, index) => (
                                        <View key={`category-${index}`} style={styles.categoryChip}>
                                            <Text style={styles.categoryText}>
                                                {category?.name || category}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {/* Variants */}
                    {hasVariants && (
                        <View style={styles.variantsSection}>
                            <Text style={styles.sectionTitle}>Select Variant</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.variantsContainer}>
                                    {variants.map((variant, index) => {
                                        const variantId = variant?._id || variant?.id;
                                        const isSelected = variantId === selectedVariantId;
                                        const isOutOfStock = variant.stock === 0;
                                        const variantName = Array.isArray(variant?.attributes) && variant.attributes.length
                                            ? variant.attributes.map(attr => attr?.value || attr?.name || '').join(' / ')
                                            : (variant?.name || variant?.sku || `Variant ${index + 1}`);

                                        return (
                                            <TouchableOpacity
                                                key={`variant-${variantId || index}`}
                                                style={[
                                                    styles.variantChip,
                                                    isSelected && styles.variantChipSelected,
                                                    isOutOfStock && styles.variantChipDisabled
                                                ]}
                                                onPress={() => !isOutOfStock && setSelectedVariantId(variantId)}
                                                disabled={isOutOfStock}
                                            >
                                                <Text style={[
                                                    styles.variantText,
                                                    isSelected && styles.variantTextSelected,
                                                    isOutOfStock && styles.variantTextDisabled
                                                ]}>
                                                    {variantName}
                                                    {isOutOfStock && ' (Out of stock)'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {/* Features */}
                    <View style={styles.featuresSection}>
                        <Text style={styles.sectionTitle}>Product Features</Text>
                        <View style={styles.featuresGrid}>
                            <View style={styles.featureRow}>
                                <View style={styles.featureItem}>
                                    <Text style={styles.featureIcon}>🌱</Text>
                                    <Text style={styles.featureValue}>100%</Text>
                                    <Text style={styles.featureLabel}>Organic</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Text style={styles.featureIcon}>📅</Text>
                                    <Text style={styles.featureValue}>1 Year</Text>
                                    <Text style={styles.featureLabel}>Expiration</Text>
                                </View>
                            </View>
                            <View style={styles.featureRow}>
                                <View style={styles.featureItem}>
                                    <Text style={styles.featureIcon}>❤️</Text>
                                    <Text style={styles.featureValue}>
                                        {product?.ratingAverage?.toFixed(1) || '0.0'}
                                    </Text>
                                    <Text style={styles.featureLabel}>Rating</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <Text style={styles.featureIcon}>🔥</Text>
                                    <Text style={styles.featureValue}>80 kcal</Text>
                                    <Text style={styles.featureLabel}>100g</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Reviews */}
                    {reviews.length > 0 && (
                        <View style={styles.reviewsSection}>
                            <Text style={styles.sectionTitle}>Customer Reviews</Text>
                            {reviews.slice(0, 3).map((review, index) => (
                                <View key={`review-${review._id || index}`} style={styles.reviewItem}>
                                    <View style={styles.reviewHeader}>
                                        <Text style={styles.reviewerName}>
                                            {review.userId?.name || 'Anonymous Customer'}
                                        </Text>
                                        <View style={styles.reviewRating}>
                                            <Text style={styles.starFilled}>★</Text>
                                            <Text style={styles.ratingNumber}>{review.rating}</Text>
                                        </View>
                                    </View>
                                    {review.comment && (
                                        <Text style={styles.reviewComment}>{review.comment}</Text>
                                    )}
                                    <Text style={styles.reviewDate}>
                                        {new Date(review.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* FAQs */}
                    {faqs.length > 0 && (
                        <View style={styles.faqSection}>
                            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                            {faqs.map((faq, index) => (
                                <View key={`faq-${faq._id || index}`} style={styles.faqItem}>
                                    <Text style={styles.faqQuestion}>Q: {faq.question}</Text>
                                    <Text style={styles.faqAnswer}>A: {faq.answer}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Related Products Loading */}
                    {loadingRelated && (
                        <View style={styles.loadingSection}>
                            <ActivityIndicator size="small" color="#4CAD73" />
                            <Text style={styles.loadingText}>Loading related products...</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Fixed Bottom Action Bar */}
            <SafeAreaView style={styles.bottomSafeArea}>
                <View style={styles.bottomActionBar}>
                    <View style={styles.quantitySelector}>
                        <Text style={styles.quantityLabel}>Quantity</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={[styles.quantityButton, outOfStock && styles.buttonDisabled]}
                                onPress={decreaseQuantity}
                                disabled={outOfStock}
                            >
                                <Text style={styles.quantityButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={[styles.quantityValue, outOfStock && styles.textDisabled]}>
                                {quantity}
                            </Text>
                            <TouchableOpacity
                                style={[styles.quantityButton, outOfStock && styles.buttonDisabled]}
                                onPress={increaseQuantity}
                                disabled={outOfStock}
                            >
                                <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.addToCartButton, outOfStock && styles.buttonDisabled]}
                        onPress={handleAddToCart}
                        disabled={outOfStock}
                    >
                        <Text style={styles.addToCartButtonText}>
                            {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F6FA",
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
    },
    loaderText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontFamily: 'Poppins',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#666',
        fontFamily: 'Poppins',
        marginBottom: 20,
    },
    // Header Styles - Separate from image
    headerSafeArea: {
        backgroundColor: 'transparent',
        position: 'absolute',
        top: 30,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    scrollView: {
        flex: 1,
    },
    // Image Section - Clean without header overlap
    imageSection: {
        height: 320,
        backgroundColor: "#F2F2F2",
        position: 'relative',
    },
    imageWrapper: {
        width: screenWidth,
        height: 320,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    indicatorContainer: {
        position: "absolute",
        bottom: 20,
        alignSelf: "center",
        flexDirection: "row",
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotActive: {
        backgroundColor: "#4CAD73",
    },
    dotInactive: {
        backgroundColor: "#C4C4C4",
    },
    discountBadge: {
        position: 'absolute',
        top: 40,
        right: 20,
        backgroundColor: '#FF4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    discountBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'Poppins',
    },
    wishlistButton: {
        position: 'absolute',
        top: 70,
        right: 20,
        zIndex: 20,
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    wishlistIcon: {
        width: 30,
        height: 30,
    },
    wishlistIconLiked: {
        tintColor: '#DC1010',
    },
    wishlistIconUnliked: {
        tintColor: '#1B1B1B',
    },
    detailsSection: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        marginTop: -40,
        paddingTop: 40,
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    productBasicInfo: {
        gap: 12,
        marginBottom: 24,
    },
    productName: {
        fontSize: 24,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#000000",
        lineHeight: 32,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandLogo: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    brandName: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'Poppins',
    },
    ratingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    starsContainer: {
        flexDirection: "row",
    },
    star: {
        fontSize: 16,
        marginRight: 2,
    },
    starFilled: {
        color: "#FFC107",
    },
    starEmpty: {
        color: "#E0E0E0",
    },
    ratingValue: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#333",
    },
    reviewsText: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#868889",
    },
    pricingSection: {
        gap: 8,
    },
    priceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexWrap: 'wrap',
    },
    oldPrice: {
        fontSize: 16,
        fontFamily: "Poppins",
        color: "#838383",
        textDecorationLine: "line-through",
    },
    currentPrice: {
        fontSize: 24,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#4CAD73",
    },
    discountText: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#FF4444",
        backgroundColor: '#FFE6E6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    stockStatus: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "500",
    },
    inStock: {
        color: "#4CAD73",
    },
    outOfStock: {
        color: "#FF4444",
    },
    descriptionSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#333",
        marginBottom: 12,
    },
    descriptionText: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#666",
        lineHeight: 22,
    },
    categoriesSection: {
        marginBottom: 24,
    },
    categoriesContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    categoryChip: {
        backgroundColor: '#F2F2F2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    categoryText: {
        fontSize: 12,
        fontFamily: "Poppins",
        color: "#555",
    },
    variantsSection: {
        marginBottom: 24,
    },
    variantsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    variantChip: {
        borderWidth: 1,
        borderColor: '#E6E6E6',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    variantChipSelected: {
        borderColor: '#4CAD73',
        backgroundColor: 'rgba(76, 173, 115, 0.1)',
    },
    variantChipDisabled: {
        borderColor: '#FFCCCB',
        backgroundColor: '#FFF5F5',
        opacity: 0.6,
    },
    variantText: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#333",
    },
    variantTextSelected: {
        color: '#2E7D5B',
        fontWeight: '600',
    },
    variantTextDisabled: {
        color: '#666',
    },
    featuresSection: {
        marginBottom: 24,
    },
    featuresGrid: {
        gap: 16,
    },
    featureRow: {
        flexDirection: 'row',
        gap: 16,
    },
    featureItem: {
        flex: 1,
        backgroundColor: '#F9F9F9',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        gap: 8,
    },
    featureIcon: {
        fontSize: 24,
    },
    featureValue: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#23AA49",
    },
    featureLabel: {
        fontSize: 12,
        fontFamily: "Poppins",
        color: "#979899",
    },
    reviewsSection: {
        marginBottom: 24,
    },
    reviewItem: {
        backgroundColor: '#F9F9F9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewerName: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#333",
    },
    reviewRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingNumber: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#333",
    },
    reviewComment: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#666",
        lineHeight: 20,
        marginBottom: 8,
    },
    reviewDate: {
        fontSize: 12,
        fontFamily: "Poppins",
        color: "#999",
    },
    faqSection: {
        marginBottom: 24,
    },
    faqItem: {
        backgroundColor: '#F9F9F9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#4CAD73',
    },
    faqQuestion: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
    },
    faqAnswer: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#666",
        lineHeight: 20,
    },
    loadingSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 20,
    },
    loadingText: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#666",
    },
    // Bottom Action Bar with Safe Area
    bottomSafeArea: {
        backgroundColor: '#FFFFFF',
    },
    bottomActionBar: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        borderTopWidth: 1,
        borderTopColor: '#E6E6E6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    quantitySelector: {
        alignItems: 'center',
    },
    quantityLabel: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#838383",
        marginBottom: 8,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    quantityButton: {
        width: 36,
        height: 36,
        backgroundColor: '#4CAD73',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    quantityValue: {
        fontSize: 18,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#000000",
        minWidth: 30,
        textAlign: 'center',
    },
    addToCartButton: {
        flex: 1,
        height: 50,
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addToCartButtonText: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#FFFFFF",
    },
    buttonDisabled: {
        backgroundColor: '#AFAFAF',
    },
    textDisabled: {
        color: '#AFAFAF',
    },
});

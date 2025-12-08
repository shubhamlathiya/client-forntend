import {useFocusEffect, useLocalSearchParams, useRouter} from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    Pressable,
    View,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    Alert,
    RefreshControl,
    Animated, Platform
} from "react-native";
import { addCartItem, getCart, removeCartItem, updateCartItem } from '../../api/cartApi';
import { getProductById, getProductFaqs, toggleWishlist, checkWishlist } from '../../api/catalogApi';
import { API_BASE_URL } from '../../config/apiConfig';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Added

const { width: screenWidth } = Dimensions.get('window');

export default function ProductDetailScreen() {
    const router = useRouter();
    const { id, product: productParam } = useLocalSearchParams();
    const insets = useSafeAreaInsets(); // Added for safe area handling

    // State management
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [product, setProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [faqs, setFaqs] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [userId, setUserId] = useState(null);
    const [availableStock, setAvailableStock] = useState(0);
    const [currentCartQuantity, setCurrentCartQuantity] = useState(0);
    const [isCheckingWishlist, setIsCheckingWishlist] = useState(false);
    const [updatingCart, setUpdatingCart] = useState(false);
    const [selectedVariantDetails, setSelectedVariantDetails] = useState(null);
    const [showAddToCartSuccess, setShowAddToCartSuccess] = useState(false);
    const [selectedAttributes, setSelectedAttributes] = useState({});
    const [groupedVariants, setGroupedVariants] = useState({});
    const [cartItemId, setCartItemId] = useState(null); // Added to track cart item ID

    // Animation refs
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Refs to prevent memory leaks
    const mountedRef = useRef(true);

    // Navigation handlers
    const handleBack = () => {
        if (router.canGoBack()) {
            router.replace('/Home');
        } else {
            router.replace('/Home');
        }
    };

    // Check user type
    const checkUserType = async () => {
        try {
            const loginType = await AsyncStorage.getItem('loginType');
            setIsBusinessUser(loginType === 'business');
        } catch (error) {
            console.error('Error checking user type:', error);
        }
    };

    // Load user ID from storage
    const loadUserId = async () => {
        try {
            const raw = await AsyncStorage.getItem('userData');
            if (raw) {
                const parsed = JSON.parse(raw);
                const uid = parsed?._id || parsed?.id || parsed?.userId || null;
                if (mountedRef.current) {
                    setUserId(uid);
                }
                return uid;
            }
        } catch (error) {
            console.error('Error loading user ID:', error);
        }
        return null;
    };

    // Check wishlist status
    const checkWishlistStatus = useCallback(async (uid, pid) => {
        if (!uid || !pid) return false;

        try {
            setIsCheckingWishlist(true);
            const res = await checkWishlist(uid, pid);
            const liked = Boolean(res.data.isLiked ?? res?.data?.liked ?? res?.inWishlist ?? res?.data?.inWishlist);

            if (mountedRef.current) {
                setIsLiked(liked);
            }
            return liked;
        } catch (error) {
            console.warn('Error checking wishlist:', error);
            return false;
        } finally {
            if (mountedRef.current) {
                setIsCheckingWishlist(false);
            }
        }
    }, []);

    // Check cart quantity for current product/variant
    const checkCartQuantity = useCallback(async () => {
        try {
            const cartResponse = await getCart();
            const cartItems = cartResponse?.data?.items || cartResponse?.data || cartResponse || [];

            const productId = product?._id || product?.id || id;
            const variantId = variants.length > 0 ? selectedVariantId : null;

            const matchingItem = cartItems.find(item => {
                const itemProductId = item.productId?._id || item.productId || item.product;
                const itemVariantId = item.variantId?._id || item.variantId || item.variant;

                if (variantId) {
                    return String(itemProductId) === String(productId) &&
                        String(itemVariantId) === String(variantId);
                } else {
                    return String(itemProductId) === String(productId);
                }
            });

            const cartQty = matchingItem ? Number(matchingItem.quantity) : 0;
            const cartItemId = matchingItem?._id || matchingItem?.id || null;

            if (mountedRef.current) {
                setCurrentCartQuantity(cartQty);
                setCartItemId(cartItemId);
                // Update local quantity to match cart quantity if item exists in cart
                if (cartQty > 0) {
                    setQuantity(cartQty);
                }
            }

            return { quantity: cartQty, cartItemId };
        } catch (error) {
            console.warn('Error checking cart quantity:', error);
            return { quantity: 0, cartItemId: null };
        }
    }, [product, id, variants, selectedVariantId]);

    // Calculate available stock (stock - cart quantity)
    const calculateAvailableStock = useCallback(() => {
        const selectedVariant = getSelectedVariant();
        let stock = 0;

        if (variants.length > 0 && selectedVariant) {
            stock = selectedVariant.stock || selectedVariant.quantity || 0;
        } else {
            stock = product?.stock || product?.quantity || 0;
        }

        const available = Math.max(0, stock);

        if (mountedRef.current) {
            setAvailableStock(available);
        }

        return available;
    }, [variants, product, selectedVariantId, currentCartQuantity]);

    // Group variants by attribute types
    const groupVariantsByAttributes = useCallback((variantList) => {
        const groups = {};

        variantList.forEach(variant => {
            const attributes = variant.attributes || [];
            attributes.forEach(attr => {
                const type = attr?.type || attr?.name || 'attribute';
                const value = attr?.value || attr?.valueName || attr?.name || '';

                if (!groups[type]) {
                    groups[type] = {
                        name: type.charAt(0).toUpperCase() + type.slice(1),
                        values: []
                    };
                }

                // Add value if not already in list
                if (!groups[type].values.includes(value)) {
                    groups[type].values.push(value);
                }
            });
        });

        // Sort values for better display
        Object.keys(groups).forEach(type => {
            groups[type].values.sort();
        });

        return groups;
    }, []);

    // Find variant based on selected attributes
    const findVariantByAttributes = useCallback((selectedAttrs) => {
        return variants.find(variant => {
            const variantAttrs = variant.attributes || [];

            // Check if all selected attributes match the variant
            return Object.keys(selectedAttrs).every(attrType => {
                const selectedValue = selectedAttrs[attrType];
                const variantAttr = variantAttrs.find(attr =>
                    (attr?.type || attr?.name) === attrType
                );
                return variantAttr && (variantAttr.value || variantAttr.name) === selectedValue;
            });
        });
    }, [variants]);

    // Load product data
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

            if (productData && mountedRef.current) {
                setProduct(productData);

                // Set variants
                const variantData = productData.variants || [];
                setVariants(variantData);

                // Group variants by attributes
                const grouped = groupVariantsByAttributes(variantData);
                setGroupedVariants(grouped);

                // Initialize selected attributes
                if (variantData.length > 0) {
                    const firstAvailable = variantData.find(v => (v?.stock ?? v?.quantity ?? 1) > 0) || variantData[0];
                    const firstVariantId = firstAvailable?._id || firstAvailable?.id;

                    // Set initial attributes from first variant
                    const initialAttrs = {};
                    const firstAttrs = firstAvailable.attributes || [];
                    firstAttrs.forEach(attr => {
                        const type = attr?.type || attr?.name;
                        const value = attr?.value || attr?.name;
                        if (type && value) {
                            initialAttrs[type] = value;
                        }
                    });

                    setSelectedAttributes(initialAttrs);
                    setSelectedVariantId(firstVariantId);
                    setSelectedVariantDetails(firstAvailable);
                }

                // Set reviews
                const reviewData = productData.reviews || [];
                setReviews(reviewData);

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
            Alert.alert('Error', 'Failed to load product details');
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    // Initial load
    useEffect(() => {
        mountedRef.current = true;
        checkUserType();
        loadProductData();

        return () => {
            mountedRef.current = false;
        };
    }, [id, productParam]);

    // Check wishlist status and cart quantity when product or user changes
    useEffect(() => {
        let mounted = true;

        const checkStatus = async () => {
            const uid = await loadUserId();
            const pid = String(product?._id || product?.id || id || '');

            if (uid && pid && mounted) {
                await checkWishlistStatus(uid, pid);
            }

            // Check cart quantity
            if (product && mounted) {
                await checkCartQuantity();
            }
        };

        checkStatus();

        return () => {
            mounted = false;
        };
    }, [product, id, checkWishlistStatus, checkCartQuantity]);

    // Update selected variant when attributes change
    useEffect(() => {
        if (Object.keys(selectedAttributes).length > 0 && variants.length > 0) {
            const foundVariant = findVariantByAttributes(selectedAttributes);
            if (foundVariant) {
                const variantId = foundVariant?._id || foundVariant?.id;
                setSelectedVariantId(variantId);
                setSelectedVariantDetails(foundVariant);
            } else {
                // If no variant matches the selected attributes, clear selection
                setSelectedVariantId(null);
                setSelectedVariantDetails(null);
            }
        }
    }, [selectedAttributes, variants, findVariantByAttributes]);

    // Update available stock when cart quantity or selected variant changes
    useEffect(() => {
        if (product || variants.length > 0) {
            calculateAvailableStock();
        }
    }, [currentCartQuantity, selectedVariantId, product, variants, calculateAvailableStock]);

    // Image scroll handler
    const handleImageScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / screenWidth);
        setActiveImageIndex(index);
    };

    // Handle attribute selection
    const handleAttributeSelect = (attributeType, value) => {
        setSelectedAttributes(prev => ({
            ...prev,
            [attributeType]: value
        }));
        // Reset quantity to 1 when attribute changes
        setQuantity(1);
    };

    // Check if an attribute value is available (has stock)
    const isAttributeAvailable = (attributeType, value) => {
        return variants.some(variant => {
            const variantAttrs = variant.attributes || [];
            const hasAttribute = variantAttrs.some(attr =>
                (attr?.type || attr?.name) === attributeType &&
                (attr?.value || attr?.name) === value
            );
            const hasStock = (variant.stock || variant.quantity || 0) > 0;
            return hasAttribute && hasStock;
        });
    };

    // Get available values for an attribute type based on current selections
    const getAvailableValues = (attributeType) => {
        const filteredVariants = variants.filter(variant => {
            // Check if variant matches all currently selected attributes except the one being evaluated
            return Object.keys(selectedAttributes).every(type => {
                if (type === attributeType) return true; // Skip the attribute we're checking

                const selectedValue = selectedAttributes[type];
                const variantAttr = (variant.attributes || []).find(attr =>
                    (attr?.type || attr?.name) === type
                );
                return variantAttr && (variantAttr.value || variantAttr.name) === selectedValue;
            });
        });

        const availableValues = new Set();
        filteredVariants.forEach(variant => {
            const variantAttr = (variant.attributes || []).find(attr =>
                (attr?.type || attr?.name) === attributeType
            );
            if (variantAttr && (variant.stock || variant.quantity || 0) > 0) {
                availableValues.add(variantAttr.value || variantAttr.name);
            }
        });

        return Array.from(availableValues);
    };

    // Add to cart handler
    const handleAddToCart = async () => {
        if (updatingCart) return;

        // Check if all required attributes are selected
        const attributeTypes = Object.keys(groupedVariants);
        const missingAttributes = attributeTypes.filter(type => !selectedAttributes[type]);

        if (missingAttributes.length > 0) {
            Alert.alert(
                'Selection Required',
                `Please select ${missingAttributes.map(a => a.toLowerCase()).join(' and ')}`
            );
            return;
        }

        // Check if a valid variant is selected
        if (!selectedVariantId) {
            Alert.alert('Invalid Selection', 'Please select a valid combination');
            return;
        }

        try {
            setUpdatingCart(true);
            const productId = product?._id || product?.id || id;
            const variantId = selectedVariantId;

            // Get current stock
            const available = calculateAvailableStock();

            // Validate quantity
            if (quantity > available) {
                Alert.alert(
                    'Stock Limit Exceeded',
                    `You can only add ${available} items.`
                );
                return;
            }

            const cartData = {
                productId: String(productId),
                variantId: String(variantId),
                quantity: Number(quantity),
            };

            const response = await addCartItem(cartData);

            if (response.success || response.data) {
                // Show success animation
                setShowAddToCartSuccess(true);
                setTimeout(() => setShowAddToCartSuccess(false), 2000);

                // Refresh cart quantity
                await checkCartQuantity();

                // Reset local quantity to 1
                setQuantity(1);

                // Navigate to cart
                router.push("/Cart");
            } else {
                throw new Error('Failed to add to cart');
            }
        } catch (error) {
            console.warn('Add to Cart Error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to add product to cart';
            Alert.alert('Error', errorMessage);
        } finally {
            setUpdatingCart(false);
        }
    };

    // Handle Buy Now button
    const handleBuyNow = async () => {
        if (updatingCart) return;

        // Check if all required attributes are selected
        const attributeTypes = Object.keys(groupedVariants);
        const missingAttributes = attributeTypes.filter(type => !selectedAttributes[type]);

        if (missingAttributes.length > 0) {
            Alert.alert(
                'Selection Required',
                `Please select ${missingAttributes.map(a => a.toLowerCase()).join(' and ')}`
            );
            return;
        }

        // Check if a valid variant is selected
        if (!selectedVariantId) {
            Alert.alert('Invalid Selection', 'Please select a valid combination');
            return;
        }

        try {
            setUpdatingCart(true);
            const productId = product?._id || product?.id || id;
            const variantId = selectedVariantId;

            // Get current stock
            const available = calculateAvailableStock();

            // Validate quantity
            if (quantity > available) {
                Alert.alert(
                    'Stock Limit Exceeded',
                    `You can only add ${available} items.`
                );
                return;
            }

            // If product is already in cart, update quantity to 1
            if (currentCartQuantity > 0) {
                // Remove existing item and add new one
                await removeCartItem(productId, variantId);
            }

            const cartData = {
                productId: String(productId),
                variantId: String(variantId),
                quantity: 1, // Buy now adds 1 item
            };

            const response = await addCartItem(cartData);

            if (response.success || response.data) {
                // Refresh cart
                await checkCartQuantity();
                // Navigate directly to checkout/cart
                router.push("/Cart");
            } else {
                throw new Error('Failed to add to cart');
            }
        } catch (error) {
            console.warn('Buy Now Error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to process your request';
            Alert.alert('Error', errorMessage);
        } finally {
            setUpdatingCart(false);
        }
    };

    // Handle increase quantity (when product is already in cart)
    const handleIncreaseQuantity = async () => {
        if (updatingCart || !cartItemId) return;

        const newQuantity = currentCartQuantity + 1;
        const available = calculateAvailableStock();

        if (newQuantity > available) {
            Alert.alert('Stock Limit', `Only ${available} items available in stock`);
            return;
        }

        try {
            setUpdatingCart(true);
            await updateCartItem(cartItemId, newQuantity);
            await checkCartQuantity(); // Refresh cart data
        } catch (error) {
            console.warn('Increase quantity error:', error);
            Alert.alert('Error', 'Failed to update quantity');
        } finally {
            setUpdatingCart(false);
        }
    };

    // Handle decrease quantity (when product is already in cart)
    const handleDecreaseQuantity = async () => {
        if (updatingCart || !cartItemId) return;

        const newQuantity = currentCartQuantity - 1;

        if (newQuantity === 0) {
            // Remove item from cart
            try {
                setUpdatingCart(true);
                const productId = product?._id || product?.id || id;
                const variantId = selectedVariantId;
                await removeCartItem(productId, variantId);
                await checkCartQuantity(); // Refresh cart data
            } catch (error) {
                console.warn('Remove from cart error:', error);
                Alert.alert('Error', 'Failed to remove item from cart');
            } finally {
                setUpdatingCart(false);
            }
        } else {
            // Update quantity
            try {
                setUpdatingCart(true);
                await updateCartItem(cartItemId, newQuantity);
                await checkCartQuantity(); // Refresh cart data
            } catch (error) {
                console.warn('Decrease quantity error:', error);
                Alert.alert('Error', 'Failed to update quantity');
            } finally {
                setUpdatingCart(false);
            }
        }
    };

    // Wishlist toggle handler
    const handleWishlist = async () => {
        try {
            const pid = String(product?._id || product?.id || id || '');
            if (!userId || !pid) {
                Alert.alert('Sign In Required', 'Please sign in to manage your wishlist.');
                return;
            }

            // Optimistic update
            const previousState = isLiked;
            setIsLiked(!previousState);

            const res = await toggleWishlist(userId, pid);

            // Verify the response
            const newLiked = Boolean(res?.data?.liked ?? res?.liked ?? !previousState);

            if (mountedRef.current) {
                setIsLiked(newLiked);
            }

            // Show feedback
            Alert.alert(
                newLiked ? 'Added To Wishlist' : 'Removed From Wishlist',
                newLiked ? 'Product added to your wishlist!' : 'Product removed from your wishlist!'
            );
        } catch (error) {
            // Revert on error
            if (mountedRef.current) {
                setIsLiked(prev => !prev);
            }
            console.warn('Wishlist Toggle error:', error);
            Alert.alert('Error', 'Failed to update wishlist. Please try again.');
        }
    };

    // Utility functions
    const getSelectedVariant = () => {
        return variants.find(v => (v?._id || v?.id) === selectedVariantId);
    };

    const getDisplayPrice = () => {
        const selectedVariant = getSelectedVariant();
        if (variants.length > 0 && selectedVariant) {
            return selectedVariant.finalPrice || selectedVariant.basePrice || selectedVariant.price || 0;
        }
        return product?.finalPrice || product?.basePrice || product?.price || 0;
    };

    const getBasePrice = () => {
        const selectedVariant = getSelectedVariant();
        if (variants.length > 0 && selectedVariant) {
            return selectedVariant.basePrice || selectedVariant.price || 0;
        }
        return product?.basePrice || product?.price || 0;
    };

    const getDiscountPercentage = () => {
        const basePrice = getBasePrice();
        const finalPrice = getDisplayPrice();

        if (basePrice && finalPrice && basePrice > finalPrice) {
            return Math.round(((basePrice - finalPrice) / basePrice) * 100);
        }
        return 0;
    };

    const isOutOfStock = () => {
        return availableStock <= 0;
    };

    // Handle refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadProductData();
        const uid = await loadUserId();
        const pid = String(product?._id || product?.id || id || '');
        if (uid && pid) {
            await checkWishlistStatus(uid, pid);
        }
    }, [product, id]);

    // Add focus listener to refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (!mountedRef.current) return;

            // Refresh wishlist status
            const pid = String(product?._id || product?.id || id || '');
            if (userId && pid) {
                checkWishlistStatus(userId, pid);
            }
        }, [userId, product, id, checkWishlistStatus])
    );

    const hasVariants = variants.length > 0;
    const selectedVariant = getSelectedVariant();
    const displayPrice = getDisplayPrice();
    const basePrice = getBasePrice();
    const discountPercentage = getDiscountPercentage();
    const hasDiscount = discountPercentage > 0;
    const outOfStock = isOutOfStock();
    const productImages = product?.images || [];
    const productCategories = product?.categoryIds || [];
    const isProductInCart = currentCartQuantity > 0;

    // Loading state
    if (loading && !refreshing) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#4CAD73" />
                <Text style={styles.loaderText}>Loading Product Details...</Text>
            </View>
        );
    }

    // If no product data
    if (!product) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Product Not Found</Text>
                <Pressable style={styles.backButtonError} onPress={handleBack}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with Back Button */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <Pressable style={styles.backButton} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </Pressable>

                    {/* Wishlist Button in Header */}
                    <Pressable
                        style={styles.headerWishlistButton}
                        onPress={handleWishlist}
                        disabled={isCheckingWishlist}
                    >
                        {isCheckingWishlist ? (
                            <ActivityIndicator size="small" color="#DC1010" />
                        ) : (
                            <Ionicons
                                name={isLiked ? "heart" : "heart-outline"}
                                size={24}
                                color={isLiked ? "#DC1010" : "#000"}
                            />
                        )}
                    </Pressable>
                </View>
            </SafeAreaView>

            {/* Main Content */}
            <ScrollView
                style={[styles.scrollView, { paddingBottom: 80 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
                bounces={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#4CAD73']}
                        tintColor="#4CAD73"
                    />
                }
            >
                {/* Product Images Section */}
                <View style={styles.imageSection}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleImageScroll}
                        scrollEventThrottle={16}
                    >
                        {productImages.length > 0 ? (
                            productImages.map((img, index) => {
                                const imageUrl = typeof img === 'string' ? img : (img?.url || img?.path);
                                const source = imageUrl
                                    ? { uri: `${API_BASE_URL}${imageUrl}` }
                                    : require("../../assets/sample-product.png");

                                return (
                                    <View key={`image-${index}`} style={styles.imageWrapper}>
                                        <Image
                                            source={source}
                                            style={styles.productImage}
                                            resizeMode="contain"
                                            defaultSource={require("../../assets/sample-product.png")}
                                        />
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.imageWrapper}>
                                <Image
                                    source={require("../../assets/sample-product.png")}
                                    style={styles.productImage}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
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
                                        defaultSource={require("../../assets/sample-product.png")}
                                    />
                                )}
                                <Text style={styles.brandName}>{product.brandId.name}</Text>
                                {/* Discount Badge */}
                                {hasDiscount && (
                                    <View style={styles.discountBadge}>
                                        <Text style={styles.discountBadgeText}>{discountPercentage}% OFF</Text>
                                    </View>
                                )}
                            </View>
                        )}


                        {/* Rating */}
                        <View style={styles.ratingRow}>
                            <View style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Ionicons
                                        key={`star-${star}`}
                                        name={star <= Math.floor(product?.ratingAverage || 0) ? "star" : "star-outline"}
                                        size={16}
                                        color="#FFC107"
                                        style={styles.star}
                                    />
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
                                {hasDiscount && basePrice > displayPrice && (
                                    <Text style={styles.oldPrice}>
                                        ₹{Number(basePrice).toFixed(2)}
                                    </Text>
                                )}
                                <Text style={styles.currentPrice}>₹{Number(displayPrice).toFixed(2)}</Text>
                            </View>

                            {/* Stock Status */}
                            <View style={styles.stockContainer}>
                                <View style={[styles.stockBadge, outOfStock ? styles.outOfStockBadge : styles.inStockBadge]}>
                                    <Ionicons
                                        name={outOfStock ? "close-circle" : "checkmark-circle"}
                                        size={14}
                                        color="#FFF"
                                    />
                                    <Text style={styles.stockBadgeText}>
                                        {outOfStock ? 'Out of Stock' : `${availableStock} in Stock`}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Description */}
                    {product?.description && (
                        <View style={styles.descriptionSection}>
                            <Text style={styles.sectionTitle}>Description</Text>
                            <Text style={styles.descriptionText}>
                                {product.description}
                            </Text>
                        </View>
                    )}

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

                    {/* Variants Selection */}
                    {hasVariants && Object.keys(groupedVariants).length > 0 && (
                        Object.keys(groupedVariants).map(attributeType => (
                            <View key={attributeType} style={styles.variantsSection}>
                                <Text style={styles.sectionTitle}>
                                    Select {groupedVariants[attributeType].name}
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.variantsContainer}>
                                        {groupedVariants[attributeType].values.map((value, index) => {
                                            const isSelected = selectedAttributes[attributeType] === value;
                                            const isAvailable = isAttributeAvailable(attributeType, value);
                                            const isActive = getAvailableValues(attributeType).includes(value);

                                            return (
                                                <Pressable
                                                    key={`${attributeType}-${value}-${index}`}
                                                    style={[
                                                        styles.variantChip,
                                                        isSelected && styles.variantChipSelected,
                                                        !isActive && styles.variantChipDisabled,
                                                        !isAvailable && styles.variantChipOutOfStock
                                                    ]}
                                                    onPress={() => isActive && handleAttributeSelect(attributeType, value)}
                                                    disabled={!isActive}
                                                >
                                                    <Text style={[
                                                        styles.variantText,
                                                        isSelected && styles.variantTextSelected,
                                                        !isActive && styles.variantTextDisabled,
                                                        !isAvailable && styles.variantTextOutOfStock
                                                    ]}>
                                                        {value}
                                                        {!isAvailable && ' (Out)'}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>
                        ))
                    )}

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
                                            <Ionicons name="star" size={14} color="#FFC107" />
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
                </View>
            </ScrollView>

            {/* Success Message */}
            {showAddToCartSuccess && (
                <Animated.View style={styles.successOverlay}>
                    <Ionicons name="checkmark-circle" size={32} color="#4CAD73" />
                    <Text style={styles.successText}>Added to cart successfully!</Text>
                </Animated.View>
            )}

            {/* Fixed Bottom Action Bar - Dynamic based on cart status */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom }]}>
                <View style={styles.bottomActionBar}>
                    {isProductInCart ? (
                        // Product already in cart - Show quantity controls
                        <>
                            <View style={styles.quantityControlsWrapper}>
                                <Text style={styles.cartQuantityLabel}>In Cart:</Text>
                                <View style={styles.cartQuantityControls}>
                                    <Pressable
                                        style={[styles.quantityButton, outOfStock && styles.buttonDisabled]}
                                        onPress={handleDecreaseQuantity}
                                        disabled={outOfStock || updatingCart}
                                    >
                                        <Ionicons
                                            name="remove"
                                            size={20}
                                            color={outOfStock ? "#999999" : "#FFFFFF"}
                                        />
                                    </Pressable>
                                    <Text style={[styles.cartQuantityValue, outOfStock && styles.textDisabled]}>
                                        {currentCartQuantity}
                                    </Text>
                                    <Pressable
                                        style={[styles.quantityButton, outOfStock && styles.buttonDisabled]}
                                        onPress={handleIncreaseQuantity}
                                        disabled={outOfStock || currentCartQuantity >= availableStock || updatingCart}
                                    >
                                        <Ionicons
                                            name="add"
                                            size={20}
                                            color={outOfStock ? "#999999" : "#FFFFFF"}
                                        />
                                    </Pressable>
                                </View>
                            </View>
                            <Pressable
                                style={[styles.viewCartButton, outOfStock && styles.buttonDisabled]}
                                onPress={() => router.push("/Cart")}
                                disabled={outOfStock}
                            >
                                <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
                                <Text style={styles.viewCartButtonText}>View Cart</Text>
                            </Pressable>
                        </>
                    ) : (
                        // Product not in cart - Show Buy Now button
                        <Pressable
                            style={[styles.buyNowButton, outOfStock && styles.buttonDisabled]}
                            onPress={handleBuyNow}
                            disabled={outOfStock || updatingCart}
                        >
                            {updatingCart ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buyNowButtonText}>
                                    {outOfStock ? 'Out of Stock' : 'Buy Now'}
                                </Text>
                            )}
                        </Pressable>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
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
        backgroundColor: '#F8F9FA',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#666',
        fontFamily: 'Poppins',
        marginBottom: 20,
    },
    backButtonError: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Poppins',
        fontWeight: '600',
    },
    // Header Styles
    headerSafeArea: {
        backgroundColor: 'transparent',
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    header: {
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerWishlistButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    scrollView: {
        flex: 1,
    },
    // Image Section
    imageSection: {
        height: 380,
        backgroundColor: "#F2F2F2",
        position: 'relative',
    },
    imageWrapper: {
        width: screenWidth,
        height: 380,
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
        backgroundColor: '#FF4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    discountBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'Poppins',
    },
    detailsSection: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
        paddingTop: 30,
        paddingHorizontal: 20,
        paddingBottom: 130,
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
        marginRight: 2,
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
        gap: 12,
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
        fontSize: 28,
        fontFamily: "Poppins",
        fontWeight: "700",
        color: "#4CAD73",
    },
    stockContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    inStockBadge: {
        backgroundColor: '#4CAD73',
    },
    outOfStockBadge: {
        backgroundColor: '#FF4444',
    },
    stockBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Poppins',
        fontWeight: '500',
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
        marginBottom: 16,
    },
    variantsContainer: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    variantChip: {
        borderWidth: 1,
        borderColor: '#E6E6E6',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 8,
    },
    variantChipSelected: {
        borderColor: '#4CAD73',
        backgroundColor: 'rgba(76, 173, 115, 0.1)',
    },
    variantChipDisabled: {
        borderColor: '#E6E6E6',
        backgroundColor: '#F5F5F5',
        opacity: 0.5,
    },
    variantChipOutOfStock: {
        borderColor: '#FFCCCB',
        backgroundColor: '#FFF5F5',
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
        color: '#999',
    },
    variantTextOutOfStock: {
        color: '#FF4444',
    },
    selectedVariantSection: {
        backgroundColor: '#F8F9FA',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderLeftWidth: 3,
        borderLeftColor: '#4CAD73',
    },
    variantDetails: {
        gap: 8,
    },
    variantSku: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#333",
    },
    variantAttributes: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#666",
    },
    variantStock: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#4CAD73",
        fontWeight: '600',
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
        marginLeft: 2,
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
    // Success Animation
    successOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingVertical: 12,
        alignItems: 'center',
        zIndex: 100,
        shadowColor: '#4CAD73',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    successText: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#4CAD73",
        marginTop: 4,
    },
    // Bottom Action Bar Styles
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
    },
    bottomActionBar: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        paddingBottom: 12 + (Platform.OS === 'android' ? 8 : 0),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#E6E6E6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        minHeight: 70,
    },
    // Buy Now Button (when product not in cart)
    buyNowButton: {
        flex: 1,
        height: 48,
        backgroundColor: "#4CAD73",
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buyNowButtonText: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#FFFFFF",
    },
    // Cart Quantity Controls (when product is in cart)
    quantityControlsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cartQuantityLabel: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#333",
    },
    cartQuantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    quantityButton: {
        width: 32,
        height: 32,
        backgroundColor: '#4CAD73',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartQuantityValue: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#000000",
        marginHorizontal: 16,
        minWidth: 30,
        textAlign: 'center',
    },
    viewCartButton: {
        flex: 1,
        marginLeft: 16,
        height: 48,
        backgroundColor: "#FF6B35",
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    viewCartButtonText: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#FFFFFF",
    },
    buttonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    textDisabled: {
        color: '#999999',
    },
});
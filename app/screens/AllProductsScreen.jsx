import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Image,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Platform,
    ActivityIndicator,
    TextInput,
    Modal,
    ScrollView,
    Alert,
    RefreshControl,
    ToastAndroid
} from 'react-native';
import {useRouter, useLocalSearchParams} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCategories, getProducts, toggleWishlist, checkWishlist} from "../../api/catalogApi";
import {addCartItem, getCart, removeCartItem, updateCartItem} from "../../api/cartApi";
import {API_BASE_URL} from "../../config/apiConfig";
import Slider from '@react-native-community/slider';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

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

// Check if device is tablet
const isTablet = screenWidth >= 768;

export default function AllProductsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(params.selectedCategory || 'all');
    const [sortBy, setSortBy] = useState('popular');
    const [priceRange, setPriceRange] = useState([0, 10000]);
    const [maxPrice, setMaxPrice] = useState(10000);
    const [showFilters, setShowFilters] = useState(false);
    const [cartItems, setCartItems] = useState([]);
    const [addingToCart, setAddingToCart] = useState({});
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [tierPricing, setTierPricing] = useState({});

    // Wishlist states - simple boolean for each product
    const [wishlistStatus, setWishlistStatus] = useState({}); // {productId: true/false}
    const [wishlistLoading, setWishlistLoading] = useState({}); // {productId: true/false}
    const [userId, setUserId] = useState(null);
    const [checkedProductIds, setCheckedProductIds] = useState(new Set()); // Track which products have been checked

    // Calculate number of columns based on screen width
    const getColumnsCount = () => {
        if (screenWidth >= 1024) return 3;
        if (screenWidth >= 768) return 3;
        if (screenWidth >= 414) return 2;
        if (screenWidth >= 375) return 2;
        return 2;
    };

    const columnsCount = getColumnsCount();
    const sortOptions = [
        {id: 'popular', label: 'Most Popular'},
        {id: 'price-low', label: 'Price: Low to High'},
        {id: 'price-high', label: 'Price: High to Low'},
        {id: 'name', label: 'Name: A to Z'},
        {id: 'newest', label: 'Newest First'},
    ];

    // Load initial data
    useEffect(() => {
        loadInitialData();
        checkUserType();
    }, []);

    // Filter products when criteria change
    useEffect(() => {
        filterAndSortProducts();
    }, [products, searchQuery, selectedCategory, sortBy, priceRange]);

    // Check wishlist status for filtered products after they're set
    useEffect(() => {
        if (filteredProducts.length > 0 && userId) {
            checkWishlistForVisibleProducts();
        }
    }, [filteredProducts, userId]);

    const loadInitialData = async () => {
        await Promise.all([
            loadProducts(),
            loadCategories(),
            loadCartItems()
        ]);
    };

    const checkUserType = async () => {
        try {
            const loginType = await AsyncStorage.getItem('loginType');
            setIsBusinessUser(loginType === 'business');

            // Load user ID for wishlist
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                const uid = user?._id || user?.id || user?.userId || null;
                setUserId(uid);
            }

            if (loginType === 'business') {
                await loadTierPricing();
            }
        } catch (error) {
            console.error('Error checking user type:', error);
        }
    };

    const loadTierPricing = async () => {
        try {
            console.log('Loading tier pricing for business user...');
        } catch (error) {
            console.error('Error loading tier pricing:', error);
        }
    };

    const loadProducts = async () => {
        try {
            setLoading(true);
            const res = await getProducts({page: 1, limit: 100});
            const productsData = extractProductsFromResponse(res);

            setProducts(productsData);

            // Calculate max price from products
            const maxProductPrice = calculateMaxPrice(productsData);
            setMaxPrice(Math.ceil(maxProductPrice * 1.1));
            setPriceRange([0, Math.ceil(maxProductPrice * 1.1)]);

        } catch (error) {
            console.error('Error loading products:', error);
            Alert.alert('Error', 'Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    // Check wishlist status for filtered products
    const checkWishlistForVisibleProducts = async () => {
        if (!userId || filteredProducts.length === 0) return;

        // Only check products that haven't been checked yet
        const productsToCheck = filteredProducts.filter(product => {
            const productId = getProductId(product);
            return productId && !checkedProductIds.has(productId) && wishlistStatus[productId] === undefined;
        });

        if (productsToCheck.length === 0) return;

        console.log(`Checking wishlist for ${productsToCheck.length} products`);

        // Process each product individually with delay to avoid overwhelming the API
        for (const product of productsToCheck) {
            const productId = getProductId(product);
            if (!productId) continue;

            try {
                // Mark as checking
                setWishlistLoading(prev => ({...prev, [productId]: true}));

                const response = await checkWishlist(userId, productId);

                let isInWishlist = false;

                // Handle different API response formats
                if (response?.success && response.data?.isLiked !== undefined) {
                    isInWishlist = response.data.isLiked;
                } else if (response?.success && response.data?.liked !== undefined) {
                    isInWishlist = response.data.liked;
                } else if (response?.isLiked !== undefined) {
                    isInWishlist = response.isLiked;
                } else if (response?.liked !== undefined) {
                    isInWishlist = response.liked;
                } else if (response?.inWishlist !== undefined) {
                    isInWishlist = response.inWishlist;
                }

                // Update state
                setWishlistStatus(prev => ({
                    ...prev,
                    [productId]: isInWishlist
                }));

                // Mark as checked
                setCheckedProductIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(productId);
                    return newSet;
                });

            } catch (error) {
                console.error(`Error checking wishlist for product ${productId}:`, error);
                // Default to false on error
                setWishlistStatus(prev => ({
                    ...prev,
                    [productId]: false
                }));

                // Still mark as checked even on error to avoid retrying
                setCheckedProductIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(productId);
                    return newSet;
                });
            } finally {
                setWishlistLoading(prev => ({...prev, [productId]: false}));
            }

            // Small delay between requests to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    // Simple function to toggle wishlist for a product
    const toggleProductWishlist = async (productId) => {
        if (!userId || !productId) return false;

        try {
            const response = await toggleWishlist(userId, productId);

            // Handle different API response formats
            if (response?.success && response.data?.isLiked !== undefined) {
                return response.data.isLiked;
            } else if (response?.success && response.data?.liked !== undefined) {
                return response.data.liked;
            } else if (response?.isLiked !== undefined) {
                return response.isLiked;
            } else if (response?.liked !== undefined) {
                return response.liked;
            } else if (response?.inWishlist !== undefined) {
                return response.inWishlist;
            } else if (response?.message?.includes('added')) {
                return true;
            } else if (response?.message?.includes('removed')) {
                return false;
            }

            return false;
        } catch (error) {
            console.error(`Error toggling wishlist for product ${productId}:`, error);
            throw error;
        }
    };

    // Helper function to get product ID
    const getProductId = (item) => {
        if (!item) return '';
        const id = item.id || item._id || item.productId;
        if (id === undefined || id === null) return '';
        return String(id).trim();
    };

    const calculateMaxPrice = (productsList) => {
        if (!productsList || productsList.length === 0) return 10000;

        return productsList.reduce((max, product) => {
            const priceInfo = calculateProductPrice(product);
            return Math.max(max, priceInfo.finalPrice);
        }, 0);
    };

    const loadCategories = async () => {
        try {
            const res = await getCategories();
            const categoriesData = extractCategoriesFromResponse(res);
            setCategories([{_id: 'all', name: 'All Categories'}, ...categoriesData]);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadCartItems = async () => {
        try {
            const cartData = await getCart();
            const items = extractCartItems(cartData);
            setCartItems(items);
        } catch (error) {
            console.error('Error loading cart items:', error);
            setCartItems([]);
        }
    };

    const extractProductsFromResponse = (response) => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.items)) return response.items;
        if (Array.isArray(response.data?.items)) return response.data.items;
        if (response.success && Array.isArray(response.data?.data)) return response.data.data;
        return [];
    };

    const extractCategoriesFromResponse = (response) => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.data?.data)) return response.data.data;
        return [];
    };

    const extractCartItems = (cartData) => {
        if (cartData?.success) {
            if (cartData.data?.items) return cartData.data.items;
            if (Array.isArray(cartData.data)) return cartData.data;
        }
        if (Array.isArray(cartData)) return cartData;
        return [];
    };

    const filterAndSortProducts = useCallback(() => {
        let filtered = [...products];

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(product => {
                const title = product?.title?.toLowerCase() || '';
                const name = product?.name?.toLowerCase() || '';
                const description = product?.description?.toLowerCase() || '';
                const categoryName = product?.category?.name?.toLowerCase() || '';

                return title.includes(query) ||
                    name.includes(query) ||
                    description.includes(query) ||
                    categoryName.includes(query);
            });
        }

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(product =>
                product.category === selectedCategory ||
                product.categoryId === selectedCategory ||
                product.category?._id === selectedCategory ||
                (typeof product.category === 'string' && product.category === selectedCategory)
            );
        }

        // Filter by price range
        filtered = filtered.filter(product => {
            const price = calculateProductPrice(product).finalPrice;
            return price >= priceRange[0] && price <= priceRange[1];
        });

        // Sort products
        filtered.sort((a, b) => {
            const priceA = calculateProductPrice(a).finalPrice;
            const priceB = calculateProductPrice(b).finalPrice;
            const nameA = (a.title || a.name || '').toLowerCase();
            const nameB = (b.title || b.name || '').toLowerCase();

            switch (sortBy) {
                case 'price-low':
                    return priceA - priceB;
                case 'price-high':
                    return priceB - priceA;
                case 'name':
                    return nameA.localeCompare(nameB);
                case 'newest':
                    return new Date(b.createdAt || b.dateAdded || 0) - new Date(a.createdAt || a.dateAdded || 0);
                case 'popular':
                default:
                    return (b.popularity || b.views || 0) - (a.popularity || a.views || 0);
            }
        });

        setFilteredProducts(filtered);
    }, [products, searchQuery, selectedCategory, sortBy, priceRange]);

    // Get available stock for a product
    const getProductStock = (product, variantId = null) => {
        // Check if product has variants
        if (product.variants && product.variants.length > 0) {
            const variant = variantId
                ? product.variants.find(v => v._id === variantId || v.id === variantId)
                : product.variants[0]; // Default to first variant

            if (variant) {
                // Check variant-specific stock
                if (variant.stock !== undefined && variant.stock !== null) {
                    return Number(variant.stock);
                }
                // Check variant stock status
                if (variant.stockStatus === 'out_of_stock') return 0;
                if (variant.stockStatus === 'in_stock') return 999; // Large number for "in stock"
            }
        }

        // Check product-level stock
        if (product.stock !== undefined && product.stock !== null) {
            return Number(product.stock);
        }

        // Check product stock status
        if (product.stockStatus === 'out_of_stock') return 0;
        if (product.stockStatus === 'in_stock') return 999; // Large number for "in stock"

        // Default to 0 if no stock info
        return 0;
    };

    // Get available stock (total stock minus cart quantity)
    const getAvailableStock = (product, variantId = null) => {
        const totalStock = getProductStock(product, variantId);

        return Math.max(0, totalStock);
    };

    // Check if product is out of stock
    const isProductOutOfStock = (product, variantId = null) => {
        const totalStock = getProductStock(product, variantId);
        return totalStock <= 0;
    };

    // Check if product is low in stock
    const isProductLowStock = (product, variantId = null) => {
        const availableStock = getAvailableStock(product, variantId);
        return availableStock > 0 && availableStock <= 5;
    };

    const calculateProductPrice = (product, quantity = 1) => {
        const normalize = (val) => val !== undefined && val !== null ? Number(val) : null;

        const buildResponse = (base, final, discount, discountPercentOverride, minQty = 1) => {
            base = normalize(base);
            final = normalize(final);

            if (!base) base = 0;
            if (!final) final = base;

            let discountPercent = 0;

            if (discountPercentOverride > 0) {
                discountPercent = discountPercentOverride;
            } else if (discount?.type === "percent" && discount.value > 0) {
                discountPercent = Number(discount.value);
            } else if (final < base) {
                discountPercent = Math.round(((base - final) / base) * 100);
            }

            return {
                basePrice: Math.round(base),
                finalPrice: Math.round(final),
                hasDiscount: discountPercent > 0,
                discountPercent,
                minQty
            };
        };

        if (isBusinessUser && product.tierPricing && Array.isArray(product.tierPricing)) {
            const applicableTier = product.tierPricing.find(tier =>
                quantity >= tier.minQty && quantity <= tier.maxQty
            );

            if (applicableTier) {
                return buildResponse(
                    applicableTier.price,
                    applicableTier.price,
                    null,
                    0,
                    applicableTier.minQty
                );
            }
        }

        if (Array.isArray(product?.variants) && product.variants.length > 0) {
            const v = product.variants[0];
            return buildResponse(
                v.basePrice ?? product.basePrice,
                v.finalPrice ?? product.finalPrice ?? product.price,
                v.discount ?? product.discount,
                v.discountPercent ?? product.discountPercent
            );
        }

        return buildResponse(
            product.basePrice ?? product.price,
            product.finalPrice ?? product.price,
            product.discount,
            product.discountPercent
        );
    };

    const getCartQuantity = (productId, variantId = null) => {
        const item = cartItems.find(cartItem =>
            cartItem.productId === String(productId) &&
            cartItem.variantId === (variantId ? String(variantId) : null)
        );
        return item ? item.quantity : 0;
    };

    const getCartItemId = (productId, variantId = null) => {
        const cartItem = cartItems.find(item =>
            item.productId === String(productId) &&
            item.variantId === (variantId ? String(variantId) : null)
        );
        return cartItem?._id || cartItem?.id;
    };

    const handleAddToCart = async (product) => {
        try {
            const productId = getProductId(product);
            const variantId = product.variants?.[0]?._id || productId;
            const availableStock = getAvailableStock(product, variantId);

            // Check if product is out of stock
            if (isProductOutOfStock(product, variantId)) {
                Alert.alert(
                    'Out of Stock',
                    'This product is currently out of stock.',
                    [{text: 'OK'}]
                );
                return;
            }

            // Check if there's any available stock
            if (availableStock <= 0) {
                Alert.alert(
                    'No Stock Available',
                    'This product is already at maximum stock in your cart.',
                    [{text: 'OK'}]
                );
                return;
            }

            if (isBusinessUser && product.minQty && product.minQty > 1) {
                Alert.alert(
                    'Minimum Quantity Required',
                    `Minimum order quantity for this product is ${product.minQty} units for business customers.`,
                    [{text: 'OK'}]
                );
                return;
            }

            setAddingToCart(prev => ({...prev, [productId]: true}));

            const quantity = product.minQty || 1;

            // Check if requested quantity exceeds available stock
            if (quantity > availableStock) {
                Alert.alert(
                    'Insufficient Stock',
                    `Only ${availableStock} units available in stock.`,
                    [{text: 'OK'}]
                );
                return;
            }

            const cartItem = {
                productId: productId,
                quantity: quantity,
                variantId: variantId
            };

            await addCartItem(cartItem);
            await loadCartItems();


        } catch (error) {
            console.error('Add to cart error:', error);
            const errorMessage = error.response?.data?.message || error.message;

            if (errorMessage.includes('Minimum quantity') || errorMessage.includes('minQty')) {
                Alert.alert('Minimum Quantity', errorMessage);
            } else if (errorMessage.includes('stock') || errorMessage.includes('out of stock')) {
                Alert.alert('Stock Issue', 'This product is out of stock or insufficient stock available.');
            } else {
                Alert.alert('Error', 'Failed to add product to cart. Please try again.');
            }
        } finally {
            const productId = getProductId(product);
            setAddingToCart(prev => ({...prev, [productId]: false}));
        }
    };

    const handleUpdateQuantity = async (productId, variantId, newQuantity, product) => {
        try {
            const availableStock = getAvailableStock(product, variantId);
            const currentCartQuantity = getCartQuantity(productId, variantId);

            // If trying to increase quantity, check stock
            if (newQuantity > currentCartQuantity) {
                const additionalQuantity = newQuantity - currentCartQuantity;
                if (additionalQuantity > availableStock) {
                    Alert.alert(
                        'Insufficient Stock',
                        `Only ${availableStock} units available in stock.`,
                        [{text: 'OK'}]
                    );
                    return;
                }
            }

            const itemId = getCartItemId(productId, variantId);

            if (!itemId) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            if (newQuantity === 0) {
                await removeCartItem(productId, variantId);
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Removed from cart', ToastAndroid.SHORT);
                }
            } else {
                await updateCartItem(itemId, newQuantity);
            }

            await loadCartItems();
        } catch (error) {
            console.error('Error updating quantity:', error);
            Alert.alert('Error', 'Failed to update quantity');
        }
    };

    // Handle wishlist button press
    const handleWishlistPress = async (product) => {
        const productId = getProductId(product);

        if (!productId) {
            console.error('Invalid product ID');
            return;
        }

        // Check if user is logged in
        if (!userId) {
            Alert.alert(
                'Login Required',
                'Please login to add items to your wishlist',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Login',
                        onPress: () => router.push('/screens/LoginScreen')
                    }
                ]
            );
            return;
        }

        // Set loading state for this product
        setWishlistLoading(prev => ({...prev, [productId]: true}));

        try {
            // Get current status
            const currentStatus = wishlistStatus[productId] || false;

            // Optimistically update UI
            setWishlistStatus(prev => ({
                ...prev,
                [productId]: !currentStatus
            }));

            // Call API to toggle wishlist
            const newStatus = await toggleProductWishlist(productId);

            // Update with actual API response
            setWishlistStatus(prev => ({
                ...prev,
                [productId]: newStatus
            }));

            // Show feedback
            const message = newStatus ? 'Added to wishlist' : 'Removed from wishlist';

            if (Platform.OS === 'android') {
                ToastAndroid.show(message, ToastAndroid.SHORT);
            } else {
                Alert.alert('Success', message, [{ text: 'OK' }]);
            }
        } catch (error) {
            console.error('Error toggling wishlist:', error);

            // Revert on error
            const currentStatus = wishlistStatus[productId] || false;
            setWishlistStatus(prev => ({
                ...prev,
                [productId]: currentStatus
            }));

            Alert.alert('Error', 'Failed to update wishlist. Please try again.');
        } finally {
            setWishlistLoading(prev => ({...prev, [productId]: false}));
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadInitialData();
        // Reset wishlist status on refresh
        setWishlistStatus({});
        setWishlistLoading({});
        setCheckedProductIds(new Set());
        setRefreshing(false);
    }, []);

    const handlePriceRangeChange = (values) => {
        setPriceRange(values);
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setSelectedCategory('all');
        setSortBy('popular');
        const maxPriceValue = calculateMaxPrice(products);
        setPriceRange([0, Math.ceil(maxPriceValue * 1.1)]);
        setShowFilters(false);
    };

    const handleApplyFilters = () => {
        setShowFilters(false);
    };

    // Calculate dynamic card width with proper spacing
    const getProductCardWidth = () => {
        const totalHorizontalPadding = RF(10) * 2; // Container padding
        const totalGapSpacing = RF(10) * (columnsCount - 1); // Gaps between cards
        const availableWidth = screenWidth - totalHorizontalPadding - totalGapSpacing;
        return availableWidth / columnsCount;
    };

    const renderProductItem = ({item}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = getProductId(item);
        const variantId = item.variants?.[0]?._id || productId;
        const cartQuantity = getCartQuantity(productId, variantId);
        const availableStock = getAvailableStock(item, variantId);
        const totalStock = getProductStock(item, variantId);
        const isOutOfStock = isProductOutOfStock(item, variantId);
        const isLowStock = isProductLowStock(item, variantId);
        const isMaxStockInCart = cartQuantity >= totalStock;

        // Get wishlist status from state
        const isInWishlist = wishlistStatus[productId] || false;
        const isLoadingWishlist = wishlistLoading[productId] || false;

        const imageSource = item.thumbnail
            ? {uri: `${API_BASE_URL}${item.thumbnail}`}
            : require('../../assets/Rectangle 24904.png');

        const cardWidth = getProductCardWidth();
        const imageHeight = RF(isTablet ? 120 : 100);

        return (
            <Pressable
                style={[styles.productCard, { width: cardWidth }]}
                onPress={() => router.push(`/screens/ProductDetailScreen?id=${productId}`)}
                activeOpacity={0.7}
            >
                {/* Wishlist Button */}
                <Pressable
                    style={[
                        styles.wishlistButton,
                        {
                            backgroundColor: isInWishlist ? '#FFE8E8' : 'rgba(255, 255, 255, 0.9)',
                            borderColor: isInWishlist ? '#FF6B6B' : 'rgba(0, 0, 0, 0.1)',
                        }
                    ]}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleWishlistPress(item);
                    }}
                    disabled={isLoadingWishlist}
                >
                    {isLoadingWishlist ? (
                        <ActivityIndicator
                            size="small"
                            color={isInWishlist ? "#FF6B6B" : "#666"}
                        />
                    ) : (
                        <Image
                            source={
                                isInWishlist
                                    ? require("../../assets/icons/heart_filled.png")
                                    : require("../../assets/icons/heart_empty.png")
                            }
                            style={[
                                styles.wishlistIcon,
                                {
                                    tintColor: isInWishlist ? "#FF6B6B" : "#666",
                                }
                            ]}
                            resizeMode="contain"
                        />
                    )}
                </Pressable>

                {/* Stock Badge */}
                {isOutOfStock ? (
                    <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
                    </View>
                ) : isLowStock ? (
                    <View style={styles.lowStockBadge}>
                        <Text style={styles.lowStockText}>LOW STOCK</Text>
                    </View>
                ) : null}

                {isBusinessUser && priceInfo.minQty > 1 && (
                    <View style={styles.minQtyBadge}>
                        <Text style={styles.minQtyText}>Min: {priceInfo.minQty}</Text>
                    </View>
                )}

                <View style={[styles.productImageContainer, { height: imageHeight }]}>
                    <Image
                        source={imageSource}
                        style={[styles.productImage, isOutOfStock && styles.outOfStockImage]}
                        resizeMode="contain"
                    />
                </View>

                <View style={styles.productInfo}>
                    <Text style={[styles.productName, isOutOfStock && styles.outOfStockText]} numberOfLines={2}>
                        {item.title || item.name}
                    </Text>

                    {/* Stock Info */}
                    {!isOutOfStock && (
                        <View style={styles.stockInfoContainer}>
                            <Text style={styles.stockInfoText}>
                                Stock: {availableStock} {availableStock === 1 ? 'unit' : 'units'}
                            </Text>
                        </View>
                    )}

                    <View style={styles.priceContainer}>
                        <Text style={[styles.productPrice, isOutOfStock && styles.outOfStockText]}>
                            ₹{priceInfo.finalPrice.toLocaleString()}
                        </Text>
                        {priceInfo.hasDiscount && !isOutOfStock && (
                            <View style={styles.discountContainer}>
                                <Text style={styles.originalPrice}>₹{priceInfo.basePrice.toLocaleString()}</Text>
                                <Text style={styles.discountBadge}>{priceInfo.discountPercent}% OFF</Text>
                            </View>
                        )}
                    </View>

                    {isBusinessUser && priceInfo.minQty > 1 && !isOutOfStock && (
                        <Text style={styles.businessMinQty}>
                            Min. {priceInfo.minQty} units
                        </Text>
                    )}

                    <View style={styles.quantityContainer}>
                        {cartQuantity > 0 ? (
                            <View style={styles.quantityControl}>
                                <Pressable
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(productId, variantId, cartQuantity - 1, item)}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[styles.quantityButtonText]}>-</Text>
                                </Pressable>
                                <Text style={styles.quantityText}>{cartQuantity}</Text>
                                <Pressable
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(productId, variantId, cartQuantity + 1, item)}
                                    activeOpacity={0.6}
                                    disabled={isMaxStockInCart}
                                >
                                    <Text style={[styles.quantityButtonText, isMaxStockInCart && styles.quantityButtonDisabled]}>+</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={[
                                    styles.addButton,
                                    (addingToCart[productId] || isOutOfStock || availableStock <= 0) && styles.addButtonDisabled
                                ]}
                                disabled={addingToCart[productId] || isOutOfStock || availableStock <= 0}
                                onPress={() => handleAddToCart(item)}
                                activeOpacity={0.7}
                            >
                                {addingToCart[productId] ? (
                                    <ActivityIndicator size="small" color="#27AF34" />
                                ) : (
                                    <Text style={[styles.addButtonText, isOutOfStock && styles.outOfStockButtonText]}>
                                        {isOutOfStock ? 'OUT OF STOCK' : 'ADD'}
                                    </Text>
                                )}
                            </Pressable>
                        )}
                    </View>
                </View>
            </Pressable>
        );
    };

    // Loading state
    if (loading) {
        return (
            <View style={styles.safeContainer}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4CAD73" />
                        <Text style={styles.loadingText}>Loading products...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.safeContainer}>
            <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>

            {/* Header with Safe Area */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={[
                    styles.header,
                    {
                        height: RF(60) + safeAreaInsets.top,
                        paddingTop: safeAreaInsets.top,
                    }
                ]}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                        <Image
                            source={require('../../assets/icons/back_icon.png')}
                            style={[
                                styles.backIcon,
                                {
                                    width: RF(24),
                                    height: RF(24),
                                }
                            ]}
                        />
                    </Pressable>

                    <Text style={[
                        styles.headerTitle,
                        {
                            fontSize: RF(18),
                        }
                    ]}>All Products</Text>

                    {/* Placeholder to balance the layout */}
                    <View style={[
                        styles.headerPlaceholder,
                        {width: RF(40)}
                    ]}/>
                </View>
            </SafeAreaView>

            {/* Main Content with bottom safe area */}
            <SafeAreaView style={styles.contentSafeArea}>
                <View style={styles.mainContent}>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Image
                            source={require('../../assets/icons/search.png')}
                            style={styles.searchIcon}
                        />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                            placeholderTextColor="#999"
                            returnKeyType="search"
                            onSubmitEditing={filterAndSortProducts}
                        />
                        {searchQuery ? (
                            <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
                                <Image
                                    source={require('../../assets/icons/deleteIcon.png')}
                                    style={styles.clearIcon}
                                />
                            </Pressable>
                        ) : null}
                    </View>

                    {/* Results Count and Filter */}
                    <View style={styles.resultsContainer}>
                        <Text style={styles.resultsText}>
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'} Found
                        </Text>
                        <Pressable onPress={() => setShowFilters(true)} style={styles.filterResultsButton}>
                            <Text style={styles.filterResultsText}>Filter</Text>
                            <Image
                                source={require('../../assets/icons/filter.png')}
                                style={styles.filterResultsIcon}
                            />
                        </Pressable>
                    </View>

                    {/* Products Grid */}
                    <FlatList
                        data={filteredProducts}
                        renderItem={renderProductItem}
                        keyExtractor={(item) => `${item._id || item.id}-${item.updatedAt || ''}`}
                        numColumns={columnsCount}
                        refreshControl={
                            <ScrollView
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                        colors={['#4CAD73']}
                                        tintColor="#4CAD73"
                                    />
                                }
                            />
                        }
                        contentContainerStyle={[
                            styles.productsGrid,
                            {
                                paddingBottom: safeAreaInsets.bottom + RF(20),
                            }
                        ]}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Image
                                    source={require('../../assets/icons/empty-box.png')}
                                    style={styles.emptyIcon}
                                />
                                <Text style={styles.emptyText}>No products found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'Try changing your filters'}
                                </Text>
                                <Pressable
                                    style={styles.resetEmptyButton}
                                    onPress={handleResetFilters}
                                >
                                    <Text style={styles.resetEmptyButtonText}>Reset Filters</Text>
                                </Pressable>
                            </View>
                        }
                        ListHeaderComponent={
                            filteredProducts.length > 0 ? (
                                <Text style={styles.listHeaderText}>
                                    Showing {filteredProducts.length} of {products.length} products
                                </Text>
                            ) : null
                        }
                        columnWrapperStyle={columnsCount > 1 ? styles.columnWrapper : null}
                    />
                </View>
            </SafeAreaView>

            {/* Filters Modal */}
            <Modal
                visible={showFilters}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFilters(false)}
                statusBarTranslucent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, {
                        maxHeight: screenHeight * 0.85,
                        borderTopLeftRadius: RF(20),
                        borderTopRightRadius: RF(20),
                    }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filters & Sort</Text>
                            <Pressable onPress={() => setShowFilters(false)} activeOpacity={0.7}>
                                <Image
                                    source={require('../../assets/icons/deleteIcon.png')}
                                    style={styles.closeIcon}
                                />
                            </Pressable>
                        </View>

                        <ScrollView
                            style={styles.filterContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Sort By */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Sort By</Text>
                                {sortOptions.map((sort) => (
                                    <Pressable
                                        key={sort.id}
                                        style={styles.filterOption}
                                        onPress={() => setSortBy(sort.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.radioButton}>
                                            {sortBy === sort.id && <View style={styles.radioSelected}/>}
                                        </View>
                                        <Text style={styles.filterOptionText}>
                                            {sort.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Price Range */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Price Range</Text>
                                <Text style={styles.priceRangeText}>
                                    ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                                </Text>
                                <View style={styles.sliderContainer}>
                                    <Slider
                                        style={styles.slider}
                                        minimumValue={0}
                                        maximumValue={maxPrice}
                                        minimumTrackTintColor="#4CAD73"
                                        maximumTrackTintColor="#E0E0E0"
                                        thumbTintColor="#4CAD73"
                                        value={priceRange[1]}
                                        onValueChange={(value) => setPriceRange([priceRange[0], value])}
                                        step={100}
                                    />
                                    <View style={styles.sliderLabels}>
                                        <Text style={styles.sliderLabel}>₹0</Text>
                                        <Text style={styles.sliderLabel}>₹{maxPrice.toLocaleString()}</Text>
                                    </View>
                                </View>
                                <View style={styles.priceInputsContainer}>
                                    <View style={styles.priceInputWrapper}>
                                        <Text style={styles.priceLabel}>Min:</Text>
                                        <TextInput
                                            style={styles.priceInput}
                                            value={priceRange[0].toString()}
                                            onChangeText={(text) => {
                                                const value = parseInt(text) || 0;
                                                if (value <= priceRange[1]) {
                                                    setPriceRange([value, priceRange[1]]);
                                                }
                                            }}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={styles.priceInputWrapper}>
                                        <Text style={styles.priceLabel}>Max:</Text>
                                        <TextInput
                                            style={styles.priceInput}
                                            value={priceRange[1].toString()}
                                            onChangeText={(text) => {
                                                const value = parseInt(text) || 0;
                                                if (value >= priceRange[0] && value <= maxPrice) {
                                                    setPriceRange([priceRange[0], value]);
                                                }
                                            }}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Keep all your styles exactly the same
const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#4CAD73',
    },
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    headerSafeArea: {
        backgroundColor: '#4CAD73',
    },
    contentSafeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(16),
    },
    backButton: {
        padding: RF(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        tintColor: '#FFFFFF'
    },
    headerTitle: {
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        flex: 1,
    },
    headerPlaceholder: {
        opacity: 0,
    },
    mainContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        margin: RF(16),
        marginTop: RF(12),
        paddingHorizontal: RF(12),
        borderRadius: RF(10),
        height: RF(44),
    },
    searchIcon: {
        width: RF(18),
        height: RF(18),
        marginRight: RF(8),
        tintColor: '#666',
    },
    searchInput: {
        flex: 1,
        fontSize: RF(14),
        color: '#333',
        fontFamily: 'Poppins-Regular',
        paddingVertical: 0,
        height: RF(40),
    },
    clearButton: {
        padding: RF(4),
    },
    clearIcon: {
        width: RF(16),
        height: RF(16),
        tintColor: '#999',
    },
    resultsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: RF(16),
        paddingBottom: RF(12),
    },
    resultsText: {
        fontSize: RF(14),
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    filterResultsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        backgroundColor: '#E8F5E9',
        borderRadius: RF(16),
    },
    filterResultsText: {
        fontSize: RF(12),
        color: '#4CAD73',
        fontFamily: 'Poppins-Medium',
        marginRight: RF(4),
    },
    filterResultsIcon: {
        width: RF(14),
        height: RF(14),
        tintColor: '#4CAD73',
    },
    productsGrid: {
        paddingHorizontal: RF(10),
        paddingTop: RF(10),
        flexGrow: 1,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: RF(10),
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: RF(8),
        padding: RF(10),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
        position: 'relative',
    },
    wishlistButton: {
        position: 'absolute',
        top: RF(6),
        right: RF(6),
        width: RF(30),
        height: RF(30),
        borderRadius: RF(15),
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    wishlistIcon: {
        width: RF(16),
        height: RF(16),
    },
    productImageContainer: {
        width: '100%',
        borderRadius: RF(6),
        marginBottom: RF(8),
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    productImage: {
        width: '90%',
        height: '90%',
    },
    outOfStockImage: {
        opacity: 0.5,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
        marginBottom: RF(4),
        lineHeight: RF(16),
        minHeight: RF(32),
    },
    stockInfoContainer: {
        marginBottom: RF(4),
    },
    stockInfoText: {
        fontSize: RF(10),
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    priceContainer: {
        marginBottom: RF(4),
    },
    productPrice: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
    },
    discountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: RF(2),
    },
    originalPrice: {
        fontSize: RF(10),
        fontFamily: 'Poppins-Regular',
        color: '#999',
        textDecorationLine: 'line-through',
        marginRight: RF(4),
    },
    discountBadge: {
        fontSize: RF(9),
        fontFamily: 'Poppins-SemiBold',
        color: '#EC0505',
        backgroundColor: '#FFE8E8',
        paddingHorizontal: RF(4),
        paddingVertical: RF(1),
        borderRadius: RF(3),
    },
    businessMinQty: {
        fontSize: RF(9),
        fontFamily: 'Poppins-Regular',
        color: '#FF6B35',
        marginTop: RF(1),
    },
    quantityContainer: {
        marginTop: 'auto',
        paddingTop: RF(6),
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        borderRadius: RF(6),
        paddingHorizontal: RF(6),
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    quantityButton: {
        padding: RF(4),
    },
    quantityButtonText: {
        fontSize: RF(14),
        color: '#666',
        fontWeight: 'bold',
    },
    quantityButtonDisabled: {
        color: '#CCC',
    },
    quantityText: {
        fontSize: RF(12),
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: RF(8),
    },
    addButton: {
        borderWidth: 1,
        borderColor: '#27AF34',
        borderRadius: RF(4),
        paddingVertical: RF(5),
        paddingHorizontal: RF(10),
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-SemiBold',
        color: '#27AF34',
    },
    addButtonDisabled: {
        backgroundColor: '#F0F0F0',
        borderColor: '#CCC',
    },
    outOfStockButtonText: {
        color: '#999',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        fontSize: RF(16),
        fontFamily: 'Poppins-Medium',
        color: '#666',
        marginTop: RF(10),
    },
    listHeaderText: {
        fontSize: RF(11),
        color: '#666',
        fontFamily: 'Poppins-Regular',
        marginLeft: RF(5),
        marginBottom: RF(8),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: RF(40),
    },
    emptyIcon: {
        width: RF(80),
        height: RF(80),
        marginBottom: RF(16),
        opacity: 0.5,
    },
    emptyText: {
        fontSize: RF(16),
        fontFamily: 'Poppins-SemiBold',
        color: '#666',
        marginBottom: RF(8),
    },
    emptySubtext: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Regular',
        color: '#999',
        marginBottom: RF(16),
        textAlign: 'center',
        paddingHorizontal: RF(40),
    },
    resetEmptyButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(20),
        paddingVertical: RF(10),
        borderRadius: RF(8),
    },
    resetEmptyButtonText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        width: '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: RF(20),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: RF(16),
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
    },
    closeIcon: {
        width: RF(20),
        height: RF(20),
        tintColor: '#666',
    },
    filterContent: {
        padding: RF(20),
        maxHeight: screenHeight * 0.6,
    },
    filterSection: {
        marginBottom: RF(20),
    },
    filterSectionTitle: {
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: RF(10),
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: RF(6),
    },
    radioButton: {
        width: RF(18),
        height: RF(18),
        borderRadius: RF(9),
        borderWidth: 2,
        borderColor: '#DDD',
        marginRight: RF(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioSelected: {
        width: RF(9),
        height: RF(9),
        borderRadius: RF(4.5),
        backgroundColor: '#4CAD73',
    },
    filterOptionText: {
        fontSize: RF(13),
        fontFamily: 'Poppins-Regular',
        color: '#333',
    },
    priceRangeText: {
        fontSize: RF(13),
        fontFamily: 'Poppins-Medium',
        color: '#666',
        textAlign: 'center',
        marginVertical: RF(6),
    },
    sliderContainer: {
        marginVertical: RF(12),
    },
    slider: {
        width: '100%',
        height: RF(30),
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: RF(2),
    },
    sliderLabel: {
        fontSize: RF(11),
        color: '#666',
        fontFamily: 'Poppins-Regular',
    },
    priceInputsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: RF(12),
    },
    priceInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginHorizontal: RF(4),
    },
    priceLabel: {
        fontSize: RF(13),
        color: '#666',
        marginRight: RF(6),
        fontFamily: 'Poppins-Medium',
    },
    priceInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: RF(6),
        padding: RF(6),
        fontSize: RF(12),
        textAlign: 'center',
        color: '#333',
        minHeight: RF(35),
    },
    outOfStockBadge: {
        position: 'absolute',
        top: RF(6),
        left: RF(6),
        backgroundColor: '#FF3B30',
        paddingHorizontal: RF(6),
        paddingVertical: RF(2),
        borderRadius: RF(3),
        zIndex: 2,
    },
    outOfStockText: {
        color: '#FF3B30',
        fontSize: RF(8),
        fontFamily: 'Poppins-Bold',
    },
    lowStockBadge: {
        position: 'absolute',
        top: RF(6),
        left: RF(50),
        backgroundColor: '#FF9500',
        paddingHorizontal: RF(6),
        paddingVertical: RF(2),
        borderRadius: RF(3),
        zIndex: 2,
    },
    lowStockText: {
        color: '#FFFFFF',
        fontSize: RF(8),
        fontFamily: 'Poppins-Bold',
    },
    minQtyBadge: {
        position: 'absolute',
        top: RF(40),
        right: RF(6),
        backgroundColor: '#FF6B35',
        paddingHorizontal: RF(5),
        paddingVertical: RF(2),
        borderRadius: RF(3),
        zIndex: 1,
    },
    minQtyText: {
        color: '#FFFFFF',
        fontSize: RF(8),
        fontFamily: 'Poppins-Bold',
    },
});
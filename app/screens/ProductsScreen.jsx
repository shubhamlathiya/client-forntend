import AsyncStorage from '@react-native-async-storage/async-storage';
import {useLocalSearchParams, useRouter} from "expo-router";
import {useEffect, useState, useCallback} from "react";
import {
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    ToastAndroid,
    Pressable,
    View,
    Modal,
    FlatList,
    SafeAreaView,
    ActivityIndicator,
    StatusBar
} from "react-native";
import {addCartItem, getCart, removeCartItem, updateCartItem} from '../../api/cartApi';
import {getProducts, getCategories, toggleWishlist, checkWishlist} from '../../api/catalogApi';
import {API_BASE_URL} from '../../config/apiConfig';
import { useFocusEffect } from '@react-navigation/native';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

// Check device type and safe areas
const isIOS = Platform.OS === 'ios';
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;
const isSmallPhone = screenWidth <= 375;

// Get status bar height
const statusBarHeight = Platform.select({
    ios: isIOS ? (screenHeight >= 812 ? 44 : 20) : 0,
    android: StatusBar.currentHeight || 24,
});

// Get bottom safe area (for iPhone X and above)
const bottomSafeArea = isIOS ? (screenHeight >= 812 ? 34 : 0) : 0;

// Responsive size calculator
const responsiveSize = (size) => {
    const baseWidth = 375; // iPhone 6/7/8 width
    const scale = screenWidth / baseWidth;
    const scaledSize = size * scale;

    // Ensure minimum readable size
    if (size <= 10) return Math.max(size, Math.round(scaledSize));
    return Math.round(scaledSize);
};

// Responsive width percentage
const responsiveWidth = (percentage) => {
    return (screenWidth * percentage) / 100;
};

// Responsive height percentage (excluding status bar and safe areas)
const responsiveHeight = (percentage) => {
    const availableHeight = screenHeight - statusBarHeight - bottomSafeArea;
    return (availableHeight * percentage) / 100;
};

export default function ProductsScreen() {
    const router = useRouter();
    const {selectedCategory, searchQuery} = useLocalSearchParams();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({});
    const [loginType, setLoginType] = useState('individual');
    const [activeCategory, setActiveCategory] = useState(null);
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);
    const [updatingItems, setUpdatingItems] = useState({});
    const [wishlistItems, setWishlistItems] = useState({});
    const [wishlistUpdating, setWishlistUpdating] = useState({});
    const [orientation, setOrientation] = useState(
        screenWidth > screenHeight ? 'landscape' : 'portrait'
    );

    // Handle orientation changes
    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            const newOrientation = window.width > window.height ? 'landscape' : 'portrait';
            setOrientation(newOrientation);
        });

        return () => subscription?.remove();
    }, []);

    // Auto refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadCartItems();
        }, [])
    );

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setLoading(true);

                const categoryId = typeof selectedCategory === "string"
                    ? selectedCategory
                    : selectedCategory?._id || selectedCategory?.id || null;

                const requests = [
                    getProducts({categoryId}),
                    getCategories(),
                    loadCartItems()
                ];

                const [productsRes, categoriesRes, cartRes] = await Promise.all(requests);

                let items = [];
                if (productsRes?.success) {
                    if (productsRes.data?.data?.items) {
                        items = productsRes.data.data.items;
                    } else if (productsRes.data?.items) {
                        items = productsRes.data.items;
                    } else if (Array.isArray(productsRes.data)) {
                        items = productsRes.data;
                    }
                } else if (Array.isArray(productsRes)) {
                    items = productsRes;
                }

                let categoriesList = [];
                if (categoriesRes?.success) {
                    if (categoriesRes.data?.data) {
                        categoriesList = categoriesRes.data.data;
                    } else if (Array.isArray(categoriesRes.data)) {
                        categoriesList = categoriesRes.data;
                    } else if (categoriesRes.data?.items) {
                        categoriesList = categoriesRes.data.items;
                    }
                } else if (Array.isArray(categoriesRes)) {
                    categoriesList = categoriesRes;
                }

                if (mounted) {
                    setProducts(items);
                    setFilteredProducts(items);
                    setCategories(categoriesList);

                    if (categoriesList.length > 0) {
                        setActiveCategory(categoriesList[0]);
                    }

                    initializeWishlistStatus(items);
                }
            } catch (e) {
                if (mounted) {
                    setProducts([]);
                    setFilteredProducts([]);
                    setCategories([]);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            mounted = false;
        };
    }, [selectedCategory]);

    const initializeWishlistStatus = async (productsList) => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            const user = userData ? JSON.parse(userData) : null;
            const userId = user?._id || user?.id || user?.userId || null;

            if (!userId) return;

            const wishlistStatus = {};
            const productIds = productsList.map(product => String(getProductId(product))).filter(Boolean);

            for (const productId of productIds) {
                try {
                    const res = await checkWishlist(userId, productId);
                    const isInWishlist = Boolean(
                        res?.liked ??
                        res?.data?.liked ??
                        res?.inWishlist ??
                        res?.data?.inWishlist ??
                        false
                    );
                    wishlistStatus[productId] = isInWishlist;
                } catch (error) {
                    wishlistStatus[productId] = false;
                }
            }

            setWishlistItems(wishlistStatus);
        } catch (error) {
            console.log('Error initializing wishlist:', error);
        }
    };

    const toggleWishlistForProduct = async (productId) => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            const user = userData ? JSON.parse(userData) : null;
            const userId = user?._id || user?.id || user?.userId || null;

            if (!userId) {
                router.push('/screens/LoginScreen');
                return;
            }

            setWishlistUpdating(prev => ({ ...prev, [productId]: true }));
            const res = await toggleWishlist(userId, String(productId));

            const newWishlistState = Boolean(
                res?.liked ??
                res?.data?.liked ??
                res?.inWishlist ??
                res?.data?.inWishlist ??
                !wishlistItems[productId]
            );

            setWishlistItems(prev => ({
                ...prev,
                [productId]: newWishlistState
            }));
            //
            // if (Platform.OS === 'android') {
            //     ToastAndroid.show(
            //         newWishlistState ? 'Added to wishlist' : 'Removed from wishlist',
            //         ToastAndroid.SHORT
            //     );
            // }
        } catch (error) {
            Alert.alert('Error', 'Failed to update wishlist. Please try again.');
        } finally {
            setWishlistUpdating(prev => ({ ...prev, [productId]: false }));
        }
    };

    useEffect(() => {
        let filtered = [...products];

        if (activeCategory) {
            filtered = filtered.filter(product => {
                const matchesCategory =
                    product.categoryIds?.includes(activeCategory._id) ||
                    product.categoryId === activeCategory._id ||
                    product.category?._id === activeCategory._id ||
                    (Array.isArray(product.categoryIds) &&
                        product.categoryIds.some(cat =>
                            cat?._id === activeCategory._id || cat === activeCategory._id
                        ));

                return matchesCategory;
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(product =>
                product.title?.toLowerCase().includes(query) ||
                product.name?.toLowerCase().includes(query) ||
                product.description?.toLowerCase().includes(query) ||
                product.brandId?.name?.toLowerCase().includes(query) ||
                product.sku?.toLowerCase().includes(query)
            );
        }

        setFilteredProducts(filtered);
    }, [activeCategory, searchQuery, products]);

    const loadCartItems = async () => {
        try {
            const cartData = await getCart();
            let items = [];

            if (cartData?.success) {
                if (cartData.data?.items) {
                    items = cartData.data.items;
                } else if (Array.isArray(cartData.data)) {
                    items = cartData.data;
                }
            } else if (Array.isArray(cartData)) {
                items = cartData;
            }

            setCartItems(items);
            return cartData;
        } catch (error) {
            setCartItems([]);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const lt = await AsyncStorage.getItem('loginType');
                if (lt) {
                    setLoginType(lt);
                }
            } catch (error) {
                console.log('Error loading login type:', error);
            }
        })();
    }, []);

    function handleProductClick(id) {
        router.replace({pathname: "/screens/ProductDetailScreen", params: {id: String(id)}});
    }

    function getProductId(item) {
        return item?.id || item?._id || item?.productId;
    }

    const getCartItemId = (productId, variantId = null) => {
        const cartItem = cartItems.find(item =>
            item.productId === String(productId) &&
            item.variantId === (variantId ? String(variantId) : null)
        );
        return cartItem?._id || cartItem?.id;
    };

    function computeProductPrice(item) {
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        const firstVariant = variants[0];

        let base = 0;
        let final = 0;
        let hasDiscount = false;
        let discountPercent = 0;

        if (firstVariant) {
            base = Number(firstVariant?.basePrice ?? firstVariant?.price ?? 0);
            final = Number(firstVariant?.finalPrice ?? firstVariant?.price ?? base);
        } else {
            base = Number(item?.basePrice ?? item?.price ?? 0);
            final = Number(item?.finalPrice ?? item?.price ?? base);
        }

        if (item?.discount?.type === 'percent' && item.discount.value > 0) {
            discountPercent = Number(item.discount.value);
            final = base - (base * discountPercent / 100);
            hasDiscount = true;
        } else if (base > final) {
            discountPercent = Math.round(((base - final) / base) * 100);
            hasDiscount = discountPercent > 0;
        }

        return {base, final, hasDiscount, discountPercent};
    }

    const getCartQuantity = (productId, variantId = null) => {
        const item = cartItems.find(cartItem =>
            cartItem.productId === String(productId) &&
            cartItem.variantId === (variantId ? String(variantId) : null)
        );
        return item ? item.quantity : 0;
    };

    const handleAddToCart = async (item, variant = null) => {
        try {
            const productId = getProductId(item);
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const selectedVariantId = variant ? String(variant._id || variant.id) : selectedVariants[String(productId)];
            const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
            const effectiveVariantId = selectedVariantId || (defaultVariant ? String(defaultVariant?._id || defaultVariant?.id || defaultVariant?.variantId) : null);

            const payload = {
                productId: String(productId),
                quantity: 1,
                variantId: effectiveVariantId ? String(effectiveVariantId) : null,
            };

            const tempId = `${productId}_${effectiveVariantId || 'default'}`;
            setUpdatingItems(prev => ({ ...prev, [tempId]: true }));

            await addCartItem(payload);
            await loadCartItems();

            if (Platform.OS === 'android') {
                ToastAndroid.show('Added to cart', ToastAndroid.SHORT);
            }

            if (variant) {
                setShowVariantModal(false);
                setSelectedProductForVariant(null);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to add item to cart');
        } finally {
            const productId = getProductId(item);
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
            const effectiveVariantId = variant ? String(variant._id || variant.id) : selectedVariants[String(productId)] || (defaultVariant ? String(defaultVariant?._id || defaultVariant?.id || defaultVariant?.variantId) : null);
            const tempId = `${productId}_${effectiveVariantId || 'default'}`;

            setUpdatingItems(prev => ({ ...prev, [tempId]: false }));
        }
    };

    const handleUpdateQuantity = async (productId, variantId, newQuantity) => {
        try {
            const itemId = getCartItemId(productId, variantId);

            if (!itemId) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            const tempId = `${productId}_${variantId || 'default'}`;
            setUpdatingItems(prev => ({ ...prev, [tempId]: true }));

            if (newQuantity === 0) {
                await removeCartItem(productId, variantId);
            } else {
                await updateCartItem(itemId, newQuantity);
            }

            await loadCartItems();
        } catch (error) {
            Alert.alert('Error', 'Failed to update quantity');
        } finally {
            const tempId = `${productId}_${variantId || 'default'}`;
            setUpdatingItems(prev => ({ ...prev, [tempId]: false }));
        }
    };

    const handleVariantSelect = (product) => {
        setSelectedProductForVariant(product);
        setShowVariantModal(true);
    };

    const closeVariantModal = () => {
        setShowVariantModal(false);
        setSelectedProductForVariant(null);
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    // Dynamic column calculation based on screen size and orientation
    const getProductColumns = () => {
        if (orientation === 'landscape') {
            if (screenWidth >= 1200) return 4;
            if (screenWidth >= 1024) return 3;
            if (screenWidth >= 768) return 2;
            return 2;
        } else {
            if (screenWidth >= 1024) return 3; // Large tablets
            if (screenWidth >= 768) return 3;  // Tablets
            if (screenWidth >= 414) return 2;  // Large phones
            return 2; // Small phones
        }
    };

    const productColumns = getProductColumns();

    // Calculate dynamic widths based on orientation
    const leftColumnWidth = orientation === 'landscape' ?
        (isTablet ? responsiveWidth(20) : responsiveWidth(25)) :
        (isTablet ? responsiveWidth(25) : responsiveWidth(30));

    const renderProductItem = ({item}) => {
        const productId = getProductId(item);
        const productPrice = computeProductPrice(item);
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        const showDiscount = productPrice.hasDiscount;
        const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
        const selectedVariantId = selectedVariants[String(productId)];
        const selectedVariantObj = variants.find(v => String(v?._id || v?.id) === String(selectedVariantId)) || defaultVariant;
        const displayFinalPrice = selectedVariantObj
            ? computeVariantPrice(selectedVariantObj, item).final
            : productPrice.final;

        const isOutOfStock = selectedVariantObj ? (selectedVariantObj?.stock === 0) : (item?.stock === 0);
        const cartQuantity = getCartQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id);
        const hasMultipleVariants = variants.length > 1;
        const tempId = `${productId}_${selectedVariantObj?._id || selectedVariantObj?.id || 'default'}`;
        const isUpdating = updatingItems[tempId];
        const isInWishlist = wishlistItems[String(productId)] || false;
        const isWishlistUpdating = wishlistUpdating[String(productId)] || false;

        // Dynamic card width calculation
        const cardSpacing = responsiveSize(12);
        const availableWidth = screenWidth - leftColumnWidth - cardSpacing;
        const cardWidth = (availableWidth / productColumns) - cardSpacing;
        const imageHeight = responsiveHeight(orientation === 'landscape' ? 20 : 15);

        return (
            <View style={[
                styles.productCard,
                {
                    width: cardWidth,
                    margin: responsiveSize(6),
                    padding: responsiveSize(8),
                }
            ]}>
                <Pressable onPress={() => handleProductClick(productId)} activeOpacity={0.7}>
                    <View style={[
                        styles.imageContainer,
                        {
                            height: imageHeight,
                            borderRadius: responsiveSize(8)
                        }
                    ]}>
                        <Pressable
                            style={[
                                styles.wishlistButton,
                                {
                                    width: responsiveSize(32),
                                    height: responsiveSize(32),
                                    borderRadius: responsiveSize(16),
                                }
                            ]}
                            onPress={(e) => {
                                e.stopPropagation();
                                toggleWishlistForProduct(productId);
                            }}
                            disabled={isWishlistUpdating}
                        >
                            {isWishlistUpdating ? (
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
                                            width: responsiveSize(16),
                                            height: responsiveSize(16),
                                        }
                                    ]}
                                    resizeMode="contain"
                                />
                            )}
                        </Pressable>

                        <Image
                            style={styles.image}
                            source={item?.thumbnail ?
                                {uri: `${API_BASE_URL}${item.thumbnail}`} :
                                require("../../assets/icons/fruit.png")}
                            defaultSource={require("../../assets/icons/fruit.png")}
                        />
                    </View>

                    <View style={styles.content}>
                        <Text style={[
                            styles.productName,
                            {
                                fontSize: responsiveSize(isTablet ? 14 : 12),
                                lineHeight: responsiveSize(isTablet ? 18 : 16)
                            }
                        ]} numberOfLines={2}>
                            {item?.title || item?.name}
                        </Text>

                        {selectedVariantObj && (
                            <Text style={[
                                styles.variantText,
                                { fontSize: responsiveSize(10) }
                            ]} numberOfLines={1}>
                                {selectedVariantObj?.name || selectedVariantObj?.sku || 'Default'}
                            </Text>
                        )}

                        <View style={styles.priceRow}>
                            {showDiscount ? (
                                <View style={styles.discountContainer}>
                                    <Text style={[
                                        styles.oldPrice,
                                        { fontSize: responsiveSize(11) }
                                    ]}>
                                        ₹{Number(productPrice.base).toFixed(2)}
                                    </Text>
                                    <Text style={[
                                        styles.newPrice,
                                        { fontSize: responsiveSize(isTablet ? 16 : 14) }
                                    ]}>
                                        ₹{Number(displayFinalPrice || 0).toFixed(2)}
                                    </Text>
                                    <Text style={[
                                        styles.discountPercent,
                                        {
                                            fontSize: responsiveSize(10),
                                            paddingHorizontal: responsiveSize(4),
                                            paddingVertical: responsiveSize(2),
                                        }
                                    ]}>
                                        {productPrice.discountPercent}% OFF
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[
                                    styles.newPrice,
                                    { fontSize: responsiveSize(isTablet ? 16 : 14) }
                                ]}>
                                    ₹{Number(displayFinalPrice || 0).toFixed(2)}
                                </Text>
                            )}
                        </View>
                    </View>
                </Pressable>

                <View style={styles.actionContainer}>
                    {cartQuantity > 0 ? (
                        <View style={[
                            styles.quantityControl,
                            {
                                borderRadius: responsiveSize(20),
                                paddingHorizontal: responsiveSize(8),
                                paddingVertical: responsiveSize(6),
                            }
                        ]}>
                            <Pressable
                                style={styles.quantityButton}
                                onPress={() => handleUpdateQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id, cartQuantity - 1)}
                                disabled={isUpdating}
                            >
                                <Text style={[
                                    styles.quantityMinus,
                                    { fontSize: responsiveSize(16) },
                                    isUpdating && styles.disabledText
                                ]}>-</Text>
                            </Pressable>

                            <Text style={[
                                styles.quantityText,
                                { fontSize: responsiveSize(14) }
                            ]}>
                                {isUpdating ? '...' : cartQuantity}
                            </Text>

                            <Pressable
                                style={styles.quantityButton}
                                onPress={() => handleUpdateQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id, cartQuantity + 1)}
                                disabled={isOutOfStock || isUpdating}
                            >
                                <Text style={[
                                    styles.quantityPlus,
                                    { fontSize: responsiveSize(16) },
                                    (isOutOfStock || isUpdating) && styles.disabledText
                                ]}>+</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            style={[
                                styles.addButton,
                                hasMultipleVariants && styles.variantButton,
                                (isOutOfStock || isUpdating) && styles.disabledButton,
                                {
                                    paddingVertical: responsiveSize(8),
                                    paddingHorizontal: responsiveSize(12),
                                    borderRadius: responsiveSize(8),
                                }
                            ]}
                            onPress={() => hasMultipleVariants ? handleVariantSelect(item) : handleAddToCart(item)}
                            disabled={isOutOfStock || isUpdating}
                        >
                            <Text style={[
                                styles.addButtonText,
                                { fontSize: responsiveSize(12) },
                                (isOutOfStock || isUpdating) && styles.disabledText
                            ]}>
                                {isUpdating ? '...' : (hasMultipleVariants ? 'Options' : 'ADD')}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    };

    function computeVariantPrice(variant, product) {
        let base = Number(variant?.basePrice ?? variant?.price ?? 0);
        let final = Number(variant?.finalPrice ?? variant?.price ?? base);
        let hasDiscount = false;

        if (product?.discount?.type === 'percent' && product.discount.value > 0 &&
            (!variant?.finalPrice && !variant?.basePrice)) {
            const discountPercent = Number(product.discount.value);
            final = base - (base * discountPercent / 100);
            hasDiscount = true;
        } else if (base > final) {
            hasDiscount = true;
        }

        return {base: Number(base), final: Number(final), hasDiscount};
    }

    const renderVariantItem = ({item: variant}) => {
        const priceInfo = computeVariantPrice(variant, selectedProductForVariant);
        const isOutOfStock = variant?.stock === 0;
        const cartQuantity = getCartQuantity(getProductId(selectedProductForVariant), variant._id || variant.id);
        const tempId = `${getProductId(selectedProductForVariant)}_${variant._id || variant.id}`;
        const isUpdating = updatingItems[tempId];

        return (
            <View style={[
                styles.variantCard,
                isOutOfStock && styles.disabledVariant,
                {
                    padding: responsiveSize(16),
                    borderRadius: responsiveSize(12),
                    marginBottom: responsiveSize(12),
                }
            ]}>
                <View style={styles.variantInfo}>
                    <Text style={[
                        styles.variantName,
                        { fontSize: responsiveSize(14) }
                    ]}>
                        {variant?.name || variant?.sku || 'Variant'}
                    </Text>
                    <Text style={[
                        styles.variantPrice,
                        { fontSize: responsiveSize(16) }
                    ]}>
                        ₹{priceInfo.final.toFixed(2)}
                    </Text>
                    <Text style={[
                        styles.variantStock,
                        { fontSize: responsiveSize(12) }
                    ]}>
                        {isOutOfStock ? 'Out of Stock' : `Stock: ${variant?.stock ?? 'Available'}`}
                    </Text>
                </View>

                {cartQuantity > 0 ? (
                    <View style={[
                        styles.variantQuantityControl,
                        {
                            borderRadius: responsiveSize(20),
                            paddingHorizontal: responsiveSize(8),
                            paddingVertical: responsiveSize(6),
                        }
                    ]}>
                        <Pressable
                            style={styles.variantQuantityButton}
                            onPress={() => handleUpdateQuantity(getProductId(selectedProductForVariant), variant._id || variant.id, cartQuantity - 1)}
                            disabled={isUpdating}
                        >
                            <Text style={[
                                styles.variantQuantityText,
                                { fontSize: responsiveSize(16) },
                                isUpdating && styles.disabledText
                            ]}>-</Text>
                        </Pressable>
                        <Text style={[
                            styles.variantQuantity,
                            { fontSize: responsiveSize(14) }
                        ]}>
                            {isUpdating ? '...' : cartQuantity}
                        </Text>
                        <Pressable
                            style={styles.variantQuantityButton}
                            onPress={() => handleUpdateQuantity(getProductId(selectedProductForVariant), variant._id || variant.id, cartQuantity + 1)}
                            disabled={isOutOfStock || isUpdating}
                        >
                            <Text style={[
                                styles.variantQuantityText,
                                { fontSize: responsiveSize(16) },
                                (isOutOfStock || isUpdating) && styles.disabledText
                            ]}>+</Text>
                        </Pressable>
                    </View>
                ) : (
                    <Pressable
                        style={[
                            styles.variantAddButton,
                            (isOutOfStock || isUpdating) && styles.disabledButton,
                            {
                                paddingVertical: responsiveSize(8),
                                paddingHorizontal: responsiveSize(16),
                                borderRadius: responsiveSize(8),
                            }
                        ]}
                        onPress={() => handleAddToCart(selectedProductForVariant, variant)}
                        disabled={isOutOfStock || isUpdating}
                    >
                        <Text style={[
                            styles.variantAddText,
                            { fontSize: responsiveSize(12) },
                            (isOutOfStock || isUpdating) && styles.disabledText
                        ]}>
                            {isUpdating ? '...' : 'ADD'}
                        </Text>
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar
                backgroundColor="#4CAD73"
                barStyle="light-content"
                translucent={false}
            />

            {/* HEADER - Properly positioned below status bar */}
            <View style={[
                styles.header,
                {
                    paddingTop: statusBarHeight,
                    height: statusBarHeight + responsiveSize(60),
                    paddingHorizontal: responsiveSize(16),
                }
            ]}>
                <Pressable
                    onPress={handleBack}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={[
                            styles.backIcon,
                            {
                                width: responsiveSize(24),
                                height: responsiveSize(24),
                            }
                        ]}
                        resizeMode="contain"
                    />
                </Pressable>

                <Text style={[
                    styles.headerTitle,
                    { fontSize: responsiveSize(isTablet ? 20 : 18) }
                ]}>
                    {activeCategory ? activeCategory.name : 'All Categories'}
                </Text>

                <View style={styles.headerSpacer} />
            </View>

            {/* MAIN CONTENT - Properly positioned below header */}
            <View style={styles.mainContent}>
                {/* TWO COLUMN LAYOUT */}
                <View style={styles.twoColumnLayout}>
                    {/* LEFT COLUMN - CATEGORIES */}
                    <View style={[
                        styles.leftColumn,
                        { width: leftColumnWidth }
                    ]}>
                        <ScrollView
                            style={styles.categoriesList}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.categoriesContent}
                        >
                            {categories.map((category) => {
                                const url = category?.image || category?.icon;
                                const imageSource = url ?
                                    {uri: `${API_BASE_URL}${url}`} :
                                    require("../../assets/images/gifts.png");

                                return (
                                    <Pressable
                                        key={category._id || category.id}
                                        style={[
                                            styles.categoryItem,
                                            activeCategory?._id === category._id && styles.activeCategoryItem,
                                            {
                                                paddingVertical: responsiveSize(16),
                                                paddingHorizontal: responsiveSize(12),
                                            }
                                        ]}
                                        onPress={() => setActiveCategory(category)}
                                    >
                                        <View style={styles.categoryContent}>
                                            <Image
                                                source={imageSource}
                                                style={[
                                                    styles.categoryImage,
                                                    {
                                                        width: responsiveSize(40),
                                                        height: responsiveSize(40),
                                                        borderRadius: responsiveSize(20),
                                                        marginBottom: responsiveSize(8),
                                                    }
                                                ]}
                                                resizeMode="cover"
                                                defaultSource={require("../../assets/images/gifts.png")}
                                            />
                                            <Text
                                                style={[
                                                    styles.categoryName,
                                                    activeCategory?._id === category._id && styles.activeCategoryName,
                                                    {
                                                        fontSize: responsiveSize(11),
                                                        lineHeight: responsiveSize(14),
                                                    }
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {category.name}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* RIGHT COLUMN - PRODUCTS */}
                    <View style={styles.rightColumn}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#4CAD73" />
                                <Text style={[
                                    styles.loadingText,
                                    { fontSize: responsiveSize(14), marginTop: responsiveSize(20) }
                                ]}>
                                    Loading products…
                                </Text>
                            </View>
                        ) : filteredProducts.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Image
                                    source={require('../../assets/icons/empty-box.png')}
                                    style={{
                                        width: responsiveWidth(40),
                                        height: responsiveWidth(40),
                                        marginBottom: responsiveSize(20),
                                    }}
                                    resizeMode="contain"
                                />
                                <Text style={[
                                    styles.emptyText,
                                    { fontSize: responsiveSize(16) }
                                ]}>
                                    No products found
                                </Text>
                                <Text style={[
                                    styles.emptySubtext,
                                    { fontSize: responsiveSize(14) }
                                ]}>
                                    {activeCategory || searchQuery
                                        ? 'Try changing your filters or search term'
                                        : 'No products available at the moment'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredProducts}
                                renderItem={renderProductItem}
                                keyExtractor={(item) => getProductId(item)}
                                numColumns={productColumns}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={[
                                    styles.productsGrid,
                                    { paddingBottom: bottomSafeArea + responsiveSize(20) }
                                ]}
                                key={`product-grid-${productColumns}-${orientation}`}
                                removeClippedSubviews={true}
                                initialNumToRender={6}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                            />
                        )}
                    </View>
                </View>
            </View>

            {/* VARIANT SELECTION MODAL */}
            <Modal
                visible={showVariantModal}
                animationType="slide"
                transparent={true}
                statusBarTranslucent={true}
                onRequestClose={closeVariantModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={[
                        styles.modalContainer,
                        {
                            height: responsiveHeight(80) + bottomSafeArea,
                            borderTopLeftRadius: responsiveSize(20),
                            borderTopRightRadius: responsiveSize(20),
                        }
                    ]}>
                        <SafeAreaView style={styles.modalContent}>
                            <View style={[
                                styles.modalHeader,
                                {
                                    paddingHorizontal: responsiveSize(20),
                                    paddingVertical: responsiveSize(16),
                                    paddingTop: statusBarHeight,
                                }
                            ]}>
                                <Text style={[
                                    styles.modalTitle,
                                    { fontSize: responsiveSize(18) }
                                ]}>
                                    Select Variant
                                </Text>
                                <Pressable
                                    onPress={closeVariantModal}
                                    style={[
                                        styles.closeButton,
                                        { padding: responsiveSize(8) }
                                    ]}
                                >
                                    <Image
                                        source={require("../../assets/icons/deleteIcon.png")}
                                        style={[
                                            styles.closeIcon,
                                            {
                                                width: responsiveSize(20),
                                                height: responsiveSize(20),
                                            }
                                        ]}
                                        resizeMode="contain"
                                    />
                                </Pressable>
                            </View>

                            {selectedProductForVariant && (
                                <View style={[
                                    styles.productHeader,
                                    {
                                        padding: responsiveSize(16),
                                    }
                                ]}>
                                    <Image
                                        source={selectedProductForVariant?.thumbnail ?
                                            {uri: `${API_BASE_URL}${selectedProductForVariant.thumbnail}`} :
                                            require("../../assets/icons/fruit.png")}
                                        style={[
                                            styles.productHeaderImage,
                                            {
                                                width: responsiveSize(60),
                                                height: responsiveSize(60),
                                                borderRadius: responsiveSize(8),
                                                marginRight: responsiveSize(12),
                                            }
                                        ]}
                                        defaultSource={require("../../assets/icons/fruit.png")}
                                    />
                                    <View style={styles.productHeaderInfo}>
                                        <Text style={[
                                            styles.productHeaderName,
                                            { fontSize: responsiveSize(16) }
                                        ]} numberOfLines={2}>
                                            {selectedProductForVariant?.title || selectedProductForVariant?.name}
                                        </Text>
                                        <Text style={[
                                            styles.productHeaderPrice,
                                            { fontSize: responsiveSize(14) }
                                        ]}>
                                            Starts from ₹{computeProductPrice(selectedProductForVariant).final.toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <FlatList
                                data={selectedProductForVariant?.variants || []}
                                renderItem={renderVariantItem}
                                keyExtractor={(variant) => variant._id || variant.id || Math.random().toString()}
                                style={styles.variantsList}
                                contentContainerStyle={[
                                    styles.variantsContent,
                                    {
                                        padding: responsiveSize(16),
                                        paddingBottom: bottomSafeArea + responsiveSize(20)
                                    }
                                ]}
                            />
                        </SafeAreaView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        backgroundColor: '#4CAD73',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    backButton: {
        justifyContent: 'center',
        alignItems: 'center',
        width: responsiveSize(40),
        height: responsiveSize(40),
    },
    backIcon: {
        tintColor: '#FFFFFF',
    },
    headerTitle: {
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        flex: 1,
    },
    headerSpacer: {
        width: responsiveSize(40),
    },
    mainContent: {
        flex: 1,
        marginTop: responsiveSize(90), // Header height
        backgroundColor: '#FFFFFF',
    },
    twoColumnLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    leftColumn: {
        backgroundColor: '#F8F9FA',
        borderRightWidth: 1,
        borderRightColor: '#E8E8E8',
    },
    categoriesList: {
        flex: 1,
    },
    categoriesContent: {
        paddingBottom: responsiveSize(20),
    },
    categoryItem: {
        borderBottomColor: '#4CAD73',
        backgroundColor: '#FFFFFF',
    },
    activeCategoryItem: {
        borderRightWidth: 4,
        borderRightColor: '#4CAD73',
    },
    categoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryImage: {
        backgroundColor: '#F5F5F5',
    },
    categoryName: {
        color: '#666',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
    },
    activeCategoryName: {
        color: '#4CAD73',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    rightColumn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    productsGrid: {
        paddingHorizontal: responsiveSize(8),
        paddingTop: responsiveSize(8),
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: responsiveSize(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    imageContainer: {
        overflow: 'hidden',
        marginBottom: responsiveSize(8),
        backgroundColor: '#F8F9FA',
        position: 'relative',
    },
    wishlistButton: {
        position: 'absolute',
        top: responsiveSize(8),
        right: responsiveSize(8),
        zIndex: 10,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    wishlistIcon: {
        // Tint color handled by image source
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    content: {
        marginBottom: responsiveSize(12),
    },
    productName: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: responsiveSize(4),
    },
    variantText: {
        color: '#666',
        fontFamily: 'Poppins',
        marginBottom: responsiveSize(6),
    },
    priceRow: {
        marginBottom: responsiveSize(4),
    },
    discountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: responsiveSize(6),
        flexWrap: 'wrap',
    },
    oldPrice: {
        color: '#838383',
        textDecorationLine: 'line-through',
        fontFamily: 'Poppins',
    },
    newPrice: {
        fontWeight: '700',
        color: '#1B1B1B',
        fontFamily: 'Poppins-Bold',
    },
    discountPercent: {
        color: '#EC0505',
        backgroundColor: '#FFE8E8',
        borderRadius: responsiveSize(4),
        fontFamily: 'Poppins-SemiBold',
    },
    actionContainer: {
        marginTop: 'auto',
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
    },
    quantityButton: {
        padding: responsiveSize(4),
    },
    quantityMinus: {
        color: '#666',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    quantityPlus: {
        color: '#171717',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    quantityText: {
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: responsiveSize(12),
        minWidth: responsiveSize(20),
        textAlign: 'center',
    },
    addButton: {
        backgroundColor: '#4CAD73',
        alignItems: 'center',
    },
    variantButton: {
        backgroundColor: '#FFA500',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    disabledButton: {
        backgroundColor: '#CCCCCC',
    },
    disabledText: {
        color: '#999999',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: responsiveSize(40),
    },
    loadingText: {
        fontFamily: 'Poppins',
        color: '#838383',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: responsiveSize(40),
    },
    emptyText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: responsiveSize(8),
    },
    emptySubtext: {
        fontFamily: 'Poppins',
        color: '#838383',
        textAlign: 'center',
        paddingHorizontal: responsiveSize(20),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    modalContent: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontWeight: '700',
        color: '#000000',
        fontFamily: 'Poppins-Bold',
    },
    closeButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: {
        tintColor: '#000000',
    },
    productHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    productHeaderImage: {
        backgroundColor: '#F5F5F5',
    },
    productHeaderInfo: {
        flex: 1,
    },
    productHeaderName: {
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: responsiveSize(4),
    },
    productHeaderPrice: {
        color: '#4CAD73',
        fontFamily: 'Poppins-SemiBold',
    },
    variantsList: {
        flex: 1,
    },
    variantsContent: {
        paddingBottom: responsiveSize(20),
    },
    variantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    disabledVariant: {
        opacity: 0.6,
    },
    variantInfo: {
        flex: 1,
    },
    variantName: {
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: responsiveSize(4),
    },
    variantPrice: {
        fontWeight: '700',
        color: '#4CAD73',
        fontFamily: 'Poppins-Bold',
        marginBottom: responsiveSize(4),
    },
    variantStock: {
        color: '#666',
        fontFamily: 'Poppins',
    },
    variantQuantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
    },
    variantQuantityButton: {
        padding: responsiveSize(4),
    },
    variantQuantityText: {
        color: '#666',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    variantQuantity: {
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: responsiveSize(12),
        minWidth: responsiveSize(20),
        textAlign: 'center',
    },
    variantAddButton: {
        backgroundColor: '#4CAD73',
    },
    variantAddText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
});
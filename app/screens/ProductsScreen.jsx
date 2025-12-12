import AsyncStorage from '@react-native-async-storage/async-storage';
import {useLocalSearchParams, useRouter} from "expo-router";
import {useEffect, useState, useCallback, useMemo} from "react";
import {
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
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
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from "react-native-safe-area-context";

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

export default function ProductsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {selectedCategory, categoryName, searchQuery} = useLocalSearchParams();
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
    const [userId, setUserId] = useState(null);
    const [selectedAttributes, setSelectedAttributes] = useState({});
    const [orientation, setOrientation] = useState(
        screenWidth > screenHeight ? 'landscape' : 'portrait'
    );
    const [displayImages, setDisplayImages] = useState({}); // Track images for each product

    const capitalizeWords = (text) => {
        if (!text || typeof text !== "string") return text;
        return text
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
    };

    const responsiveHeight = (percentage) => {
        const availableHeight = screenHeight - insets.top - insets.bottom;
        return (availableHeight * percentage) / 100;
    };

    const responsiveHeightWithInsets = (percentage) => {
        const availableHeight = screenHeight - insets.top - insets.bottom;
        return (availableHeight * percentage) / 100;
    };

    // Parse the selected category from params
    const parsedSelectedCategory = selectedCategory ?
        (typeof selectedCategory === 'string' ? selectedCategory : selectedCategory?._id) :
        null;

    // Load user info on mount
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    const user = JSON.parse(userData);
                    const uid = user?._id || user?.id || user?.userId || null;
                    setUserId(uid);
                    return uid;
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            }
            return null;
        };
        loadUserData();

        // Load login type
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

    // Handle orientation changes
    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({window}) => {
            const newOrientation = window.width > window.height ? 'landscape' : 'portrait';
            setOrientation(newOrientation);
        });

        return () => subscription?.remove();
    }, []);

    // Initialize selected attributes when variant modal opens
    useEffect(() => {
        if (showVariantModal && selectedProductForVariant) {
            const productId = getProductId(selectedProductForVariant);
            const variants = selectedProductForVariant?.variants || [];

            // Try to get current selection from cart
            const currentCartItem = cartItems.find(item =>
                item.productId === String(productId)
            );

            let initialAttributes = {};

            if (currentCartItem?.variantId) {
                // If item already in cart, use that variant's attributes
                const currentVariant = variants.find(v =>
                    String(v._id || v.id) === String(currentCartItem.variantId)
                );
                if (currentVariant?.attributes) {
                    currentVariant.attributes.forEach(attr => {
                        if (attr.name && attr.value) {
                            initialAttributes[attr.name] = attr.value;
                        }
                    });
                }
            } else {
                // Otherwise, select the first available variant
                const firstAvailableVariant = variants.find(v =>
                    isInStock(selectedProductForVariant, v)
                ) || variants[0];

                if (firstAvailableVariant?.attributes) {
                    firstAvailableVariant.attributes.forEach(attr => {
                        if (attr.name && attr.value) {
                            initialAttributes[attr.name] = attr.value;
                        }
                    });
                }
            }

            setSelectedAttributes(initialAttributes);
        }
    }, [showVariantModal, selectedProductForVariant]);

    // Get display image for a product based on selected variant
    const getDisplayImageForProduct = useCallback((productId, product, selectedVariant = null) => {
        if (!product) {
            return require("../../assets/icons/fruit.png");
        }

        // If variant is selected and has images
        if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) {
            const firstImage = selectedVariant.images[0];
            const imageUrl = typeof firstImage === 'string' ? firstImage : (firstImage?.url || firstImage?.path);
            if (imageUrl) {
                return { uri: `${API_BASE_URL}${imageUrl}` };
            }
        }

        // Fallback to product thumbnail
        if (product.thumbnail) {
            return { uri: `${API_BASE_URL}${product.thumbnail}` };
        }

        // Fallback to product images if available
        if (product.images && product.images.length > 0) {
            const firstImage = product.images[0];
            const imageUrl = typeof firstImage === 'string' ? firstImage : (firstImage?.url || firstImage?.path);
            if (imageUrl) {
                return { uri: `${API_BASE_URL}${imageUrl}` };
            }
        }

        // Default fallback
        return require("../../assets/icons/fruit.png");
    }, []);

    // Initialize products and variants
    useEffect(() => {
        if (products.length === 0) return;

        const newSelectedVariants = {};
        const newDisplayImages = {};

        products.forEach(product => {
            const productId = String(getProductId(product));
            const variants = product?.variants || [];

            if (variants.length > 0) {
                // Find first available variant
                const firstAvailableVariant = variants.find(v =>
                    isInStock(product, v)
                ) || variants[0];

                if (firstAvailableVariant) {
                    newSelectedVariants[productId] = String(firstAvailableVariant._id || firstAvailableVariant.id);
                    newDisplayImages[productId] = getDisplayImageForProduct(productId, product, firstAvailableVariant);
                }
            } else {
                // For products without variants
                newDisplayImages[productId] = getDisplayImageForProduct(productId, product, null);
            }
        });

        setSelectedVariants(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newSelectedVariants)) {
                return prev;
            }
            return newSelectedVariants;
        });

        setDisplayImages(prev => {
            const hasChanges = Object.keys(newDisplayImages).some(key => {
                const oldImage = prev[key];
                const newImage = newDisplayImages[key];
                if (typeof oldImage === 'object' && typeof newImage === 'object') {
                    return oldImage?.uri !== newImage?.uri;
                }
                return oldImage !== newImage;
            });
            return hasChanges ? { ...prev, ...newDisplayImages } : prev;
        });
    }, [products, getDisplayImageForProduct]);

    // Update display images when variants change
    useEffect(() => {
        if (Object.keys(selectedVariants).length === 0 || products.length === 0) return;

        const updatedImages = {};
        let hasChanges = false;

        Object.keys(selectedVariants).forEach(productId => {
            const product = products.find(p => String(getProductId(p)) === productId);
            if (product) {
                const selectedVariantId = selectedVariants[productId];
                const variant = product.variants?.find(v => String(v._id || v.id) === selectedVariantId);
                const newImage = getDisplayImageForProduct(productId, product, variant);
                const currentImage = displayImages[productId];

                // Compare images properly
                const isSameImage = (img1, img2) => {
                    if (img1 === img2) return true;
                    if (typeof img1 === 'object' && typeof img2 === 'object') {
                        return img1?.uri === img2?.uri;
                    }
                    return false;
                };

                if (!isSameImage(currentImage, newImage)) {
                    updatedImages[productId] = newImage;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            setDisplayImages(prev => ({ ...prev, ...updatedImages }));
        }
    }, [selectedVariants, products, getDisplayImageForProduct]);

    // Load cart items
    const loadCartItems = useCallback(async () => {
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

            setCartItems(prev => {
                if (JSON.stringify(prev) === JSON.stringify(items)) {
                    return prev;
                }
                return items;
            });
        } catch (error) {
            setCartItems([]);
        }
    }, []);

    // Initialize wishlist status
    const initializeWishlistStatus = useCallback(async (productsList) => {
        try {
            if (!userId || !productsList || productsList.length === 0) {
                const defaultStatus = {};
                productsList.forEach(product => {
                    const productId = String(getProductId(product));
                    if (productId && productId !== 'undefined') {
                        defaultStatus[productId] = false;
                    }
                });
                setWishlistItems(defaultStatus);
                return;
            }

            const wishlistStatus = {};
            const batchSize = 5;

            // First, initialize all as false
            productsList.forEach(product => {
                const productId = String(getProductId(product));
                if (productId && productId !== 'undefined') {
                    wishlistStatus[productId] = false;
                }
            });

            // Then check actual status in batches
            for (let i = 0; i < productsList.length; i += batchSize) {
                const batch = productsList.slice(i, i + batchSize);
                const batchPromises = batch.map(async (product) => {
                    const productId = getProductId(product);
                    if (!productId || productId === 'undefined') return null;

                    try {
                        const res = await checkWishlist(userId, productId);
                        const liked = Boolean(res.data.isLiked ?? res?.data?.liked ?? res?.inWishlist ?? res?.data?.inWishlist);
                        return { productId, isInWishlist: Boolean(liked) };
                    } catch (error) {
                        console.log(`Error checking wishlist for product ${productId}:`, error);
                        return { productId, isInWishlist: false };
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) {
                        wishlistStatus[result.value.productId] = result.value.isInWishlist;
                    }
                });
            }

            setWishlistItems(wishlistStatus);
        } catch (error) {
            console.log('Error initializing wishlist:', error);
        }
    }, [userId]);

    // Auto refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const refreshData = async () => {
                if (!isActive) return;

                try {
                    await loadCartItems();

                    if (userId && products.length > 0 && isActive) {
                        await initializeWishlistStatus(products);
                    }
                } catch (error) {
                    console.log('Error in focus effect:', error);
                }
            };

            refreshData();

            return () => {
                isActive = false;
            };
        }, [loadCartItems, userId, products.length, initializeWishlistStatus])
    );

    // Load initial data
    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setLoading(true);

                const categoryId = parsedSelectedCategory;

                const requests = [
                    getProducts({ categoryId }),
                    getCategories(),
                    loadCartItems()
                ];

                const [productsRes, categoriesRes] = await Promise.all(requests);

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

                    if (categoryId && categoriesList.length > 0) {
                        const foundCategory = categoriesList.find(cat =>
                            cat._id === categoryId || cat.id === categoryId
                        );

                        if (foundCategory) {
                            setActiveCategory(foundCategory);
                        } else if (categoriesList.length > 0) {
                            setActiveCategory(categoriesList[0]);
                        }
                    } else if (categoriesList.length > 0) {
                        setActiveCategory(categoriesList[0]);
                    }

                    if (userId && items.length > 0) {
                        await initializeWishlistStatus(items);
                    }
                }
            } catch (e) {
                console.error('Error loading products:', e);
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
    }, [parsedSelectedCategory]);

    // Filter products when category or search changes
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

    // Utility functions
    const isInStock = useCallback((item, selectedVariant = null) => {
        const variants = Array.isArray(item?.variants) ? item.variants : [];

        if (selectedVariant) {
            return selectedVariant?.stock > 0 && selectedVariant?.status !== false;
        } else if (variants.length > 0) {
            return variants.some(variant => variant?.stock > 0 && variant?.status !== false);
        } else {
            return item?.stock > 0 && item?.status !== false;
        }
    }, []);

    const getAvailableStock = useCallback((item, selectedVariant = null) => {
        if (selectedVariant) {
            return selectedVariant?.stock || 0;
        } else {
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            if (variants.length > 0) {
                return variants.reduce((total, variant) => total + (variant?.stock || 0), 0);
            } else {
                return item?.stock || 0;
            }
        }
    }, []);

    const handleProductClick = useCallback((id) => {
        router.replace({ pathname: "/screens/ProductDetailScreen", params: { id: String(id) } });
    }, [router]);

    const getProductId = useCallback((item) => {
        return item?.id || item?._id || item?.productId;
    }, []);

    const getCartItemId = useCallback((productId, variantId = null) => {
        const cartItem = cartItems.find(item =>
            item.productId === String(productId) &&
            item.variantId === (variantId ? String(variantId) : null)
        );
        return cartItem?._id || cartItem?.id;
    }, [cartItems]);

    const computeProductPrice = useCallback((item) => {
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

        return { base, final, hasDiscount, discountPercent };
    }, []);

    const getCartQuantity = useCallback((productId, variantId = null) => {
        const item = cartItems.find(cartItem =>
            cartItem.productId === String(productId) &&
            cartItem.variantId === (variantId ? String(variantId) : null)
        );
        return item ? item.quantity : 0;
    }, [cartItems]);

    // Handle wishlist toggle
    const toggleWishlistForProduct = useCallback(async (productId) => {
        try {
            if (!productId || productId === 'undefined') {
                console.error('Invalid product ID');
                return;
            }

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

            if (wishlistUpdating[productId]) {
                return;
            }

            setWishlistUpdating(prev => ({ ...prev, [productId]: true }));
            const currentStatus = wishlistItems[productId] || false;

            // Optimistic update
            setWishlistItems(prev => ({
                ...prev,
                [productId]: !currentStatus
            }));

            const response = await toggleWishlist(userId, productId);

            let newWishlistState = false;

            if (response?.success === true) {
                if (response.liked !== undefined) {
                    newWishlistState = response.liked;
                } else if (response.data?.liked !== undefined) {
                    newWishlistState = response.data.liked;
                } else if (response.inWishlist !== undefined) {
                    newWishlistState = response.inWishlist;
                } else if (response.data?.inWishlist !== undefined) {
                    newWishlistState = response.data.inWishlist;
                } else {
                    newWishlistState = !currentStatus;
                }
            } else if (response?.success === false) {
                newWishlistState = currentStatus;
            } else if (response?.liked !== undefined) {
                newWishlistState = response.liked;
            } else if (response?.inWishlist !== undefined) {
                newWishlistState = response.inWishlist;
            } else {
                newWishlistState = !currentStatus;
            }

            newWishlistState = Boolean(newWishlistState);

            setWishlistItems(prev => ({
                ...prev,
                [productId]: newWishlistState
            }));

        } catch (error) {
            console.error('Error toggling wishlist:', error);

            // Revert optimistic update on error
            setWishlistItems(prev => ({
                ...prev,
                [String(productId)]: wishlistItems[String(productId)] || false
            }));

            Alert.alert('Error', 'Failed to update wishlist. Please try again.');
        } finally {
            setWishlistUpdating(prev => ({ ...prev, [String(productId)]: false }));
        }
    }, [userId, wishlistItems, wishlistUpdating, router]);

    // Handle add to cart
    const handleAddToCart = useCallback(async (item, variant = null) => {
        try {
            const productId = getProductId(item);
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const selectedVariantId = variant ? String(variant._id || variant.id) : selectedVariants[String(productId)];
            const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
            const effectiveVariantId = selectedVariantId || (defaultVariant ? String(defaultVariant?._id || defaultVariant?.id || defaultVariant?.variantId) : null);
            const effectiveVariant = variant || (effectiveVariantId ? variants.find(v => String(v?._id || v?.id) === effectiveVariantId) : null);

            // Check stock
            const isOutOfStock = !isInStock(item, effectiveVariant);
            if (isOutOfStock) {
                Alert.alert('Out of Stock', 'This item is currently out of stock');
                return;
            }

            // Check if already in cart
            const existingCartItem = cartItems.find(cartItem =>
                cartItem.productId === String(productId) &&
                cartItem.variantId === (effectiveVariantId ? String(effectiveVariantId) : null)
            );

            const availableStock = getAvailableStock(item, effectiveVariant);
            const currentQuantity = existingCartItem ? existingCartItem.quantity : 0;

            if (currentQuantity >= availableStock) {
                Alert.alert('Stock Limit', `You can only add ${availableStock} of this item to your cart`);
                return;
            }

            const payload = {
                productId: String(productId),
                quantity: existingCartItem ? existingCartItem.quantity + 1 : 1,
                variantId: effectiveVariantId ? String(effectiveVariantId) : null,
            };

            const tempId = `${productId}_${effectiveVariantId || 'default'}`;
            setUpdatingItems(prev => ({ ...prev, [tempId]: true }));

            if (existingCartItem) {
                await updateCartItem(existingCartItem._id || existingCartItem.id, payload.quantity);
            } else {
                await addCartItem(payload);
            }

            await loadCartItems();

            if (variant) {
                setShowVariantModal(false);
                setSelectedProductForVariant(null);
            }
        } catch (e) {
            console.error('Add to cart error:', e);
            Alert.alert('Error', 'Failed to add item to cart');
        } finally {
            const productId = getProductId(item);
            const effectiveVariantId = variant ? String(variant._id || variant.id) : selectedVariants[String(productId)];
            const tempId = `${productId}_${effectiveVariantId || 'default'}`;

            setUpdatingItems(prev => ({ ...prev, [tempId]: false }));
        }
    }, [selectedVariants, cartItems, isInStock, getAvailableStock, loadCartItems]);

    // Handle quantity update
    const handleUpdateQuantity = useCallback(async (productId, variantId, newQuantity) => {
        try {
            const product = products.find(p => getProductId(p) === productId);
            if (!product) {
                Alert.alert('Error', 'Product not found');
                return;
            }

            const variants = Array.isArray(product?.variants) ? product.variants : [];
            const variant = variants.find(v => String(v?._id || v?.id) === String(variantId));
            const availableStock = variant ? variant?.stock : product?.stock || 0;

            // Validate stock availability
            if (newQuantity > availableStock) {
                Alert.alert('Stock Limit', `Only ${availableStock} items available in stock`);
                return;
            }

            const itemId = getCartItemId(productId, variantId);

            if (!itemId && newQuantity > 0) {
                const payload = {
                    productId: String(productId),
                    quantity: newQuantity,
                    variantId: variantId ? String(variantId) : null,
                };

                const tempId = `${productId}_${variantId || 'default'}`;
                setUpdatingItems(prev => ({ ...prev, [tempId]: true }));

                await addCartItem(payload);
            } else if (itemId) {
                const tempId = `${productId}_${variantId || 'default'}`;
                setUpdatingItems(prev => ({ ...prev, [tempId]: true }));

                if (newQuantity === 0) {
                    await removeCartItem(productId, variantId);
                } else {
                    await updateCartItem(itemId, newQuantity);
                }
            }

            await loadCartItems();

        } catch (error) {
            console.error('Update quantity error:', error);
            Alert.alert('Error', 'Failed to update quantity');
        } finally {
            const tempId = `${productId}_${variantId || 'default'}`;
            setUpdatingItems(prev => ({ ...prev, [tempId]: false }));
        }
    }, [products, getCartItemId, loadCartItems]);

    const handleVariantSelect = useCallback((product) => {
        setSelectedProductForVariant(product);
        setShowVariantModal(true);
    }, []);

    const closeVariantModal = useCallback(() => {
        setShowVariantModal(false);
        setSelectedProductForVariant(null);
        setSelectedAttributes({});
    }, []);

    const handleBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    }, [router]);

    // Dynamic column calculation based on screen size and orientation
    const productColumns = useMemo(() => {
        if (orientation === 'landscape') {
            if (screenWidth >= 1200) return 4;
            if (screenWidth >= 1024) return 3;
            if (screenWidth >= 768) return 2;
            return 2;
        } else {
            if (screenWidth >= 1024) return 3;
            if (screenWidth >= 768) return 3;
            if (screenWidth >= 414) return 2;
            return 2;
        }
    }, [orientation, screenWidth]);

    // Calculate dynamic widths based on orientation
    const leftColumnWidth = useMemo(() => {
        return orientation === 'landscape' ?
            (isTablet ? responsiveWidth(20) : responsiveWidth(25)) :
            (isTablet ? responsiveWidth(25) : responsiveWidth(30));
    }, [orientation, isTablet]);

    const computeVariantPrice = useCallback((variant, product) => {
        let base = Number(variant?.basePrice ?? variant?.price ?? 0);
        let final = Number(variant?.finalPrice ?? variant?.price ?? base);
        let hasDiscount = false;

        if (base === 0 && product) {
            const productPrice = computeProductPrice(product);
            base = productPrice.base;
            final = productPrice.final;
            hasDiscount = productPrice.hasDiscount;
        } else {
            if (variant?.discountType && variant?.discountValue) {
                if (variant.discountType === 'percent' && variant.discountValue > 0) {
                    const discountPercent = Number(variant.discountValue);
                    final = base - (base * discountPercent / 100);
                    hasDiscount = true;
                } else if (variant.discountType === 'flat') {
                    final = base - Number(variant.discountValue);
                    hasDiscount = final < base;
                }
            } else if (base > final) {
                hasDiscount = true;
            }
        }

        return {
            base: Number(base.toFixed(2)),
            final: Number(final.toFixed(2)),
            hasDiscount,
            discountPercent: hasDiscount && base > 0 ?
                Math.round(((base - final) / base) * 100) : 0
        };
    }, [computeProductPrice]);

    const formatVariantAttributes = useCallback((variant) => {
        if (!variant || !variant.attributes || !Array.isArray(variant.attributes)) {
            return "Default";
        }

        return variant.attributes
            .map(attr => {
                if (typeof attr === 'string') return attr;
                if (typeof attr === 'object') {
                    return `${attr.name || attr.attributeName || ''}: ${attr.value || ''}`.trim();
                }
                return '';
            })
            .filter(Boolean)
            .join(' • ');
    }, []);

    const groupAttributesByType = useCallback((variants) => {
        if (!variants || !Array.isArray(variants)) return {};

        const attributeGroups = {};

        variants.forEach(variant => {
            if (variant.attributes && Array.isArray(variant.attributes)) {
                variant.attributes.forEach(attr => {
                    if (!attr.name || !attr.value) return;

                    const attrName = attr.name.trim();
                    const attrValue = attr.value.trim();

                    if (!attributeGroups[attrName]) {
                        attributeGroups[attrName] = new Set();
                    }
                    attributeGroups[attrName].add(attrValue);
                });
            }
        });

        const result = {};
        Object.keys(attributeGroups).forEach(key => {
            result[key] = Array.from(attributeGroups[key]).sort();
        });

        return result;
    }, []);

    const getAvailableVariants = useCallback(() => {
        if (!selectedProductForVariant?.variants) return [];

        const variants = selectedProductForVariant.variants;

        return variants.filter(variant => {
            if (!variant.attributes || !Array.isArray(variant.attributes)) return false;

            return Object.keys(selectedAttributes).every(attrName => {
                const selectedValue = selectedAttributes[attrName];
                const variantAttr = variant.attributes.find(a =>
                    a.name === attrName || a.attributeName === attrName
                );
                return variantAttr && variantAttr.value === selectedValue;
            });
        });
    }, [selectedProductForVariant, selectedAttributes]);

    const getSelectedVariant = useCallback(() => {
        const availableVariants = getAvailableVariants();

        const exactMatch = availableVariants.find(variant => {
            if (!variant.attributes || !Array.isArray(variant.attributes)) return false;

            const variantAttrMap = {};
            variant.attributes.forEach(attr => {
                if (attr.name && attr.value) {
                    variantAttrMap[attr.name] = attr.value;
                }
            });

            return Object.keys(selectedAttributes).every(key =>
                variantAttrMap[key] === selectedAttributes[key]
            ) && Object.keys(variantAttrMap).length === Object.keys(selectedAttributes).length;
        });

        return exactMatch || availableVariants[0] || null;
    }, [getAvailableVariants, selectedAttributes]);

    const isAttributeAvailable = useCallback((attrName, attrValue) => {
        const tempAttributes = { ...selectedAttributes, [attrName]: attrValue };

        const availableVariants = selectedProductForVariant?.variants?.filter(variant => {
            if (!variant.attributes || !Array.isArray(variant.attributes)) return false;

            const variantAttrMap = {};
            variant.attributes.forEach(attr => {
                if (attr.name && attr.value) {
                    variantAttrMap[attr.name] = attr.value;
                }
            });

            return Object.keys(tempAttributes).every(key =>
                variantAttrMap[key] === tempAttributes[key]
            );
        }) || [];

        return availableVariants.length > 0;
    }, [selectedProductForVariant, selectedAttributes]);

    // Helper function to find variant by attributes
    const findVariantByAttributes = useCallback((variants, selectedAttrs) => {
        return variants.find(variant => {
            const variantAttrs = variant.attributes || [];

            return Object.keys(selectedAttrs).every(attrType => {
                const selectedValue = selectedAttrs[attrType];
                const variantAttr = variantAttrs.find(attr =>
                    (attr?.type || attr?.name) === attrType
                );
                return variantAttr && (variantAttr.value || variantAttr.name) === selectedValue;
            });
        });
    }, []);

    // Handle variant attribute selection
    const handleVariantAttributeSelect = useCallback((productId, attributeType, value) => {
        const product = products.find(p => String(getProductId(p)) === productId);
        if (!product) return;

        const currentAttrs = selectedAttributes[productId] || {};
        const updatedAttrs = { ...currentAttrs, [attributeType]: value };

        setSelectedAttributes(prev => ({
            ...prev,
            [productId]: updatedAttrs
        }));

        if (product.variants) {
            const foundVariant = findVariantByAttributes(product.variants, updatedAttrs);
            if (foundVariant) {
                setSelectedVariants(prev => ({
                    ...prev,
                    [productId]: foundVariant._id
                }));

                const displayImage = getDisplayImageForProduct(productId, product, foundVariant);
                setDisplayImages(prev => ({
                    ...prev,
                    [productId]: displayImage
                }));
            }
        }
    }, [products, selectedAttributes, findVariantByAttributes, getDisplayImageForProduct, getProductId]);

    // Render product item
    const renderProductItem = useCallback(({ item }) => {
        const productId = getProductId(item);
        const productPrice = computeProductPrice(item);
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        const showDiscount = productPrice.hasDiscount;
        const selectedVariantId = selectedVariants[String(productId)];
        const selectedVariantObj = variants.find(v => String(v?._id || v?.id) === String(selectedVariantId)) || variants[0];

        const displayImage = displayImages[productId] || getDisplayImageForProduct(productId, item, selectedVariantObj);

        const displayFinalPrice = selectedVariantObj
            ? computeVariantPrice(selectedVariantObj, item).final
            : productPrice.final;

        const isOutOfStock = !isInStock(item, selectedVariantObj);
        const availableStock = getAvailableStock(item, selectedVariantObj);
        const cartQuantity = getCartQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id);
        const canAddMore = isOutOfStock ? false : (cartQuantity < availableStock);

        const hasMultipleVariants = variants.length > 1;
        const tempId = `${productId}_${selectedVariantObj?._id || selectedVariantObj?.id || 'default'}`;
        const isUpdating = updatingItems[tempId];
        const isInWishlist = wishlistItems[String(productId)] || false;
        const isWishlistUpdating = wishlistUpdating[String(productId)] || false;

        const cardSpacing = responsiveSize(12);
        const availableWidth = screenWidth - leftColumnWidth - cardSpacing;
        const cardWidth = (availableWidth / productColumns) - cardSpacing;
        const imageHeight = responsiveHeight(orientation === 'landscape' ? 20 : 15);

        const attributeGroups = groupAttributesByType(variants);
        const currentAttributes = selectedAttributes[productId] || {};

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
                                    backgroundColor: isInWishlist ? '#FFF0F0' : '#FFFFFF',
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
                                            tintColor: isInWishlist ? "#FF6B6B" : "#666",
                                        }
                                    ]}
                                    resizeMode="contain"
                                />
                            )}
                        </Pressable>

                        <Image
                            style={styles.image}
                            source={displayImage}
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

                        {hasMultipleVariants && Object.keys(attributeGroups).length > 0 && (
                            <View style={styles.variantAttributesContainer}>
                                {Object.keys(attributeGroups).slice(0, 1).map((attrName) => (
                                    <View key={attrName} style={styles.variantAttributeRow}>
                                        <Text style={[
                                            styles.attributeLabel,
                                            { fontSize: responsiveSize(10) }
                                        ]}>
                                            {attrName}:
                                        </Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            style={styles.attributeOptionsScroll}
                                        >
                                            {attributeGroups[attrName].slice(0, 3).map((attrValue) => {
                                                const isSelected = currentAttributes[attrName] === attrValue;
                                                return (
                                                    <Pressable
                                                        key={attrValue}
                                                        style={[
                                                            styles.attributeOptionInline,
                                                            isSelected && styles.selectedAttributeOptionInline,
                                                            {
                                                                paddingHorizontal: responsiveSize(6),
                                                                paddingVertical: responsiveSize(2),
                                                                marginRight: responsiveSize(4),
                                                                borderRadius: responsiveSize(4),
                                                            }
                                                        ]}
                                                        onPress={() => handleVariantAttributeSelect(productId, attrName, attrValue)}
                                                    >
                                                        <Text style={[
                                                            styles.attributeOptionTextInline,
                                                            isSelected && styles.selectedAttributeOptionTextInline,
                                                            { fontSize: responsiveSize(9) }
                                                        ]}>
                                                            {attrValue}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={styles.stockContainer}>
                            {isOutOfStock ? (
                                <Text style={styles.outOfStockText}>
                                    Out of Stock
                                </Text>
                            ) : (
                                <Text style={styles.inStockText}>
                                    {availableStock > 10 ? 'In Stock' : `Only ${availableStock} left`}
                                </Text>
                            )}
                        </View>

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
                                disabled={isOutOfStock || isUpdating || !canAddMore}
                            >
                                <Text style={[
                                    styles.quantityPlus,
                                    { fontSize: responsiveSize(16) },
                                    (isOutOfStock || isUpdating || !canAddMore) && styles.disabledText
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
                                {isUpdating ? '...' : (hasMultipleVariants ? 'Options' : (isOutOfStock ? 'Out of Stock' : 'ADD'))}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }, [
        getProductId, computeProductPrice, selectedVariants, displayImages, getDisplayImageForProduct,
        computeVariantPrice, isInStock, getAvailableStock, getCartQuantity, updatingItems,
        wishlistItems, wishlistUpdating, leftColumnWidth, productColumns, orientation,
        groupAttributesByType, selectedAttributes, toggleWishlistForProduct,
        handleProductClick, handleVariantAttributeSelect, handleUpdateQuantity,
        handleVariantSelect, handleAddToCart, responsiveSize, screenWidth, isTablet
    ]);

    // Render variant modal content
    const renderVariantModalContent = useCallback(() => {
        const availableVariants = getAvailableVariants();
        const selectedVariant = getSelectedVariant();
        const attributeGroups = groupAttributesByType(selectedProductForVariant?.variants);

        if (!selectedProductForVariant) return null;

        const productId = getProductId(selectedProductForVariant);

        // Get the current display image based on selected variant
        const currentDisplayImage = getDisplayImageForProduct(productId, selectedProductForVariant, selectedVariant);

        return (
            <ScrollView style={styles.variantContent}>
                <View style={styles.productInfoContainer}>
                    <Image
                        source={selectedVariant ?
                            getDisplayImageForProduct(productId, selectedProductForVariant, selectedVariant) :
                            getDisplayImageForProduct(productId, selectedProductForVariant, null)
                        }
                        style={[
                            styles.productInfoImage,
                            {
                                width: responsiveSize(80),
                                height: responsiveSize(80),
                                borderRadius: responsiveSize(8),
                            }
                        ]}
                        defaultSource={require("../../assets/icons/fruit.png")}
                    />
                    <View style={styles.productInfoText}>
                        <Text style={[
                            styles.productInfoName,
                            { fontSize: responsiveSize(16) }
                        ]} numberOfLines={2}>
                            {selectedProductForVariant?.title || selectedProductForVariant?.name}
                        </Text>
                        {selectedVariant && (
                            <Text style={[
                                styles.selectedVariantPrice,
                                { fontSize: responsiveSize(18) }
                            ]}>
                                ₹{computeVariantPrice(selectedVariant, selectedProductForVariant).final.toFixed(2)}
                            </Text>
                        )}
                    </View>
                </View>

                {Object.keys(attributeGroups).map((attrName, index) => (
                    <View key={index} style={styles.attributeSection}>
                        <Text style={[
                            styles.attributeTitle,
                            { fontSize: responsiveSize(14), marginBottom: responsiveSize(8) }
                        ]}>
                            {attrName}:
                        </Text>

                        <View style={styles.attributeOptions}>
                            {attributeGroups[attrName].map((attrValue, idx) => {
                                const isSelected = selectedAttributes[attrName] === attrValue;
                                const isAvailable = isAttributeAvailable(attrName, attrValue);

                                return (
                                    <Pressable
                                        key={idx}
                                        style={[
                                            styles.attributeOption,
                                            isSelected && styles.selectedAttributeOption,
                                            !isAvailable && styles.unavailableAttributeOption,
                                            {
                                                paddingHorizontal: responsiveSize(12),
                                                paddingVertical: responsiveSize(8),
                                                marginRight: responsiveSize(8),
                                                marginBottom: responsiveSize(8),
                                                borderRadius: responsiveSize(6),
                                            }
                                        ]}
                                        onPress={() => {
                                            if (isAvailable) {
                                                // Update selected attributes
                                                const updatedAttributes = { ...selectedAttributes, [attrName]: attrValue };
                                                setSelectedAttributes(updatedAttributes);

                                                // Find the matching variant
                                                const matchingVariant = findVariantForAttributes(updatedAttributes);
                                                if (matchingVariant) {
                                                    // Update selected variant in state
                                                    setSelectedVariants(prev => ({
                                                        ...prev,
                                                        [productId]: matchingVariant._id || matchingVariant.id
                                                    }));
                                                }
                                            }
                                        }}
                                        disabled={!isAvailable}
                                    >
                                        <Text style={[
                                            styles.attributeOptionText,
                                            isSelected && styles.selectedAttributeOptionText,
                                            !isAvailable && styles.unavailableAttributeOptionText,
                                            { fontSize: responsiveSize(12) }
                                        ]}>
                                            {attrValue}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ))}
                {selectedVariant && (
                    <View style={styles.selectedVariantDetails}>
                        <View style={styles.variantInfoRow}>
                            <Text style={[
                                styles.variantInfoLabel,
                                { fontSize: responsiveSize(12), color: '#666' }
                            ]}>
                                Selected:
                            </Text>
                            <Text style={[
                                styles.variantInfoValue,
                                { fontSize: responsiveSize(14) }
                            ]}>
                                {formatVariantAttributes(selectedVariant)}
                            </Text>
                        </View>

                        <View style={styles.variantInfoRow}>
                            <Text style={[
                                styles.variantInfoLabel,
                                { fontSize: responsiveSize(12), color: '#666' }
                            ]}>
                                Stock:
                            </Text>
                            <Text style={[
                                styles.variantStockStatus,
                                {
                                    fontSize: responsiveSize(14),
                                    color: selectedVariant.stock > 0 ? '#4CAD73' : '#FF4444'
                                }
                            ]}>
                                {selectedVariant.stock > 0 ?
                                    `${selectedVariant.stock} available` :
                                    'Out of Stock'}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.actionContainer}>
                    {selectedVariant ? (
                        <>
                            <Text style={[
                                styles.finalPrice,
                                { fontSize: responsiveSize(20), marginBottom: responsiveSize(12) }
                            ]}>
                                ₹{computeVariantPrice(selectedVariant, selectedProductForVariant).final.toFixed(2)}
                            </Text>

                            {getCartQuantity(getProductId(selectedProductForVariant), selectedVariant._id || selectedVariant.id) > 0 ? (
                                <View style={[
                                    styles.quantityControl,
                                    {
                                        borderRadius: responsiveSize(8),
                                        padding: responsiveSize(8),
                                        backgroundColor: '#F5F5F5',
                                    }
                                ]}>
                                    <Pressable
                                        style={styles.quantityButton}
                                        onPress={() => handleUpdateQuantity(
                                            getProductId(selectedProductForVariant),
                                            selectedVariant._id || selectedVariant.id,
                                            getCartQuantity(getProductId(selectedProductForVariant), selectedVariant._id || selectedVariant.id) - 1
                                        )}
                                    >
                                        <Text style={[
                                            styles.quantitySymbol,
                                            { fontSize: responsiveSize(20) }
                                        ]}>-</Text>
                                    </Pressable>

                                    <Text style={[
                                        styles.quantityText,
                                        { fontSize: responsiveSize(16), marginHorizontal: responsiveSize(20) }
                                    ]}>
                                        {getCartQuantity(getProductId(selectedProductForVariant), selectedVariant._id || selectedVariant.id)}
                                    </Text>

                                    <Pressable
                                        style={styles.quantityButton}
                                        onPress={() => handleUpdateQuantity(
                                            getProductId(selectedProductForVariant),
                                            selectedVariant._id || selectedVariant.id,
                                            getCartQuantity(getProductId(selectedProductForVariant), selectedVariant._id || selectedVariant.id) + 1
                                        )}
                                        disabled={!selectedVariant.stock || selectedVariant.stock <= getCartQuantity(getProductId(selectedProductForVariant), selectedVariant._id || selectedVariant.id)}
                                    >
                                        <Text style={[
                                            styles.quantitySymbol,
                                            { fontSize: responsiveSize(20) },
                                            (!selectedVariant.stock || selectedVariant.stock <= getCartQuantity(getProductId(selectedProductForVariant), selectedVariant._id || selectedVariant.id)) &&
                                            styles.disabledQuantitySymbol
                                        ]}>+</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable
                                    style={[
                                        styles.addToCartButton,
                                        {
                                            paddingVertical: responsiveSize(14),
                                            borderRadius: responsiveSize(8),
                                            backgroundColor: '#4CAD73'
                                        }
                                    ]}
                                    onPress={() => handleAddToCart(selectedProductForVariant, selectedVariant)}
                                    disabled={!selectedVariant.stock || selectedVariant.stock === 0}
                                >
                                    <Text style={[
                                        styles.addToCartText,
                                        { fontSize: responsiveSize(16) }
                                    ]}>
                                        {(!selectedVariant.stock || selectedVariant.stock === 0) ?
                                            'Out of Stock' :
                                            'Add to Cart'}
                                    </Text>
                                </Pressable>
                            )}
                        </>
                    ) : (
                        <Text style={[
                            styles.noVariantText,
                            { fontSize: responsiveSize(14), color: '#666' }
                        ]}>
                            Select {Object.keys(attributeGroups).join(' and ')} to see availability
                        </Text>
                    )}
                </View>
            </ScrollView>
        );
    }, [
        selectedProductForVariant, selectedAttributes, getAvailableVariants, getSelectedVariant,
        groupAttributesByType, computeVariantPrice, isAttributeAvailable, getProductId,
        getDisplayImageForProduct, responsiveSize
    ]);

    const findVariantForAttributes = useCallback((attributes) => {
        if (!selectedProductForVariant?.variants) return null;

        const variants = selectedProductForVariant.variants;

        return variants.find(variant => {
            if (!variant.attributes || !Array.isArray(variant.attributes)) return false;

            const variantAttrMap = {};
            variant.attributes.forEach(attr => {
                if (attr.name && attr.value) {
                    variantAttrMap[attr.name] = attr.value;
                }
            });

            return Object.keys(attributes).every(key =>
                variantAttrMap[key] === attributes[key]
            ) && Object.keys(variantAttrMap).length === Object.keys(attributes).length;
        });
    }, [selectedProductForVariant]);

    const getHeaderTitle = useCallback(() => {
        if (categoryName) return capitalizeWords(categoryName);
        if (activeCategory) return capitalizeWords(activeCategory.name);
        return 'All Categories';
    }, [categoryName, activeCategory]);

    return (
        <View style={[styles.container]}>
            <StatusBar
                backgroundColor="#4CAD73"
                barStyle="light-content"
                translucent={false}
            />

            <View style={[
                styles.header,
                {
                    height: responsiveSize(60) + insets.top,
                    paddingTop: insets.top,
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
                    {getHeaderTitle()}
                </Text>

                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.mainContent, { marginTop: responsiveSize(60) + insets.top }]}>
                <View style={styles.twoColumnLayout}>
                    <View style={[
                        styles.leftColumn,
                        { width: leftColumnWidth },
                        { marginBottom: insets.bottom }
                    ]}>
                        <ScrollView
                            style={styles.categoriesList}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.categoriesContent}
                        >
                            {categories.map((category) => {
                                const url = category?.image || category?.icon;
                                const imageSource = url ?
                                    { uri: `${API_BASE_URL}${url}` } :
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
                                                {capitalizeWords(category.name)}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={[styles.rightColumn, { marginBottom: insets.bottom }]}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#4CAD73" />
                                <Text style={[
                                    styles.loadingText,
                                    { fontSize: responsiveSize(14), marginTop: responsiveSize(20) }
                                ]}>
                                    Loading Products…
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
                                    { paddingBottom: insets.bottom + responsiveSize(20) }
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

            <Modal
                visible={showVariantModal}
                animationType="slide"
                transparent={true}
                statusBarTranslucent={true}
                onRequestClose={closeVariantModal}
            >
                <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
                    <View style={[
                        styles.modalContainer,
                        {
                            height: responsiveHeightWithInsets(85) + insets.bottom,
                            borderTopLeftRadius: responsiveSize(20),
                            borderTopRightRadius: responsiveSize(20),
                        }
                    ]}>
                        <SafeAreaView style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
                            <View style={[
                                styles.modalHeader,
                                {
                                    paddingHorizontal: responsiveSize(20),
                                    paddingVertical: responsiveSize(16),
                                    paddingTop: insets.top > 0 ? insets.top : responsiveSize(16),
                                }
                            ]}>
                                <Text style={[
                                    styles.modalTitle,
                                    { fontSize: responsiveSize(18) }
                                ]}>
                                    Select Options
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

                            {renderVariantModalContent()}
                        </SafeAreaView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    variantContent: {
        flex: 1,
        paddingHorizontal: responsiveSize(16),
    },
    productInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: responsiveSize(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    productInfoImage: {
        marginRight: responsiveSize(12),
    },
    productInfoText: {
        flex: 1,
    },
    productInfoName: {
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: responsiveSize(4),
    },
    selectedVariantPrice: {
        fontFamily: 'Poppins-Bold',
        color: '#4CAD73',
    },
    attributeSection: {
        paddingVertical: responsiveSize(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    attributeTitle: {
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
    },
    attributeOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: responsiveSize(8),
    },
    attributeOption: {
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    selectedAttributeOption: {
        backgroundColor: '#4CAD73',
        borderColor: '#4CAD73',
    },
    unavailableAttributeOption: {
        backgroundColor: '#F9F9F9',
        borderColor: '#E0E0E0',
        opacity: 0.5,
    },
    attributeOptionText: {
        fontFamily: 'Poppins',
        color: '#666',
    },
    selectedAttributeOptionText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },
    unavailableAttributeOptionText: {
        color: '#999',
    },
    selectedVariantDetails: {
        paddingVertical: responsiveSize(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    variantInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: responsiveSize(8),
    },
    variantInfoLabel: {
        fontFamily: 'Poppins',
        width: responsiveSize(60),
    },
    variantInfoValue: {
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        flex: 1,
    },
    variantStockStatus: {
        fontFamily: 'Poppins-SemiBold',
    },

    finalPrice: {
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
    },
    addToCartButton: {
        width: '100%',
        alignItems: 'center',
    },
    addToCartText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },

    quantitySymbol: {
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
        minWidth: responsiveSize(30),
        textAlign: 'center',
    },
    disabledQuantitySymbol: {
        color: '#999',
    },

    noVariantText: {
        fontFamily: 'Poppins',
        textAlign: 'center',
        paddingVertical: responsiveSize(20),
    },
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
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    wishlistIcon: {
        // Tint color is now set dynamically in the component
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
        fontSize: 16,
        fontWeight: '900',
        color: '#4CAD73',
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
    stockContainer: {
        marginBottom: responsiveSize(4),
    },
    outOfStockText: {
        color: '#FF4444',
        fontSize: responsiveSize(10),
        fontFamily: 'Poppins-SemiBold',
    },
    inStockText: {
        fontSize: responsiveSize(10),
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '500',
        color: '#2196F3',

    },
});
import React, {useState, useEffect, useCallback} from 'react';
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
import {useSafeAreaInsets} from "react-native-safe-area-context";

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

// Check if device has notch (iPhone X and above)
const hasNotch = Platform.OS === 'ios' && (screenHeight >= 812 || screenWidth >= 812);

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
    const insets = useSafeAreaInsets();

    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('popular');
    const [priceRange, setPriceRange] = useState([0, 10000]);
    const [maxPrice, setMaxPrice] = useState(10000);
    const [showFilters, setShowFilters] = useState(false);
    const [cartItems, setCartItems] = useState([]);
    const [addingToCart, setAddingToCart] = useState({});
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [tierPricing, setTierPricing] = useState({});

    // Wishlist states
    const [wishlistStatus, setWishlistStatus] = useState({});
    const [wishlistLoading, setWishlistLoading] = useState({});
    const [userId, setUserId] = useState(null);
    const [checkedProductIds, setCheckedProductIds] = useState(new Set());

    // Variant management states
    const [selectedVariants, setSelectedVariants] = useState({});
    const [selectedAttributes, setSelectedAttributes] = useState({});
    const [groupedVariants, setGroupedVariants] = useState({});

    // Bottom navigation state
    const [activeTab, setActiveTab] = useState('home');

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

    // Handle params for category and tab selection
    useEffect(() => {
        if (params.fromTab) {
            // Handle tab-based filtering
            const tabName = params.tabName?.toLowerCase() || '';

            if (tabName && tabName !== 'all') {
                setSelectedCategory(tabName);
            } else {
                setSelectedCategory('all');
            }
        } else if (params.selectedCategory) {
            setSelectedCategory(params.selectedCategory);
        }
    }, [params]);

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

    // Initialize variant selection when products load
    useEffect(() => {
        filteredProducts.forEach(product => {
            if (product.variants && product.variants.length > 0 && !groupedVariants[getProductId(product)]) {
                initializeProductVariantSelection(product);
            }
        });
    }, [filteredProducts]);

    // Calculate bottom navigation height
    const getBottomNavigationHeight = () => {
        const baseHeight = RF(60);
        const bottomPadding = Platform.select({
            ios: insets.bottom,
            android: Math.max(insets.bottom, 10),
        });
        return baseHeight + bottomPadding;
    };

    const bottomNavHeight = getBottomNavigationHeight();

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

    const checkWishlistForVisibleProducts = async () => {
        if (!userId || filteredProducts.length === 0) return;

        const productsToCheck = filteredProducts.filter(product => {
            const productId = getProductId(product);
            return productId && !checkedProductIds.has(productId) && wishlistStatus[productId] === undefined;
        });

        if (productsToCheck.length === 0) return;

        for (const product of productsToCheck) {
            const productId = getProductId(product);
            if (!productId) continue;

            try {
                setWishlistLoading(prev => ({...prev, [productId]: true}));
                const response = await checkWishlist(userId, productId);

                let isInWishlist = false;
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

                setWishlistStatus(prev => ({
                    ...prev,
                    [productId]: isInWishlist
                }));

                setCheckedProductIds(prev => new Set([...prev, productId]));

            } catch (error) {
                console.error(`Error checking wishlist for product ${productId}:`, error);
                setWishlistStatus(prev => ({
                    ...prev,
                    [productId]: false
                }));
                setCheckedProductIds(prev => new Set([...prev, productId]));
            } finally {
                setWishlistLoading(prev => ({...prev, [productId]: false}));
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    const toggleProductWishlist = async (productId) => {
        if (!userId || !productId) return false;

        try {
            const response = await toggleWishlist(userId, productId);

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
        if (response.data && Array.isArray(response.data.items)) return response.data.items;
        if (response.success && Array.isArray(response.data?.data)) return response.data.data;
        if (response.success && Array.isArray(response.data?.products)) return response.data.products;
        if (response.success && Array.isArray(response.data)) return response.data;
        return [];
    };

    const extractCategoriesFromResponse = (response) => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.data?.data)) return response.data.data;
        if (response.success && Array.isArray(response.data)) return response.data;
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

    // Group variants by attributes for a product
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
    const findVariantByAttributes = useCallback((variants, selectedAttrs) => {
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
    }, []);

    // Get available values for an attribute type based on current selections
    const getAvailableValues = useCallback((variants, attributeType, currentAttributes) => {
        const filteredVariants = variants.filter(variant => {
            // Check if variant matches all currently selected attributes except the one being evaluated
            return Object.keys(currentAttributes).every(type => {
                if (type === attributeType) return true; // Skip the attribute we're checking

                const selectedValue = currentAttributes[type];
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
    }, []);

    // Check if an attribute value is available (has stock)
    const isAttributeAvailable = useCallback((variants, attributeType, value, currentAttributes) => {
        return variants.some(variant => {
            const variantAttrs = variant.attributes || [];
            const hasAttribute = variantAttrs.some(attr =>
                (attr?.type || attr?.name) === attributeType &&
                (attr?.value || attr?.name) === value
            );
            const hasStock = (variant.stock || variant.quantity || 0) > 0;

            // Also check if variant matches other selected attributes
            const matchesOtherAttributes = Object.keys(currentAttributes).every(type => {
                if (type === attributeType) return true;
                const selectedValue = currentAttributes[type];
                const variantAttr = variantAttrs.find(attr =>
                    (attr?.type || attr?.name) === type
                );
                return variantAttr && (variantAttr.value || variantAttr.name) === selectedValue;
            });

            return hasAttribute && hasStock && matchesOtherAttributes;
        });
    }, []);

    // Initialize attributes and variant selection for a product
    const initializeProductVariantSelection = useCallback((product) => {
        const productId = getProductId(product);

        if (product?.variants && product.variants.length > 0) {
            // Group variants by attributes
            const grouped = groupVariantsByAttributes(product.variants);
            setGroupedVariants(prev => ({
                ...prev,
                [productId]: grouped
            }));

            // Set initial attributes from first available variant
            const firstAvailable = product.variants.find(v => (v.stock || v.quantity || 0) > 0) || product.variants[0];
            if (firstAvailable) {
                const initialAttrs = {};
                const firstAttrs = firstAvailable.attributes || [];
                firstAttrs.forEach(attr => {
                    const type = attr?.type || attr?.name;
                    const value = attr?.value || attr?.name;
                    if (type && value) {
                        initialAttrs[type] = value;
                    }
                });

                setSelectedAttributes(prev => ({
                    ...prev,
                    [productId]: initialAttrs
                }));

                setSelectedVariants(prev => ({
                    ...prev,
                    [productId]: firstAvailable._id
                }));
            }
        }
    }, [groupVariantsByAttributes]);

    // Handle attribute selection for a product
    const handleAttributeSelect = useCallback((productId, attributeType, value) => {
        const product = filteredProducts.find(p => getProductId(p) === productId);

        if (!product) return;

        const currentAttrs = selectedAttributes[productId] || {};
        const updatedAttrs = {...currentAttrs, [attributeType]: value};

        // Update attributes
        setSelectedAttributes(prev => ({
            ...prev,
            [productId]: updatedAttrs
        }));

        // Find and set the corresponding variant
        if (product.variants) {
            const foundVariant = findVariantByAttributes(product.variants, updatedAttrs);
            if (foundVariant) {
                setSelectedVariants(prev => ({
                    ...prev,
                    [productId]: foundVariant._id
                }));
            } else {
                // If no variant matches, clear the variant selection
                setSelectedVariants(prev => ({
                    ...prev,
                    [productId]: null
                }));
            }
        }
    }, [filteredProducts, selectedAttributes, findVariantByAttributes]);

    const filterAndSortProducts = useCallback(() => {
        let filtered = [...products];

        // 1. Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();

            filtered = filtered.filter(product => {
                const title = product?.title?.toLowerCase() || '';
                const description = product?.description?.toLowerCase() || '';
                const categoryNames =
                    product?.categoryIds?.map(c => c?.name?.toLowerCase() || '').join(' ') || '';
                const tagNames =
                    product?.tags?.join(' ')?.toLowerCase() || '';

                return (
                    title.includes(query) ||
                    description.includes(query) ||
                    categoryNames.includes(query) ||
                    tagNames.includes(query)
                );
            });
        }

        // 2. Category / Tab filter
        if (selectedCategory !== 'all') {
            const cat = selectedCategory.toLowerCase();

            filtered = filtered.filter(product => {
                const categoryNames =
                    product?.categoryIds?.map(c => c?.name?.toLowerCase() || '') || [];

                // Direct category match (backend)
                if (categoryNames.includes(cat)) return true;

                // Tab based mapping
                const tabKeywords = {
                    'wedding': ['wedding', 'marriage', 'bride', 'groom', 'ring'],
                    'winter': ['winter', 'cold', 'wool', 'jacket', 'sweater'],
                    'electronics': ['electronic', 'phone', 'laptop', 'gadget'],
                    'grocery': ['grocery', 'food', 'vegetable', 'fruit'],
                    'fashion': ['fashion', 'clothes', 'dress', 'shirt', 'wear']
                };

                const keywords = tabKeywords[cat] || [];
                if (!keywords.length) return false;

                const searchText = [
                    product?.title?.toLowerCase() || '',
                    product?.description?.toLowerCase() || '',
                    categoryNames.join(' '),
                    product?.tags?.join(' ')?.toLowerCase() || ''
                ].join(' ');

                return keywords.some(k => searchText.includes(k.toLowerCase()));
            });
        }

        // 3. Price range filter
        filtered = filtered.filter(product => {
            const price = calculateProductPrice(product).finalPrice;
            return price >= priceRange[0] && price <= priceRange[1];
        });

        // 4. Sorting
        filtered.sort((a, b) => {
            const priceA = calculateProductPrice(a).finalPrice;
            const priceB = calculateProductPrice(b).finalPrice;
            const nameA = (a.title || '').toLowerCase();
            const nameB = (b.title || '').toLowerCase();

            switch (sortBy) {
                case 'price-low':
                    return priceA - priceB;
                case 'price-high':
                    return priceB - priceA;
                case 'name':
                    return nameA.localeCompare(nameB);
                case 'newest':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                default:
                    return (b.popularity || 0) - (a.popularity || 0);
            }
        });

        setFilteredProducts(filtered);
    }, [products, searchQuery, selectedCategory, sortBy, priceRange]);

    // Get stock for a specific variant
    const getVariantStock = useCallback((product, variantId = null) => {
        if (!product?.variants) return product?.stock || 0;

        if (variantId) {
            const variant = product.variants.find(v => v._id === variantId);
            return variant?.stock || variant?.quantity || 0;
        }

        // If no variant selected but product has variants, find first available
        if (product.variants.length > 0) {
            const availableVariant = product.variants.find(v => (v.stock || v.quantity || 0) > 0);
            return availableVariant?.stock || availableVariant?.quantity || 0;
        }

        return product?.stock || 0;
    }, []);

    // Check if product has any in-stock variant
    const hasAvailableVariant = useCallback((product) => {
        if (!product?.variants || product.variants.length === 0) {
            return (product.stock || 0) > 0;
        }

        return product.variants.some(variant => (variant.stock || variant.quantity || 0) > 0);
    }, []);

    // Get first available variant ID
    const getFirstAvailableVariantId = useCallback((product) => {
        if (!product?.variants || product.variants.length === 0) {
            return null;
        }

        const availableVariant = product.variants.find(v => (v.stock || v.quantity || 0) > 0);
        return availableVariant?._id || null;
    }, []);

    // Get current selected variant ID with fallback
    const getSelectedVariantId = useCallback((productId, product) => {
        const selectedVariant = selectedVariants[productId];

        if (!product) return null;

        // If selected variant exists and is in stock, return it
        if (selectedVariant) {
            const stock = getVariantStock(product, selectedVariant);
            if (stock > 0) {
                return selectedVariant;
            }
        }

        // Otherwise get first available variant
        return getFirstAvailableVariantId(product);
    }, [selectedVariants, getVariantStock, getFirstAvailableVariantId]);

    const getProductStock = (product) => {
        // First check for stock in variants
        if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            const totalVariantStock = product.variants.reduce((sum, variant) => {
                if (variant.stock !== undefined && variant.stock !== null) {
                    return sum + Number(variant.stock);
                }
                return sum;
            }, 0);
            if (totalVariantStock > 0) return totalVariantStock;
        }

        // Check product-level stock
        if (product.stock !== undefined && product.stock !== null) {
            return Number(product.stock);
        }

        if (product.stockStatus === 'out_of_stock') return 0;
        if (product.stockStatus === 'in_stock') return 999;

        return 0;
    };

    const isProductOutOfStock = (product) => {
        const totalStock = getProductStock(product);
        return totalStock <= 0;
    };

    const calculateProductPrice = (product, variantId = null, quantity = 1) => {
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

        if (isBusinessUser) {
            // Handle tier pricing for business users
            const productId = product._id || product.id;
            const variantKey = variantId || (product.variants?.[0]?._id) || 'default';
            // You would need to implement getProductTierPricing similar to BlinkitHomeScreen
        }

        // If variantId is provided, use that variant's pricing
        if (variantId && product.variants) {
            const variant = product.variants.find(v => v._id === variantId);
            if (variant) {
                return buildResponse(
                    variant.basePrice ?? product.basePrice,
                    variant.finalPrice ?? product.finalPrice ?? product.price,
                    variant.discount ?? product.discount,
                    variant.discountPercent ?? product.discountPercent
                );
            }
        }

        // Use first variant if available
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
        const item = cartItems.find(cartItem => {
            const matchesProduct = cartItem.productId === String(productId) ||
                cartItem.product?._id === String(productId) ||
                cartItem.product?.id === String(productId);

            if (variantId) {
                return matchesProduct && cartItem.variantId === String(variantId);
            }

            return matchesProduct;
        });
        return item ? item.quantity : 0;
    };

    const getCartItemId = (productId, variantId = null) => {
        const cartItem = cartItems.find(item => {
            const matchesProduct = item.productId === String(productId) ||
                item.product?._id === String(productId) ||
                item.product?.id === String(productId);

            if (variantId) {
                return matchesProduct && item.variantId === String(variantId);
            }

            return matchesProduct;
        });
        return cartItem?._id || cartItem?.id;
    };

    const handleAddToCart = async (product) => {
        try {
            const productId = getProductId(product);

            // Check if product has variants
            if (product.variants && product.variants.length > 0) {
                // Check if all required attributes are selected
                const grouped = groupedVariants[productId];
                const currentAttributes = selectedAttributes[productId] || {};

                if (grouped) {
                    const missingAttributes = Object.keys(grouped).filter(type => !currentAttributes[type]);

                    if (missingAttributes.length > 0) {
                        Alert.alert(
                            'Selection Required',
                            `Please select ${missingAttributes.map(a => a.toLowerCase()).join(' and ')}`
                        );
                        return;
                    }
                }

                // Get selected variant
                const selectedVariantId = selectedVariants[productId];

                if (!selectedVariantId) {
                    Alert.alert('Invalid Selection', 'Please select a valid variant');
                    return;
                }

                // Check stock for selected variant
                const stock = getVariantStock(product, selectedVariantId);
                if (stock <= 0) {
                    Alert.alert('Out of Stock', 'This variant is currently out of stock');
                    return;
                }

                // Check cart quantity
                const cartQuantity = getCartQuantity(productId, selectedVariantId);
                if (cartQuantity >= stock) {
                    Alert.alert('Stock Limit', `Only ${stock} items available in stock`);
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

                const cartItem = {
                    productId: productId,
                    quantity: product.minQty || 1,
                    variantId: selectedVariantId
                };

                await addCartItem(cartItem);
                await loadCartItems();

            } else {
                // Handle simple product without variants
                const stock = product.stock || 0;
                if (stock <= 0) {
                    Alert.alert('Out of Stock', 'This product is currently out of stock');
                    return;
                }

                const cartQuantity = getCartQuantity(productId);
                if (cartQuantity >= stock) {
                    Alert.alert('Stock Limit', `Only ${stock} items available in stock`);
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
                if (quantity > stock) {
                    Alert.alert('Insufficient Stock', `Only ${stock} units available in stock.`);
                    setAddingToCart(prev => ({...prev, [productId]: false}));
                    return;
                }

                const cartItem = {
                    productId: productId,
                    quantity: quantity
                };

                await addCartItem(cartItem);
                await loadCartItems();

            }

        } catch (error) {
            console.error('Add to cart error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to add to cart';

            if (errorMessage?.includes('Minimum quantity') || errorMessage?.includes('minQty')) {
                Alert.alert('Minimum Quantity', errorMessage);
            } else if (errorMessage?.includes('stock') || errorMessage?.includes('out of stock')) {
                Alert.alert('Stock Issue', 'This product is out of stock or insufficient stock available.');
            } else {
                Alert.alert('Error', 'Failed to add product to cart. Please try again.');
            }
        } finally {
            const productId = getProductId(product);
            setAddingToCart(prev => ({...prev, [productId]: false}));
        }
    };

    const handleUpdateQuantity = async (productId, newQuantity, product) => {
        try {
            const selectedVariantId = selectedVariants[productId];

            // Get product to check stock
            if (!product) return;

            // Check stock before increasing quantity
            if (newQuantity > 0) {
                const stock = getVariantStock(product, selectedVariantId);
                const cartQuantity = getCartQuantity(productId, selectedVariantId);

                // If increasing quantity, check stock
                if (newQuantity > cartQuantity && newQuantity > stock) {
                    Alert.alert('Stock Limit', `Only ${stock} items available in stock for this variant.`);
                    return;
                }
            }

            const itemId = getCartItemId(productId, selectedVariantId);

            if (!itemId) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            if (newQuantity === 0) {
                await removeCartItem(productId, selectedVariantId);
                await loadCartItems();

            } else {
                await updateCartItem(itemId, newQuantity);
                await loadCartItems();
            }
        } catch (error) {
            console.error('Error updating quantity:', error);

            if (error.response?.data?.message?.includes('out of stock') ||
                error.response?.data?.message?.includes('insufficient stock')) {
                Alert.alert('Out of Stock', 'Cannot add more items. This variant is out of stock.');
                await loadCartItems(); // Refresh cart to show correct quantities
            } else {
                Alert.alert('Error', 'Failed to update quantity');
            }
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
                    {text: 'Cancel', style: 'cancel'},
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
        // Reset states on refresh
        setWishlistStatus({});
        setWishlistLoading({});
        setCheckedProductIds(new Set());
        setSelectedVariants({});
        setSelectedAttributes({});
        setGroupedVariants({});
        setRefreshing(false);
    }, []);

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
        const totalHorizontalPadding = RF(16) * 2; // Container padding
        const totalGapSpacing = RF(8) * (columnsCount - 1); // Gaps between cards
        const availableWidth = screenWidth - totalHorizontalPadding - totalGapSpacing;
        return availableWidth / columnsCount;
    };

    const productCardWidth = getProductCardWidth();

    const renderProductItem = ({item}) => {
        const productId = getProductId(item);
        const selectedVariantId = selectedVariants[productId];
        const priceInfo = calculateProductPrice(item, selectedVariantId);
        const cartQuantity = getCartQuantity(productId, selectedVariantId);
        const stock = getVariantStock(item, selectedVariantId);
        const hasAvailable = hasAvailableVariant(item);
        const grouped = groupedVariants[productId];
        const currentAttributes = selectedAttributes[productId] || {};

        // Get wishlist status from state
        const isInWishlist = wishlistStatus[productId] || false;
        const isLoadingWishlist = wishlistLoading[productId] || false;

        // Get image source
        let imageSource = require('../../assets/Rectangle 24904.png');
        if (item.thumbnail) {
            imageSource = {uri: `${API_BASE_URL}${item.thumbnail}`};
        } else if (item.images?.[0]) {
            imageSource = {uri: `${API_BASE_URL}${item.images[0]}`};
        } else if (item.image) {
            imageSource = {uri: `${API_BASE_URL}${item.image}`};
        }

        return (
            <Pressable
                style={[styles.productCard, {width: productCardWidth}, !hasAvailable && styles.outOfStockCard]}
                onPress={() => router.push(`/screens/ProductDetailScreen?id=${productId}`)}
                activeOpacity={0.7}
            >
                {!hasAvailable && (
                    <View style={styles.outOfStockOverlay}>
                        <Text style={styles.outOfStockText}>Out of Stock</Text>
                    </View>
                )}

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

                {isBusinessUser && priceInfo.minQty > 1 && (
                    <View style={styles.minQtyBadge}>
                        <Text style={styles.minQtyText}>Min: {priceInfo.minQty}</Text>
                    </View>
                )}

                {/* Product Image */}
                <View style={styles.productImageContainer}>
                    <Image
                        source={imageSource}
                        style={[styles.productImage, !hasAvailable && styles.outOfStockImage]}
                        resizeMode="cover"
                        defaultSource={require('../../assets/Rectangle 24904.png')}
                    />
                </View>

                {/* Product Info */}
                <View style={styles.productInfo}>
                    <Text style={[styles.productName, !hasAvailable && styles.outOfStockText]} numberOfLines={2}>
                        {item.title || item.name || 'Untitled Product'}
                    </Text>

                    {/* Variant selection with attributes */}
                    {grouped && Object.keys(grouped).length > 0 && hasAvailable && (
                        <View style={styles.variantsContainer}>
                            {Object.keys(grouped).map((attributeType) => (
                                <View key={attributeType} style={styles.variantAttributeSection}>
                                    <Text style={styles.variantLabel}>{grouped[attributeType].name}:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                                                style={styles.variantScroll}>
                                        {grouped[attributeType].values.map((value) => {
                                            const isSelected = currentAttributes[attributeType] === value;
                                            const isAvailable = isAttributeAvailable(item.variants, attributeType, value, currentAttributes);
                                            const isActive = getAvailableValues(item.variants, attributeType, currentAttributes).includes(value);

                                            return (
                                                <Pressable
                                                    key={`${attributeType}-${value}`}
                                                    style={[
                                                        styles.variantOption,
                                                        isSelected && styles.selectedVariantOption,
                                                        !isActive && styles.disabledVariantOption,
                                                        !isAvailable && styles.outOfStockVariantOption
                                                    ]}
                                                    onPress={() => isActive && handleAttributeSelect(productId, attributeType, value)}
                                                    disabled={!isActive}
                                                >
                                                    <Text style={[
                                                        styles.variantText,
                                                        isSelected && styles.selectedVariantText,
                                                        !isActive && styles.disabledVariantText,
                                                        !isAvailable && styles.outOfStockVariantText
                                                    ]}>
                                                        {value}
                                                        {!isAvailable && ' (Out)'}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Price Section */}
                    <View style={styles.priceSection}>
                        <Text style={[styles.productPrice, !hasAvailable && styles.outOfStockText]}>
                            ₹{priceInfo.finalPrice.toLocaleString()}
                        </Text>
                        {priceInfo.hasDiscount && hasAvailable && (
                            <View style={styles.discountContainer}>
                                <Text style={styles.originalPrice}>₹{priceInfo.basePrice.toLocaleString()}</Text>
                                <Text style={styles.discountBadge}>{priceInfo.discountPercent}% OFF</Text>
                            </View>
                        )}
                    </View>

                    {/* Stock Info */}
                    {hasAvailable && (
                        <Text style={styles.stockInfo}>
                            {stock > 10 ? 'In Stock' : `Only ${stock} left`}
                        </Text>
                    )}

                    {/* Business Min Quantity */}
                    {isBusinessUser && priceInfo.minQty > 1 && hasAvailable && (
                        <Text style={styles.businessMinQty}>
                            Min. {priceInfo.minQty} units
                        </Text>
                    )}

                    {/* Quantity/Add Button Section */}
                    <View style={styles.bottomActionContainer}>
                        {!hasAvailable ? (
                            <View style={styles.outOfStockButton}>
                                <Text style={styles.outOfStockButtonText}>Out of Stock</Text>
                            </View>
                        ) : cartQuantity > 0 ? (
                            <View style={styles.quantityControl}>
                                <Pressable
                                    style={[styles.quantityButton]}
                                    onPress={() => handleUpdateQuantity(productId, cartQuantity - 1, item)}
                                >
                                    <Text style={styles.quantityButtonText}>-</Text>
                                </Pressable>
                                <Text style={styles.quantityText}>{cartQuantity}</Text>
                                <Pressable
                                    style={[styles.quantityButton, cartQuantity >= stock && styles.quantityButtonDisabled]}
                                    onPress={() => handleUpdateQuantity(productId, cartQuantity + 1, item)}
                                    disabled={cartQuantity >= stock}
                                >
                                    <Text style={styles.quantityButtonText}>+</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={[styles.addButton, (addingToCart[productId] || !hasAvailable) && styles.addButtonDisabled]}
                                disabled={addingToCart[productId] || !hasAvailable}
                                onPress={() => handleAddToCart(item)}
                            >
                                {addingToCart[productId] ? (
                                    <ActivityIndicator size="small" color="#27AF34"/>
                                ) : (
                                    <Text style={styles.addButtonText}>ADD</Text>
                                )}
                            </Pressable>
                        )}
                    </View>
                </View>
            </Pressable>
        );
    };

    // Get page title based on selection
    const getPageTitle = () => {
        if (params.tabName) {
            return `${params.tabName.charAt(0).toUpperCase() + params.tabName.slice(1)} Products`;
        }
        if (selectedCategory === 'all') {
            return 'All Products';
        }
        const category = categories.find(c => c._id === selectedCategory);
        if (category) return `${category.name} Products`;

        // If it's a tab name (wedding, winter, etc.)
        return `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Products`;
    };

    // Loading state
    if (loading) {
        return (
            <View style={styles.safeContainer}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4CAD73"/>
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
                        paddingTop: insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
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
                    ]}>
                        {getPageTitle()}
                    </Text>

                    {/* Placeholder to balance the layout */}
                    <View style={[
                        styles.headerPlaceholder,
                        {width: RF(40)}
                    ]}/>
                </View>
            </SafeAreaView>

            {/* Main Content with bottom safe area */}
            <SafeAreaView
                style={[
                    styles.contentSafeArea,

                ]}
            >
                <View style={[styles.mainContent, {marginBottom: insets.bottom}]}>

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
                        keyExtractor={(item) => `${getProductId(item)}`}
                        numColumns={columnsCount}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={['#4CAD73']}
                                tintColor="#4CAD73"
                            />
                        }
                        contentContainerStyle={[
                            styles.productsGrid,
                            {
                                paddingBottom: bottomNavHeight + RF(20), // Add space for bottom navigation
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
                        columnWrapperStyle={columnsCount > 1 ? styles.columnWrapper : null}
                    />
                </View>
            </SafeAreaView>

            {/* Filters Modal - Fixed scrolling */}
            <Modal
                visible={showFilters}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFilters(false)}
                statusBarTranslucent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, {
                        height: screenHeight * 0.75,
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
                            contentContainerStyle={styles.filterContentContainer}
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

                            {/* Action Buttons */}
                            <View style={styles.filterActions}>
                                <Pressable
                                    style={[styles.filterButton, styles.resetFilterButton]}
                                    onPress={handleResetFilters}
                                >
                                    <Text style={styles.resetFilterButtonText}>Reset</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.filterButton, styles.applyFilterButton]}
                                    onPress={handleApplyFilters}
                                >
                                    <Text style={styles.applyFilterButtonText}>Apply</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

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
    mainContent: {
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
    // Bottom Navigation Styles
    bottomNavigation: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: RF(25),
        borderTopRightRadius: RF(25),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -4},
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 15,
        zIndex: 1000,
    },
    bottomNavContent: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: RF(60),
    },
    bottomNavItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingHorizontal: RF(8),
    },
    bottomNavIconContainer: {
        position: 'relative',
        marginBottom: RF(4),
    },
    bottomNavIcon: {
        width: RF(28),
        height: RF(28),
    },
    orderNavIcon: {
        width: RF(32),
        height: RF(32),
    },
    accountNavIcon: {
        width: RF(30),
        height: RF(30),
    },
    cartBadge: {
        position: 'absolute',
        top: -RF(6),
        right: -RF(6),
        backgroundColor: '#FF4444',
        borderRadius: RF(10),
        minWidth: RF(18),
        height: RF(18),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: RF(4),
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    cartBadgeText: {
        color: '#FFFFFF',
        fontSize: RF(10),
        fontWeight: 'bold',
        fontFamily: 'Poppins-Bold',
    },
    bottomNavLabel: {
        fontSize: RF(10),
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    bottomNavLabelActive: {
        color: '#4CAD73',
        fontWeight: '600',
    },
    // ... rest of your existing styles remain the same
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
        paddingHorizontal: RF(16),
        paddingTop: RF(10),
        flexGrow: 1,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: RF(12),
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: RF(12),
        padding: RF(10),
        marginBottom: RF(12),
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
        height: RF(100),
        borderRadius: RF(8),
        backgroundColor: '#F8F9FA',
        marginBottom: RF(8),
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
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
        marginBottom: RF(6),
        lineHeight: RF(16),
        height: RF(32),
    },
    priceSection: {
        marginBottom: RF(6),
    },
    productPrice: {
        fontSize: 16,
        fontWeight: '900',
        color: '#4CAD73',
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
        paddingVertical: RF(2),
        borderRadius: RF(3),
    },
    stockInfo: {
        fontSize: RF(10),
        fontFamily: 'Poppins-Regular',
        color: '#2196F3',
        marginBottom: RF(8),
    },
    businessMinQty: {
        fontSize: RF(10),
        fontFamily: 'Poppins-Regular',
        color: '#FF6B35',
        marginBottom: RF(8),
    },
    bottomActionContainer: {
        marginTop: 'auto',
    },
    outOfStockButton: {
        backgroundColor: '#F5F5F5',
        borderRadius: RF(6),
        paddingVertical: RF(6),
        paddingHorizontal: RF(12),
        alignItems: 'center',
    },
    outOfStockButtonText: {
        fontSize: RF(10),
        fontFamily: 'Poppins-SemiBold',
        color: '#999',
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        borderRadius: RF(6),
        paddingHorizontal: RF(6),
        paddingVertical: RF(6),
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    quantityButton: {
        minWidth: RF(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButtonDisabled: {
        opacity: 0.5,
    },
    quantityButtonText: {
        fontSize: RF(11),
        color: '#666',
        fontWeight: 'bold',
    },
    quantityText: {
        fontSize: RF(11),
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: RF(12),
    },
    addButton: {
        borderWidth: 1,
        borderColor: '#27AF34',
        borderRadius: RF(6),
        paddingVertical: RF(6),
        paddingHorizontal: RF(12),
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-SemiBold',
        color: '#27AF34',
    },
    addButtonDisabled: {
        opacity: 0.6,
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
    outOfStockCard: {
        opacity: 0.7,
    },
    minQtyBadge: {
        position: 'absolute',
        top: RF(6),
        right: RF(40),
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: RF(40),
        minHeight: screenHeight * 0.5,
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
    modalContainer: {
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
        flex: 1,
    },
    filterContentContainer: {
        padding: RF(20),
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
    filterActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: RF(20),
        marginBottom: RF(10),
    },
    filterButton: {
        flex: 1,
        paddingVertical: RF(12),
        borderRadius: RF(8),
        alignItems: 'center',
        marginHorizontal: RF(5),
    },
    resetFilterButton: {
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    resetFilterButtonText: {
        color: '#666',
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
    },
    applyFilterButton: {
        backgroundColor: '#4CAD73',
    },
    applyFilterButtonText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
    },
    // New styles for variant selector with attributes
    variantsContainer: {
        marginBottom: RF(8),
    },
    variantAttributeSection: {
        marginBottom: RF(6),
    },
    variantLabel: {
        fontSize: RF(10),
        fontFamily: 'Poppins-Medium',
        color: '#666',
        marginBottom: RF(2),
    },
    variantScroll: {
        flexDirection: 'row',
    },
    variantOption: {
        paddingHorizontal: RF(8),
        paddingVertical: RF(4),
        borderRadius: RF(4),
        backgroundColor: '#F5F5F5',
        marginRight: RF(6),
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    selectedVariantOption: {
        backgroundColor: '#4CAD73',
        borderColor: '#4CAD73',
    },
    disabledVariantOption: {
        backgroundColor: '#F5F5F5',
        borderColor: '#E0E0E0',
        opacity: 0.5,
    },
    outOfStockVariantOption: {
        borderColor: '#FFCCCB',
        backgroundColor: '#FFF5F5',
    },
    variantText: {
        fontSize: RF(9),
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    selectedVariantText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },
    disabledVariantText: {
        color: '#999',
    },
    outOfStockVariantText: {
        color: '#FF4444',
    },
    outOfStockOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: RF(12),
    },
});
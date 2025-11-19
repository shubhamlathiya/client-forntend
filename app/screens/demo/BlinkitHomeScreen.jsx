import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    StatusBar,
    RefreshControl,
    Alert,
    FlatList,
    Modal,
    Animated
} from 'react-native';
import {useRouter} from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCategories, getProducts, getProductsByCategory} from "../../../api/catalogApi";
import {API_BASE_URL} from "../../../config/apiConfig";
import {getAddresses} from "../../../api/addressApi";
import {addCartItem} from "../../../api/cartApi";

const {width, height} = Dimensions.get('window');

const TAB_CATEGORIES = [
    {
        id: 'all',
        name: 'All',
        icon: require('../../../assets/icons/all.png'),
        color: '#FF8C00', // Dark Orange
        headerColor: '#FF8C00',
        lightColor: '#FFD700' // Light Yellow
    },
    {
        id: 'wedding',
        name: 'Wedding',
        icon: require('../../../assets/icons/wedding.png'),
        color: '#D81B60', // Dark Pink
        headerColor: '#D81B60',
        lightColor: '#FF69B4' // Light Pink
    },
    {
        id: 'winter',
        name: 'Winter',
        icon: require('../../../assets/icons/winter.png'),
        color: '#1E88E5',
        headerColor: '#1E88E5',
        lightColor: '#87CEEB'
    },
    {
        id: 'electronics',
        name: 'Electronics',
        icon: require('../../../assets/icons/electronics.png'),
        color: '#43A047', // Dark Green
        headerColor: '#43A047',
        lightColor: '#32CD32' // Light Green
    },
    {
        id: 'grocery',
        name: 'Grocery',
        icon: require('../../../assets/icons/grocery.png'),
        color: '#FF6F00', // Dark Orange
        headerColor: '#FF6F00',
        lightColor: '#FFA500' // Light Orange
    },
    {
        id: 'fashion',
        name: 'Fashion',
        icon: require('../../../assets/icons/fashion.png'),
        color: '#8E24AA', // Dark Purple
        headerColor: '#8E24AA',
        lightColor: '#9370DB' // Light Purple
    }
];

export default function BlinkitHomeScreen() {
    const router = useRouter();
    const [userAddress, setUserAddress] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('16 minutes');
    const [userName, setUserName] = useState('');
    const [categories, setCategories] = useState([]);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({});
    const [addingToCart, setAddingToCart] = useState({});
    const [groceryCategories , setGroceryCategories] = useState([]);
    const [showCategoryFragment, setShowCategoryFragment] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryProducts, setCategoryProducts] = useState([]);
    const [fragmentLoading, setFragmentLoading] = useState(false);
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [tierPricing, setTierPricing] = useState({});

    // New state for tab view
    const [activeTab, setActiveTab] = useState('all');
    const [tabProducts, setTabProducts] = useState({});
    const [headerColor, setHeaderColor] = useState('#EC0505'); // Default red color

    // Animation values
    const [searchFocused, setSearchFocused] = useState(false);
    const searchAnim = useState(new Animated.Value(0))[0];
    const placeholderAnim = useState(new Animated.Value(1))[0];

    useEffect(() => {
        checkUserType();
        loadUserData();
        fetchCategories();
        loadFeaturedProducts();
        loadTabProducts('all'); // Load initial tab products
    }, []);

    const checkUserType = async () => {
        try {
            const loginType = await AsyncStorage.getItem('loginType');
            setIsBusinessUser(loginType === 'business');

            // Load tier pricing if business user
            if (loginType === 'business') {
                await loadTierPricing();
            }
        } catch (error) {
            console.error('Error checking user type:', error);
        }
    };

    // Add this function to load tier pricing
    const loadTierPricing = async () => {
        try {
            // You might want to load tier pricing data here
            // This could be a separate API call or part of your product data
            console.log('Loading tier pricing for business user...');
        } catch (error) {
            console.error('Error loading tier pricing:', error);
        }
    };
    // Update header color when tab changes
    useEffect(() => {
        const activeTabData = TAB_CATEGORIES.find(tab => tab.id === activeTab);
        if (activeTabData) {
            setHeaderColor(activeTabData.headerColor);
        }
    }, [activeTab]);

    // Search bar animation
    useEffect(() => {
        Animated.parallel([
            Animated.timing(searchAnim, {
                toValue: searchFocused ? 1 : 0,
                duration: 300,
                useNativeDriver: false,
            }),
            Animated.timing(placeholderAnim, {
                toValue: searchFocused ? 0 : 1,
                duration: 200,
                useNativeDriver: false,
            })
        ]).start();
    }, [searchFocused]);

    const searchBarWidth = searchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['100%', '90%']
    });

    const searchBarMargin = searchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -40]
    });

    const placeholderOpacity = placeholderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
    });

    const placeholderScale = placeholderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1]
    });

    // Load products for specific tab
    // Load products for specific tab
    const loadTabProducts = async (tabId) => {
        try {
            setLoading(true);
            let products = [];

            // Helper function to extract products from API response
            const extractProducts = (response) => {
                if (!response) return [];

                // Handle different response structures
                if (Array.isArray(response)) {
                    return response;
                } else if (Array.isArray(response.data)) {
                    return response.data;
                } else if (Array.isArray(response.items)) {
                    return response.items;
                } else if (response.data && Array.isArray(response.data.items)) {
                    return response.data.items;
                } else if (response.success && Array.isArray(response.data?.data)) {
                    return response.data.data;
                }
                return [];
            };

            // Helper function to filter products
            const filterProducts = (productsArray, keywords) => {
                if (!Array.isArray(productsArray)) return [];

                return productsArray.filter(p => {
                    if (!p) return false;

                    const title = p?.title?.toLowerCase() || '';
                    const name = p?.name?.toLowerCase() || '';
                    const category = p?.category?.toLowerCase() || '';
                    const description = p?.description?.toLowerCase() || '';

                    return keywords.some(keyword =>
                        title.includes(keyword) ||
                        name.includes(keyword) ||
                        category.includes(keyword) ||
                        description.includes(keyword)
                    );
                });
            };

            try {
                switch (tabId) {
                    case 'all':
                        const res = await getProducts({page: 1, limit: 20});
                        products = extractProducts(res);
                        break;

                    case 'wedding':
                        const weddingRes = await getProducts({page: 1, limit: 15});
                        const weddingProducts = extractProducts(weddingRes);
                        products = filterProducts(weddingProducts, [
                            'gift', 'wedding', 'marriage', 'ring', 'decoration',
                            'flower', 'bouquet', 'cake', 'card', 'invitation'
                        ]);
                        break;

                    case 'winter':
                        const winterRes = await getProducts({page: 1, limit: 15});
                        const winterProducts = extractProducts(winterRes);
                        products = filterProducts(winterProducts, [
                            'winter', 'cold', 'wool', 'sweater', 'jacket',
                            'gloves', 'scarf', 'heater', 'blanket', 'thermal'
                        ]);
                        break;

                    case 'electronics':
                        const electronicsRes = await getProducts({page: 1, limit: 15});
                        const electronicsProducts = extractProducts(electronicsRes);
                        products = filterProducts(electronicsProducts, [
                            'electronic', 'phone', 'mobile', 'laptop', 'computer',
                            'device', 'gadget', 'tech', 'smart', 'wireless'
                        ]);
                        break;

                    case 'grocery':
                        const groceryRes = await getProducts({page: 1, limit: 15});
                        const groceryProducts = extractProducts(groceryRes);
                        products = filterProducts(groceryProducts, [
                            'grocery', 'food', 'vegetable', 'fruit', 'rice',
                            'atta', 'dal', 'oil', 'spice', 'kitchen'
                        ]);
                        break;

                    case 'fashion':
                        const fashionRes = await getProducts({page: 1, limit: 15});
                        const fashionProducts = extractProducts(fashionRes);
                        products = filterProducts(fashionProducts, [
                            'fashion', 'clothes', 'dress', 'shirt', 'jeans',
                            'shoes', 'accessory', 'jewelry', 'watch', 'bag'
                        ]);
                        break;

                    default:
                        const defaultRes = await getProducts({page: 1, limit: 15});
                        products = extractProducts(defaultRes);
                }
            } catch (apiError) {
                console.warn(`API error for ${tabId} tab:`, apiError);
                // Continue with fallback products
            }

            // If no products found from API, use fallback products
            if (!Array.isArray(products) || products.length === 0) {
                console.log(`Using fallback products for ${tabId} tab`);
                products = generateFallbackProducts(tabId);
            }

            const processedProducts = products.map(product => {
                const id = product?._id || product?.id || `fallback-${Math.random()}`;
                const priceInfo = calculateProductPrice(product);

                return {
                    id,
                    name: product?.title || product?.name || `${tabId} Product ${Math.floor(Math.random() * 100)}`,
                    price: priceInfo.finalPrice,
                    basePrice: priceInfo.basePrice,
                    hasDiscount: priceInfo.hasDiscount,
                    discountPercent: priceInfo.discountPercent,
                    deliveryTime: "16 MINS",
                    image: product?.thumbnail ? {uri: `${API_BASE_URL}${product.thumbnail}`} : require("../../../assets/Rectangle 24904.png"),
                    variantId: product.variants?.[0]?._id || null
                };
            });

            setTabProducts(prev => ({
                ...prev,
                [tabId]: processedProducts
            }));

        } catch (error) {
            console.error(`Error loading ${activeTab} tab products:`, error);

            // Use featured products as final fallback
            const fallbackProducts = generateFallbackProducts(tabId);
            setTabProducts(prev => ({
                ...prev,
                [tabId]: fallbackProducts
            }));

            // Show user-friendly error message
            Alert.alert(
                'Temporary Issue',
                `Having trouble loading ${TAB_CATEGORIES.find(tab => tab.id === tabId)?.name} products. Showing available items.`,
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
        }
    };

    // Generate fallback products when API fails
    const generateFallbackProducts = (tabId) => {
        const tabNames = {
            'all': 'General',
            'wedding': 'Wedding',
            'winter': 'Winter',
            'electronics': 'Electronics',
            'grocery': 'Grocery',
            'fashion': 'Fashion'
        };

        const baseProducts = [
            { name: `${tabNames[tabId]} Item 1`, price: 199, originalPrice: 299 },
            { name: `${tabNames[tabId]} Item 2`, price: 299, originalPrice: 399 },
            { name: `${tabNames[tabId]} Item 3`, price: 399, originalPrice: 499 },
            { name: `${tabNames[tabId]} Item 4`, price: 149, originalPrice: 199 },
            { name: `${tabNames[tabId]} Item 5`, price: 599, originalPrice: 799 },
            { name: `${tabNames[tabId]} Item 6`, price: 249, originalPrice: 349 }
        ];

        return baseProducts.map((product, index) => ({
            id: `fallback-${tabId}-${index}`,
            name: product.name,
            price: product.price,
            basePrice: product.originalPrice,
            hasDiscount: true,
            discountPercent: Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100),
            deliveryTime: "16 MINS",
            image: require("../../../assets/Rectangle 24904.png"),
            variantId: null
        }));
    };
    const handleTabPress = (tabId) => {
        setActiveTab(tabId);
        if (!tabProducts[tabId]) {
            loadTabProducts(tabId);
        }
    };

    const openCategoryFragment = async (category) => {
        setSelectedCategory(category);
        setShowCategoryFragment(true);
        loadCategoryProducts(category._id);
    };

    const closeCategoryFragment = () => {
        setShowCategoryFragment(false);
        setSelectedCategory(null);
        setCategoryProducts([]);
    };

    const loadCategoryProducts = async (categoryId) => {
        try {
            setFragmentLoading(true);
            const res = await getProductsByCategory(categoryId);
            const productsData = res?.data?.items || res?.items || res?.data || [];

            const category_products = [];
            for (const item of productsData) {
                const id = item?._id || item?.id;
                const priceInfo = calculateProductPrice(item);
                category_products.push({
                    id,
                    name: item?.title || item?.name || "Unnamed",
                    price: priceInfo.finalPrice,
                    basePrice: priceInfo.basePrice,
                    hasDiscount: priceInfo.hasDiscount,
                    discountPercent: priceInfo.discountPercent,
                    deliveryTime: "16 MINS",
                    image: item?.thumbnail ? {uri: `${API_BASE_URL}${item.thumbnail}`} : require("../../../assets/Rectangle 24904.png"),
                    variantId: item.variants[0]._id
                });
            }
            setCategoryProducts(category_products);
        } catch (error) {
            console.error('Error loading category products:', error);
            Alert.alert('Error', 'Failed to load products');
        } finally {
            setFragmentLoading(false);
        }
    };

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        loadCategoryProducts(category._id);
    };

    const handleAddToCart = async (product, isFragment = false) => {
        try {
            const productId = product.id || product._id;

            // Check minimum quantity for business users
            if (isBusinessUser && product.minQty && product.minQty > 1) {
                Alert.alert(
                    'Minimum Quantity Required',
                    `Minimum order quantity for this product is ${product.minQty} units for business customers.`,
                    [{ text: 'OK' }]
                );
                return;
            }

            setAddingToCart(prev => ({...prev, [productId]: true}));

            const cartItem = {
                productId: productId,
                quantity: product.minQty || 1, // Use min quantity for business users
                variantId: product.variantId || null
            };

            await addCartItem(cartItem);

        } catch (error) {
            console.error('Add to cart error:', error);

            // Handle business-specific errors
            if (error.response?.data?.message?.includes('Minimum quantity')) {
                Alert.alert('Minimum Quantity', error.response.data.message);
            } else {
                Alert.alert('Error', 'Failed to add product to cart. Please try again.');
            }
        } finally {
            const productId = product.id || product._id;
            setAddingToCart(prev => ({...prev, [productId]: false}));
        }
    };

    const BusinessUserBadge = () => (
        <View style={styles.businessBadge}>
            <Text style={styles.businessBadgeText}>BUSINESS</Text>
        </View>
    );

    const handleFragmentProductPress = (product) => {
        closeCategoryFragment();
        router.push(`/screens/ProductDetailScreen?id=${product._id || product.id}`);
    };

    const handleCategoryPress = (category) => {
        openCategoryFragment(category);
    };

    const handleCategorySelected = (category) => {
        router.push({
            pathname: '/screens/ProductsScreen',
            params: {
                selectedCategory: category._id || category.id,
                categoryName: category.name
            }
        });
    };
// Modify the calculateProductPrice function to include tier pricing
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
            }
            else if (discount?.type === "percent" && discount.value > 0) {
                discountPercent = Number(discount.value);
            }
            else if (final < base) {
                discountPercent = Math.round(((base - final) / base) * 100);
            }

            return {
                basePrice: Math.round(base),
                finalPrice: Math.round(final),
                hasDiscount: discountPercent > 0,
                discountPercent,
                minQty // Add min quantity for business users
            };
        };

        // Apply tier pricing logic for business users
        if (isBusinessUser && product.tierPricing) {
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

    const renderFragmentProduct = ({item, index}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = item._id || item.id;

        const imageSource = item.image?.uri ? {uri: item.image.uri} : require("../../../assets/Rectangle 24904.png");

        return (
            <TouchableOpacity
                style={[styles.fragmentProductCard, index % 2 === 0 ? styles.fragmentLeftCard : styles.fragmentRightCard]}
                onPress={() => handleFragmentProductPress(item)}
            >
                <Image
                    source={imageSource}
                    style={styles.fragmentProductImage}
                    resizeMode="cover"
                />

                <View style={styles.fragmentProductInfo}>
                    <Text style={styles.fragmentProductName} numberOfLines={2}>
                        {item.title || item.name}
                    </Text>

                    <View style={styles.rowBetween}>
                        <View style={styles.leftPriceBox}>
                            <Text style={styles.fragmentProductPrice}>
                                ₹{priceInfo.finalPrice}
                            </Text>

                            {priceInfo.hasDiscount && (
                                <View style={styles.discountBox}>
                                    <Text style={styles.fragmentProductOriginalPrice}>
                                        ₹{priceInfo.basePrice}
                                    </Text>
                                    <Text style={styles.discountBadge}>
                                        {priceInfo.discountPercent}% OFF
                                    </Text>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.fragmentAddButton, addingToCart[productId] && styles.fragmentAddButtonDisabled]}
                            disabled={addingToCart[productId]}
                            onPress={() => handleAddToCart(item, true)}
                        >
                            <Text style={styles.fragmentAddButtonText}>
                                {addingToCart[productId] ? "ADDING..." : "ADD"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderTabProduct = ({item}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = item.id;

        const imageSource = item.image?.uri ? {uri: item.image.uri} : require("../../../assets/Rectangle 24904.png");

        return (
            <TouchableOpacity
                style={styles.tabProductCard}
                onPress={() => router.push(`/screens/ProductDetailScreen?id=${item.id}`)}
            >
                {/* Business User Badge */}
                {isBusinessUser && priceInfo.minQty > 1 && (
                    <View style={styles.minQtyBadge}>
                        <Text style={styles.minQtyText}>Min: {priceInfo.minQty}</Text>
                    </View>
                )}

                <Image
                    source={imageSource}
                    style={styles.tabProductImage}
                    resizeMode="cover"
                />

                <View style={styles.tabProductInfo}>
                    <Text style={styles.tabProductName} numberOfLines={2}>
                        {item.name}
                    </Text>

                    <View style={styles.rowBetween}>
                        <View style={styles.leftPriceBox}>
                            <Text style={styles.tabProductPrice}>
                                ₹{priceInfo.finalPrice}
                            </Text>

                            {priceInfo.hasDiscount && (
                                <View style={styles.discountBox}>
                                    <Text style={styles.tabProductOriginalPrice}>
                                        ₹{priceInfo.basePrice}
                                    </Text>
                                    <Text style={styles.discountBadge}>
                                        {priceInfo.discountPercent}% OFF
                                    </Text>
                                </View>
                            )}

                            {/* Show min quantity for business users */}
                            {isBusinessUser && priceInfo.minQty > 1 && (
                                <Text style={styles.businessMinQty}>
                                    Min. {priceInfo.minQty} units
                                </Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.tabAddButton, addingToCart[productId] && styles.tabAddButtonDisabled]}
                            disabled={addingToCart[productId]}
                            onPress={() => handleAddToCart(item)}
                        >
                            <Text style={styles.tabAddButtonText}>
                                {addingToCart[productId] ? "..." : "ADD"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Rest of your existing functions (fetchCategories, loadUserData, etc.)
    const fetchCategories = async () => {
        try {
            setLoading(true);
            const res = await getCategories();
            if (res?.success && Array.isArray(res?.data?.data)) {

                setCategories(res.data.data);
                setGroceryCategories(res.data.data);
            } else if (res?.success && Array.isArray(res.data)) {
                setCategories(res.data);
                setGroceryCategories(res.data);
            } else {
                setGroceryCategories( [{
                    id: 1, name: 'Vegetables & Fruits', image: require('../../../assets/images/vegetables.png'), color: '#D9EBEB'
                }, {
                    id: 2, name: 'Atta, Dal & Rice', image: require('../../../assets/images/atta-dal.png'), color: '#D9EBEB'
                }, {
                    id: 3, name: 'Oil, Ghee & Masala', image: require('../../../assets/images/oil-masala.png'), color: '#D9EBEB'
                }, {
                    id: 4, name: 'Dairy, Bread & Milk', image: require('../../../assets/images/dairy.png'), color: '#D9EBEB'
                }, {id: 5, name: 'Biscuits & Bakery', image: require('../../../assets/images/dairy.png'), color: '#D9EBEB'},]);

                setCategories([{
                    _id: '1', name: 'Lights, Diyas & Candles', image: require('../../../assets/images/diyas.png'),
                }, {
                    _id: '2', name: 'Diwali Gifts', image: require('../../../assets/images/gifts.png'),
                }, {
                    _id: '3', name: 'Appliances & Gadgets', image: require('../../../assets/images/appliances.png'),
                }, {
                    _id: '4', name: 'Home & Living', image: require('../../../assets/images/home-living.png'),
                }]);
            }
        } catch (err) {
            console.error("Error fetching categories", err);
            setCategories([{
                _id: '1', name: 'Lights, Diyas & Candles', image: require('../../../assets/images/diyas.png'),
            }, {
                _id: '2', name: 'Diwali Gifts', image: require('../../../assets/images/gifts.png'),
            }, {
                _id: '3', name: 'Appliances & Gadgets', image: require('../../../assets/images/appliances.png'),
            }, {
                _id: '4', name: 'Home & Living', image: require('../../../assets/images/home-living.png'),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const loadUserData = async () => {
        try {
            let hasValidAddress = false;

            // Step 1: Try to fetch addresses from API
            try {
                const addressesResponse = await getAddresses();
                console.log('Address API response:', addressesResponse);

                // Extract addresses from response
                const addresses = extractAddressesFromResponse(addressesResponse);

                if (addresses.length > 0) {
                    // Find and set default address
                    const defaultAddress = findDefaultAddress(addresses);
                    await saveAddressToStorage(defaultAddress);
                    hasValidAddress = true;
                }
            } catch (apiError) {
                console.warn('Could not fetch addresses from API, using stored data:', apiError);
            }

            // Step 2: Load address from AsyncStorage (either existing or API-saved)
            if (!hasValidAddress) {
                const storedAddress = await loadAddressFromStorage();
                if (storedAddress) {
                    setUserAddress(formatAddress(storedAddress));
                    hasValidAddress = true;
                }
            }

            // Step 3: If no address found, set default message
            if (!hasValidAddress) {
                setUserAddress('Select delivery address');
            }

            // Step 4: Load user name
            await loadUserName();

            // Step 5: Set delivery time
            setRandomDeliveryTime();

        } catch (error) {
            console.error('Error in loadUserData:', error);
            setFallbackUserData();
        }
    };

// Helper functions
    const extractAddressesFromResponse = (response) => {
        if (!response) return [];

        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.data?.data)) return response.data.data;
        if (Array.isArray(response.items)) return response.items;
        if (Array.isArray(response.data?.items)) return response.data.items;

        return [];
    };

    const findDefaultAddress = (addresses) => {
        return addresses.find(addr => addr.isDefault === true) ||
            addresses.find(addr => addr.is_default === true) ||
            addresses.find(addr => addr.default === true) ||
            addresses[0];
    };

    const saveAddressToStorage = async (address) => {
        if (!address) return;

        try {
            await AsyncStorage.setItem('selectedAddress', JSON.stringify(address));
            setUserAddress(formatAddress(address));
        } catch (error) {
            console.error('Error saving address to storage:', error);
        }
    };

    const loadAddressFromStorage = async () => {
        try {
            const selectedRaw = await AsyncStorage.getItem('selectedAddress');
            return selectedRaw ? JSON.parse(selectedRaw) : null;
        } catch (error) {
            console.error('Error loading address from storage:', error);
            return null;
        }
    };

    const formatAddress = (address) => {
        if (!address) return 'Select delivery address';

        const parts = [
            address.address,
            address.landmark,
            address.city
        ].filter(part => part && part.trim() !== '');

        return parts.join(', ') || 'Select delivery address';
    };

    const loadUserName = async () => {
        try {
            const storedUserName = await AsyncStorage.getItem('userName');
            if (storedUserName) {
                setUserName(storedUserName);
            }
        } catch (error) {
            console.error('Error loading user name:', error);
        }
    };

    const setRandomDeliveryTime = () => {
        const randomTime = Math.floor(Math.random() * 11) + 15;
        setDeliveryTime(`${randomTime} minutes`);
    };

    const setFallbackUserData = () => {
        setUserAddress('Select delivery address');
        setUserName('Guest User');
        setDeliveryTime('20 minutes');
    };
    async function loadFeaturedProducts() {
        try {
            setLoading(true);
            const res = await getProducts({page: 1, limit: 10});
            const payload = res?.data ?? res;
            const items = Array.isArray(payload) ? payload : (payload?.items || payload?.data?.items || []);

            const featured = [];
            for (const item of items) {
                const id = item?._id || item?.id;
                const priceInfo = calculateProductPrice(item);

                featured.push({
                    id,
                    name: item?.title || item?.name || "Unnamed",
                    price: priceInfo.finalPrice,
                    basePrice: priceInfo.basePrice,
                    hasDiscount: priceInfo.hasDiscount,
                    discountPercent: priceInfo.discountPercent,
                    deliveryTime: "16 MINS",
                    image: item?.thumbnail ? {uri: `${API_BASE_URL}${item.thumbnail}`} : require("../../../assets/Rectangle 24904.png"),
                    variantId: item.variants[0]._id
                });
            }
            setFeaturedProducts(featured);
        } catch (e) {
            console.log("Featured product fetch error:", e);
        } finally {
            setLoading(false);
        }
    }

    const handleProductPress = (product) => {
        router.push(`/screens/ProductDetailScreen?id=${product.id}`);
    };

    const handleAddressPress = () => {
        router.push("/screens/AddressListScreen");
    };

    const handleProfilePress = () => {
        router.push("/screens/ProfileScreen");
    };

    const truncateAddress = (address, maxLength = 25) => {
        if (!address) return 'Select delivery address';
        if (address.length > maxLength) {
            return address.substring(0, maxLength) + '...';
        }
        return address;
    };

    const currentTabProducts = tabProducts[activeTab] || featuredProducts;
    const activeTabData = TAB_CATEGORIES.find(tab => tab.id === activeTab);

    function handleNotification() {
        router.push("/screens/NotificationScreen");
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={headerColor} barStyle="light-content"/>

            {/* Header Section with Dynamic Background */}
            <View style={[styles.header, { backgroundColor: headerColor }]}>
                {/* Top Row */}
                <View style={styles.topRow}>
                    <View style={styles.deliveryInfo}>
                        <Text style={styles.blinkitText}>Blinkit in</Text>
                    </View>
                </View>

                {/* Delivery Time */}
                <View style={styles.addressRow}>
                    <Text style={styles.deliveryTimeBig}>{deliveryTime}</Text>
                </View>

                {/* Address Row - Clickable */}
                <TouchableOpacity style={styles.addressRow} onPress={handleAddressPress}>
                    <Text style={styles.homeText}>HOME</Text>
                    <Text style={styles.dash}>-</Text>
                    <Text style={styles.userAddress} numberOfLines={1}>
                        {userName ? `${userName}, ` : ''}{truncateAddress(userAddress)}
                    </Text>
                    <Image
                        source={require('../../../assets/icons/arrow-down-sign-to-navigate.png')}
                        style={styles.downArrow}
                    />
                </TouchableOpacity>

                {/* Search Bar with Animation */}
                <View style={styles.searchContainer}>
                    <TouchableOpacity
                        style={styles.searchBarTouchable}
                        onPress={() => router.push('/screens/SearchScreen')}
                    >
                        <Animated.View style={[
                            styles.searchBar,
                            {
                                width: searchBarWidth,
                                marginLeft: searchBarMargin
                            }
                        ]}>
                            <Image
                                source={require('../../../assets/icons/search.png')}
                                style={styles.searchIcon}
                            />
                            <Animated.Text
                                style={[
                                    styles.searchPlaceholder,
                                    {
                                        opacity: placeholderOpacity,
                                        transform: [{ scale: placeholderScale }]
                                    }
                                ]}
                            >
                                Search "ice-cream"
                            </Animated.Text>
                            <View style={styles.separator}/>
                            <Image
                                source={require('../../../assets/icons/mic.png')}
                                style={styles.micIcon}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </View>

                <View style={styles.tabContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabScrollContent}
                    >
                        {TAB_CATEGORIES.map((tab) => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[
                                    styles.tabItem,
                                    activeTab === tab.id && [
                                        styles.activeTabItem,
                                        { backgroundColor: tab.color }
                                    ]
                                ]}
                                onPress={() => handleTabPress(tab.id)}
                            >
                                {/* First Row - Icon */}
                                <View style={styles.tabIconContainer}>
                                    <Image
                                        source={tab.icon}
                                        style={[
                                            styles.tabIcon,
                                            activeTab === tab.id && styles.activeTabIcon
                                        ]}
                                    />
                                </View>

                                {/* Second Row - Name */}
                                <Text style={[
                                    styles.tabText,
                                    activeTab === tab.id && styles.activeTabText
                                ]} numberOfLines={1}>
                                    {tab.name}
                                </Text>

                                {/* Active Tab Indicator */}
                                {activeTab === tab.id && (
                                    <View style={[styles.activeTabIndicator, { backgroundColor: '#FFFFFF' }]} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Main Content */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={false}
                        onRefresh={loadUserData}
                        colors={[headerColor]}
                        tintColor={headerColor}
                    />
                }
            >

                {/* Mega Diwali Sale Banner with Integrated Categories */}
                <View style={[styles.saleBanner, { backgroundColor: headerColor }]}>
                    <View style={styles.saleContent}>
                        <Text style={styles.saleTitle}>Mega Diwali Sale</Text>

                        {/* Categories Section Integrated in Banner */}
                        <View style={styles.categoriesSection}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.categoriesScroll}
                            >
                                {categories.map((category, index) => {
                                    const url = category?.image || category?.icon;
                                    const imageSource = url ? {uri: `${API_BASE_URL}${url}`} : require("../../../assets/images/gifts.png");

                                    return (
                                        <TouchableOpacity
                                            key={category?._id || `category-${index}`}
                                            style={[styles.categoryCard, {backgroundColor: '#EAD3D3'}]}
                                            onPress={() => handleCategoryPress(category)}
                                        >
                                            <Text style={styles.categoryName}>
                                                {category?.name || "Category"}
                                            </Text>
                                            <Image
                                                source={imageSource}
                                                style={styles.categoryImage}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>

                </View>

                {/* Active Tab Products Section */}
                <View style={styles.tabProductsSection}>
                    <View style={styles.sectionHeaderWithButton}>
                        <Text style={styles.sectionTitle}>
                            {TAB_CATEGORIES.find(tab => tab.id === activeTab)?.name} Products
                        </Text>
                        <TouchableOpacity style={[styles.seeAllButton]}>
                            <Text style={styles.seeAllButtonText}>See All Products</Text>
                            <Image
                                source={require('../../../assets/icons/right-arrow.png')}
                                style={styles.seeAllArrow}
                            />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Loading products...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={currentTabProducts}
                            renderItem={renderTabProduct}
                            keyExtractor={(item) => item.id}
                            numColumns={2}
                            scrollEnabled={false}
                            contentContainerStyle={styles.tabProductsGrid}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>

                {/* Featured Products */}
                <View style={styles.productsSection}>
                    <View style={styles.sectionHeaderWithButton}>
                        <Text style={styles.sectionTitle}>Featured Products</Text>
                        <TouchableOpacity style={[styles.seeAllButton]}>
                            <Text style={styles.seeAllButtonText}>See All</Text>
                            <Image
                                source={require('../../../assets/icons/right-arrow.png')}
                                style={styles.seeAllArrow}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.productsScroll}
                    >
                        {featuredProducts.map((product) => {
                            const priceInfo = calculateProductPrice(product);
                            const productId = product._id || product.id;
                            const imageSource = product.image?.uri ? {uri: product.image.uri} : require("../../../assets/Rectangle 24904.png");

                            return (
                                <TouchableOpacity
                                    key={productId}
                                    style={styles.productCard}
                                    onPress={() => handleProductPress(product)}
                                >
                                    <Image
                                        source={imageSource}
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />

                                    <View style={styles.fragmentProductInfo}>
                                        <Text style={styles.fragmentProductName} numberOfLines={2}>
                                            {product.name}
                                        </Text>

                                        <View style={styles.rowBetween}>
                                            <View style={styles.leftPriceBox}>
                                                <Text style={styles.fragmentProductPrice}>
                                                    ₹{priceInfo.finalPrice}
                                                </Text>

                                                {priceInfo.hasDiscount && (
                                                    <View style={styles.discountBox}>
                                                        <Text style={styles.fragmentProductOriginalPrice}>
                                                            ₹{priceInfo.basePrice}
                                                        </Text>
                                                        <Text style={styles.discountBadge}>
                                                            {priceInfo.discountPercent}% OFF
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            <TouchableOpacity
                                                style={[styles.fragmentAddButton, addingToCart[productId] && styles.fragmentAddButtonDisabled]}
                                                disabled={addingToCart[productId]}
                                                onPress={() => handleAddToCart(product)}
                                            >
                                                <Text style={styles.fragmentAddButtonText}>
                                                    {addingToCart[productId] ? "ADDING..." : "ADD"}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Grocery & Kitchen Section */}
                <View style={styles.grocerySection}>
                    <View style={styles.sectionHeaderWithButton}>
                        <Text style={styles.sectionTitle}>Grocery & Kitchen</Text>
                        <TouchableOpacity style={[styles.seeAllButton]}>
                            <Text style={styles.seeAllButtonText}>See All</Text>
                            <Image
                                source={require('../../../assets/icons/right-arrow.png')}
                                style={styles.seeAllArrow}
                            />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.groceryScroll}
                    >
                        {groceryCategories.map((category, index) => {
                            const url = category?.image || category?.icon;
                            const imageSource = url ? {uri: `${API_BASE_URL}${url}`} : require("../../../assets/images/gifts.png");
                            console.log(category._id)
                            return (
                            <TouchableOpacity
                                key={category?._id || `category-${index}`}
                                style={styles.groceryCard}
                                onPress={() => handleCategorySelected(category)}
                            >
                                <View style={[styles.groceryImageContainer, {backgroundColor: category.color}]}>
                                    <Image
                                        source={imageSource}
                                        style={styles.groceryImage}
                                        resizeMode="contain"
                                    />
                                </View>
                                <Text style={styles.groceryName}>{category.name}</Text>
                            </TouchableOpacity>
                        )})}
                    </ScrollView>
                </View>

                {/* Add more space at the bottom */}
                <View style={styles.bottomSpacer}/>

            </ScrollView>

            {/* Category Fragment Modal */}
            <Modal
                visible={showCategoryFragment}
                animationType="slide"
                transparent={true}
                onRequestClose={closeCategoryFragment}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.halfScreenModal}>
                        <SafeAreaView style={styles.fragmentContainer}>
                            {/* Fragment Header */}
                            <View style={[styles.fragmentHeader]}>
                                <TouchableOpacity onPress={closeCategoryFragment} style={styles.fragmentCloseButton}>
                                    <Image
                                        source={require("../../../assets/icons/deleteIcon.png")}
                                        style={styles.fragmentCloseIcon}
                                    />
                                </TouchableOpacity>
                                <Text style={styles.fragmentHeaderTitle}>
                                    {selectedCategory?.name || 'Categories'}
                                </Text>
                                <View style={styles.fragmentHeaderPlaceholder}/>
                            </View>

                            <View style={styles.fragmentContent}>
                                {/* Left Column - Categories */}
                                <View style={styles.fragmentLeftColumn}>
                                    <ScrollView
                                        style={styles.fragmentCategoriesList}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        {categories.map((category) => {
                                            const url = category?.image || category?.icon;
                                            const imageSource = url ? {uri: `${API_BASE_URL}${url}`} : require("../../../assets/images/gifts.png");

                                            return (
                                                <TouchableOpacity
                                                    key={category._id}
                                                    style={[styles.fragmentCategoryItem, selectedCategory?._id === category._id && styles.fragmentSelectedCategoryItem]}
                                                    onPress={() => handleCategorySelect(category)}
                                                >
                                                    <View style={styles.fragmentCategoryContent}>
                                                        <Image
                                                            source={imageSource}
                                                            style={styles.fragmentCategoryImage}
                                                            resizeMode="cover"
                                                        />
                                                        <Text
                                                            style={[styles.fragmentCategoryName, selectedCategory?._id === category._id && styles.fragmentSelectedCategoryName]}
                                                            numberOfLines={2}
                                                        >
                                                            {category.name}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                {/* Right Column - Products */}
                                <View style={styles.fragmentRightColumn}>
                                    {fragmentLoading ? (
                                        <View style={styles.fragmentLoading}>
                                            <Text style={styles.fragmentLoadingText}>Loading products...</Text>
                                        </View>
                                    ) : categoryProducts.length === 0 ? (
                                        <View style={styles.fragmentEmpty}>
                                            <Image
                                                source={require("../../../assets/icons/empty-box.png")}
                                                style={styles.fragmentEmptyIcon}
                                            />
                                            <Text style={styles.fragmentEmptyText}>No products found</Text>
                                            <Text style={styles.fragmentEmptySubtext}>Try selecting another category</Text>
                                        </View>
                                    ) : (
                                        <FlatList
                                            data={categoryProducts}
                                            renderItem={renderFragmentProduct}
                                            keyExtractor={(item) => item._id || item.id}
                                            numColumns={2}
                                            showsVerticalScrollIndicator={false}
                                            contentContainerStyle={styles.fragmentProductsGrid}
                                        />
                                    )}
                                </View>
                            </View>
                        </SafeAreaView>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    tabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        flex: 1, backgroundColor: '#FFFFFF',
    },
    // Tab View Styles
    tabContainer: {
        paddingHorizontal: 16,
        paddingTop: 6,
    },
    tabScrollContent: {
        paddingRight: 16,
    },
    tabItem: {
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 8,

    },
    activeTabItem: {
        shadowColor: '#000',
    },
    tabIconContainer: {
        marginBottom: 4,
    },
    tabIcon: {
        width: 24,
        height: 24,
        tintColor: '#666',
    },
    activeTabIcon: {
        tintColor: '#FFFFFF',
    },
    tabText: {
        fontSize: 11,
        fontFamily: 'Poppins-SemiBold',
        color: '#666',
        textAlign: 'center',
    },
    activeTabText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
    },
    activeTabIndicator: {
        position: 'absolute',
        bottom: -8,
        left: '50%',
        marginLeft: -15,
        width: 30,
        height: 3,
        borderRadius: 2,
    },
    // Tab Products Section
    tabProductsSection: {
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 10,
    },
    tabProductsGrid: {
        paddingBottom: 10,
    },
    tabProductCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        margin: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    tabProductImage: {
        width: '100%',
        height: 100,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
    },
    tabProductInfo: {
        flex: 1,
    },
    tabProductName: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
        marginBottom: 6,
        lineHeight: 16,
        minHeight: 32,
    },
    tabProductPrice: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
    },
    tabProductOriginalPrice: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        color: '#999',
        textDecorationLine: 'line-through',
        marginLeft: 4,
    },
    tabAddButton: {
        borderWidth: 1,
        borderColor: '#27AF34',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    tabAddButtonText: {
        fontSize: 10,
        fontFamily: 'Poppins-SemiBold',
        color: '#27AF34',
    },
    tabAddButtonDisabled: {
        opacity: 0.6,
    },
    // Section Header with See All Button
    sectionHeaderWithButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    seeAllButtonText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#000000',
        marginRight: 4,
    },
    seeAllArrow: {
        width: 12,
        height: 12,
        tintColor: '#000000',
    },
    // Loading State
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        fontSize: 16,
        fontFamily: 'Poppins-Medium',
        color: '#666',
    },
    // Discount Badge
    discountBadge: {
        backgroundColor: '#FFE8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "Poppins-SemiBold",
        color: "#EC0505",
    },
    header: {
        paddingTop: 20,
        paddingBottom: 0,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    blinkitText: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        marginTop: 12
    },
    deliveryTimeBig: {
        fontFamily: 'Poppins',
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 30,
        letterSpacing: -0.3,
        color: '#FFFFFF',
    },
    profileButton: {
        padding: 4,
    },
    profileCircle: {
        width: 40,
        height: 40,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userIcon: {
        marginTop: 12,
        width: 15,
        height: 15,
        tintColor: '#FFFFFF',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    homeText: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
        letterSpacing: 1,
        color: '#FFFFFF',
        marginRight: 4,
    },
    dash: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        marginHorizontal: 4,
    },
    userAddress: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        flex: 1,
        marginRight: 8,
    },
    downArrow: {
        width: 10,
        height: 10,
        tintColor: '#FFFFFF',
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginTop: 10,
    },
    searchBarTouchable: {
        width: '100%',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 37,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#C5C5C5',
        paddingHorizontal: 12,
    },
    searchIcon: {
        width: 14,
        height: 14,
        marginRight: 8,
    },
    searchPlaceholder: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#9C9C9C',
        flex: 1,
    },
    separator: {
        width: 20,
        height: 0,
        borderWidth: 1,
        borderColor: '#C5C5C5',
        transform: [{rotate: '90deg'}],
        marginHorizontal: 8,
    },
    micIcon: {
        width: 14,
        height: 14,
    },
    scrollView: {
        flex: 1,
    },
    saleBanner: {
        height: 220,
        position: 'relative',
        overflow: 'hidden',
    },
    saleContent: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 20,
    },
    saleTitle: {
        fontFamily: 'PT Serif',
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 30,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 20,
    },
    saleImageRight: {
        position: 'absolute',
        right: 16,
        top: 20,
        width: 50,
        height: 47,
    },
    saleImageLeft: {
        position: 'absolute',
        left: 16,
        top: 20,
        width: 50,
        height: 47,
        transform: [{scaleX: -1}],
    },
    categoriesSection: {
        width: '100%',
    },
    categoriesScroll: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    categoryCard: {
        width: 90,
        height: 110,
        borderRadius: 12,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    categoryImage: {
        width: 70,
        height: 70,
        marginBottom: 6,
    },
    categoryName: {
        fontFamily: 'Poppins',
        fontSize: 10,
        fontWeight: '600',
        lineHeight: 14,
        letterSpacing: -0.3,
        color: '#000000',
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    productsSection: {
        paddingHorizontal: 15,
        marginTop: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        fontFamily: 'Poppins',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 24,
        letterSpacing: -0.3,
        color: '#000000',
    },
    productsScroll: {
        paddingRight: 15,
    },
    productCard: {
        width: 130,
        marginRight: 15,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    productImage: {
        width: '100%',
        height: 90,
        marginBottom: 10,
        borderRadius: 8,
    },
    grocerySection: {
        paddingHorizontal: 15,
        marginTop: 20,
        marginBottom: 20,
    },
    groceryScroll: {
        paddingRight: 15,
    },
    groceryCard: {
        alignItems: 'center',
        marginRight: 20,
        width: 80,
    },
    groceryImageContainer: {
        width: 80,
        height: 85,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    groceryImage: {
        width: 70,
        height: 70,
    },
    groceryName: {
        fontFamily: 'Poppins',
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 16,
        letterSpacing: -0.3,
        color: '#000000',
        textAlign: 'center',
    },
    bottomSpacer: {
        height: 100,
    },
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 30,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -4},
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    navLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#9C9C9C',
    },
    navItem: {
        alignItems: 'center',
        padding: 8,
    },
    navIcon: {
        width: 26,
        height: 26,
        tintColor: '#9C9C9C',
        marginBottom: 6,
    },
    activeNavIcon: {
        tintColor: '#000000',
    },
    activeIndicator: {
        width: 42,
        height: 3,
        borderRadius: 2,
        position: 'absolute',
        bottom: -8,
    },
    // Fragment styles remain the same...
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    halfScreenModal: {
        height: height * 0.75,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    fragmentContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    fragmentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    fragmentCloseButton: {
        padding: 8,
    },
    fragmentCloseIcon: {
        width: 20,
        height: 20,
        tintColor: '#000000',
    },
    fragmentHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000',
        fontFamily: 'Poppins-Bold',
    },
    fragmentHeaderPlaceholder: {
        width: 36,
    },
    fragmentContent: {
        flex: 1,
        flexDirection: 'row',
    },
    fragmentLeftColumn: {
        width: '25%',
        backgroundColor: '#F8F9FA',
        borderRightWidth: 1,
        borderRightColor: '#E8E8E8',
    },
    fragmentCategoriesList: {
        flex: 1,
    },
    fragmentCategoryItem: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8E8',
        backgroundColor: '#FFFFFF',
    },
    fragmentSelectedCategoryItem: {
        backgroundColor: '#FFF5F5',
        borderLeftWidth: 4,
        borderLeftColor: '#EC0505',
    },
    fragmentCategoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fragmentCategoryImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 8,
        backgroundColor: '#F5F5F5',
    },
    fragmentCategoryName: {
        fontSize: 11,
        color: '#666',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        lineHeight: 14,
        minHeight: 28,
    },
    fragmentSelectedCategoryName: {
        color: '#EC0505',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    fragmentRightColumn: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    fragmentLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    fragmentLoadingText: {
        fontSize: 16,
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    fragmentEmpty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 40,
    },
    fragmentEmptyIcon: {
        width: 80,
        height: 80,
        marginBottom: 16,
        opacity: 0.5,
    },
    fragmentEmptyText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#666',
        marginBottom: 8,
        textAlign: 'center',
    },
    fragmentEmptySubtext: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#999',
        textAlign: 'center',
    },
    fragmentProductsGrid: {
        padding: 14,
        paddingBottom: 100,
    },
    fragmentProductCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    fragmentLeftCard: {
        marginRight: 4,
    },
    fragmentRightCard: {
        marginLeft: 4,
    },
    fragmentProductImage: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
    },
    fragmentProductInfo: {
        flex: 1,
        marginBottom: 8,
    },
    fragmentProductName: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1B1B1B',
        marginBottom: 6,
        lineHeight: 16,
        fontFamily: 'Poppins-Medium',
        minHeight: 32,
    },
    fragmentProductPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1B1B1B',
        fontFamily: 'Poppins-Bold',
    },
    fragmentProductOriginalPrice: {
        fontSize: 12,
        color: '#999',
        textDecorationLine: 'line-through',
        marginLeft: 6,
        fontFamily: 'Poppins-Regular',
    },
    fragmentAddButton: {
        borderWidth: 1,
        borderColor: '#27AF34',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
    },
    fragmentAddButtonText: {
        fontFamily: 'Poppins',
        fontSize: 10,
        fontWeight: '600',
        lineHeight: 15,
        letterSpacing: -0.3,
        color: '#27AF34',
    },
    fragmentAddButtonDisabled: {
        opacity: 0.6,
    },
    rowBetween: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
    },
    leftPriceBox: {
        flexDirection: "column",
        maxWidth: "65%",
    },
    discountBox: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    businessBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#4CAD73',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    },
    businessBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'Poppins-Bold',
    },
    minQtyBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FF6B35',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    },
    minQtyText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'Poppins-Bold',
    },
    businessMinQty: {
        fontSize: 10,
        fontFamily: 'Poppins-Regular',
        color: '#FF6B35',
        marginTop: 2,
    },
});
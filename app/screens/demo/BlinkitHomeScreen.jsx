import React, {useState, useEffect, useCallback, useRef} from 'react';
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
    Animated, Platform
} from 'react-native';
import {useFocusEffect, useRouter} from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCategories, getProducts, getProductsByCategory, getSaleCategories} from "../../../api/catalogApi";
import {API_BASE_URL} from "../../../config/apiConfig";
import {getAddresses} from "../../../api/addressApi";
import {addCartItem, getCart, updateCartItem, removeCartItem, getTierPricing} from "../../../api/cartApi";
import * as Notifications from "expo-notifications";

const {width, height} = Dimensions.get('window');

const TAB_CATEGORIES = [{
    id: 'all', name: 'All', icon: require('../../../assets/icons/all.png'), color: '#4CAF72',
    headerColor: '#4CAF72', lightColor: '#CFF5DE'
}, {
    id: 'wedding', name: 'Wedding', icon: require('../../../assets/icons/wedding.png'), color: '#D84F80',
    headerColor: '#D84F80', lightColor: '#FFD6E5'
}, {
    id: 'winter', name: 'Winter', icon: require('../../../assets/icons/winter.png'), color: '#3A9AEF',
    headerColor: '#3A9AEF', lightColor: '#D8ECFF'
}, {
    id: 'electronics', name: 'Electronics', icon: require('../../../assets/icons/electronics.png'), color: '#33B5CC',
    headerColor: '#33B5CC', lightColor: '#D6F6FF'
}, {
    id: 'grocery', name: 'Grocery', icon: require('../../../assets/icons/grocery.png'), color: '#E89A23',
    headerColor: '#E89A23', lightColor: '#FFE8C8'
}, {
    id: 'fashion', name: 'Fashion', icon: require('../../../assets/icons/fashion.png'), color: '#A466E8',
    headerColor: '#A466E8', lightColor: '#E8D6FF'
}];

export default function BlinkitHomeScreen() {
    const router = useRouter();
    const [userAddress, setUserAddress] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('16 minutes');
    const [userName, setUserName] = useState('');
    const [categories, setCategories] = useState([]);
    const [salesCategories, setSalesCategories] = useState([]);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({});
    const [addingToCart, setAddingToCart] = useState({});
    const [groceryCategories, setGroceryCategories] = useState([]);
    const [showCategoryFragment, setShowCategoryFragment] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryProducts, setCategoryProducts] = useState([]);
    const [fragmentLoading, setFragmentLoading] = useState(false);
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [tierPricing, setTierPricing] = useState({});
    const [cartItems, setCartItems] = useState([]);
    const [showCartPopup, setShowCartPopup] = useState(true);
    const [cartPopupTimeout, setCartPopupTimeout] = useState(null);

    const slideAnim = useRef(new Animated.Value(-300)).current;
    // New state for tab view
    const [activeTab, setActiveTab] = useState('all');
    const [tabProducts, setTabProducts] = useState({});
    const [headerColor, setHeaderColor] = useState('#EC0505');

    // Animation values
    const [searchFocused, setSearchFocused] = useState(false);
    const searchAnim = useState(new Animated.Value(0))[0];
    const placeholderAnim = useState(new Animated.Value(1))[0];


    const requestNotificationPermission = async () => {
        // iOS + Android (API 33+)
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            Alert.alert("Permission Needed", "Please enable notifications.");
            return;
        }

        // Create Android channel (important)
        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
                name: "Default",
                importance: Notifications.AndroidImportance.MAX,
            });
        }

        console.log("Notification permission granted");
    };

    useEffect(() => {
        requestNotificationPermission();
        // Run on initial mount
        checkUserType();
        loadUserData();
        fetchCategories();
        loadFeaturedProducts();
        loadTabProducts('all');
    }, []);

    useFocusEffect(useCallback(() => {
        loadCartItems();
    }, []));

    useEffect(() => {
        if (showCartPopup && cartItems.length > 0) {
            Animated.timing(slideAnim, {
                toValue: 0, duration: 350, useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -300, duration: 350, useNativeDriver: true,
            }).start();
        }
    }, [showCartPopup, cartItems.length]);

    // Load cart items
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

            if (items.length > 0) {
                setShowCartPopup(true);
            } else {
                setShowCartPopup(false);
            }
        } catch (error) {
            console.error('Error loading cart items:', error);
            setCartItems([]);
        }
    };

    const getCartItemImages = () => {
        // If cart has items, show actual product images
        if (cartItems.length > 0) {
            return cartItems.slice(0, 1).map(item => {
                const imageUrl = item.product?.thumbnail || item.thumbnail || item.image;
                console.log(`${API_BASE_URL}${imageUrl}`)
                return imageUrl ? {uri: `${API_BASE_URL}${imageUrl}`} : require("../../../assets/Rectangle 24904.png");
            });
        } else {
            // If cart is empty, show placeholder images
            return [require("../../../assets/Rectangle 24904.png"), require("../../../assets/Rectangle 24904.png")];
        }
    };

    const getCartItemsCount = () => {
        return cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
    };

    const getCartTotal = () => {
        return cartItems.reduce((total, item) => {
            const price = item.product?.finalPrice || item.finalPrice || item.unitPrice || 0;
            const quantity = item.quantity || 1;
            return total + (price * quantity);
        }, 0);
    };

    // Get cart quantity for a product
    const getCartQuantity = (productId, variantId = null) => {
        const item = cartItems.find(cartItem => cartItem.productId === String(productId) && cartItem.variantId === (variantId ? String(variantId) : null));
        return item ? item.quantity : 0;
    };

    // Get cart item ID for update/remove operations
    const getCartItemId = (productId, variantId = null) => {
        const cartItem = cartItems.find(item => item.productId === String(productId) && item.variantId === (variantId ? String(variantId) : null));
        return cartItem?._id || cartItem?.id;
    };

    const checkUserType = async () => {
        try {
            const loginType = await AsyncStorage.getItem('loginType');
            const isBusiness = loginType === 'business';
            setIsBusinessUser(isBusiness);

            if (isBusiness) {
                await loadTierPricing();
            }
        } catch (error) {
            console.error('Error checking user type:', error);
        }
    };


    const loadTierPricing = async () => {
        if (!isBusinessUser) return;

        try {
            console.log('Loading tier pricing for business user...');
            const tierData = await getTierPricing();

            if (tierData && Array.isArray(tierData)) {
                // Organize tier pricing by productId and variantId for easy lookup
                const pricingMap = {};

                tierData.forEach(tier => {
                    const productId = tier.productId;
                    const variantId = tier.variantId || 'default';

                    if (!pricingMap[productId]) {
                        pricingMap[productId] = {};
                    }

                    if (!pricingMap[productId][variantId]) {
                        pricingMap[productId][variantId] = [];
                    }

                    pricingMap[productId][variantId].push({
                        minQty: tier.minQty,
                        maxQty: tier.maxQty || Infinity,
                        price: tier.price
                    });
                });

                setTierPricing(pricingMap);
                console.log('Tier pricing loaded successfully:', Object.keys(pricingMap).length, 'products with tier pricing');
            } else {
                console.log('No tier pricing data available');
            }
        } catch (error) {
            console.error('Error loading tier pricing:', error);
        }
    };

    useEffect(() => {
        const activeTabData = TAB_CATEGORIES.find(tab => tab.id === activeTab);
        if (activeTabData) {
            setHeaderColor(activeTabData.headerColor);
        }
    }, [activeTab]);

    useEffect(() => {
        Animated.parallel([Animated.timing(searchAnim, {
            toValue: searchFocused ? 1 : 0, duration: 300, useNativeDriver: false,
        }), Animated.timing(placeholderAnim, {
            toValue: searchFocused ? 0 : 1, duration: 200, useNativeDriver: false,
        })]).start();
    }, [searchFocused]);

    const searchBarWidth = searchAnim.interpolate({
        inputRange: [0, 1], outputRange: ['100%', '90%']
    });

    const searchBarMargin = searchAnim.interpolate({
        inputRange: [0, 1], outputRange: [0, -40]
    });

    const placeholderOpacity = placeholderAnim.interpolate({
        inputRange: [0, 1], outputRange: [0, 1]
    });

    const placeholderScale = placeholderAnim.interpolate({
        inputRange: [0, 1], outputRange: [0.8, 1]
    });

    // Load products for specific tab
    const loadTabProducts = async (tabId) => {
        try {
            setLoading(true);
            let products = [];

            const extractProducts = (response) => {
                if (!response) return [];
                if (Array.isArray(response)) return response;
                if (Array.isArray(response.data)) return response.data;
                if (Array.isArray(response.items)) return response.items;
                if (response.data && Array.isArray(response.data.items)) return response.data.items;
                if (response.success && Array.isArray(response.data?.data)) return response.data.data;
                return [];
            };

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

            let res;

            switch (tabId) {
                case 'all':
                    res = await getProducts({ page: 1, limit: 50 });
                    products = extractProducts(res);
                    break;

                case 'wedding':
                    res = await getProducts({ page: 1, limit: 50 });
                    products = filterProducts(extractProducts(res), [
                        'gift', 'wedding', 'marriage', 'ring', 'decoration',
                        'flower', 'bouquet', 'cake', 'card', 'invitation'
                    ]);
                    break;

                case 'winter':
                    res = await getProducts({ page: 1, limit: 50 });
                    products = filterProducts(extractProducts(res), [
                        'winter', 'cold', 'wool', 'sweater', 'jacket',
                        'gloves', 'scarf', 'heater', 'blanket', 'thermal'
                    ]);
                    break;

                case 'electronics':
                    res = await getProducts({ page: 1, limit: 50 });
                    products = filterProducts(extractProducts(res), [
                        'electronic', 'phone', 'mobile', 'laptop',
                        'computer', 'device', 'gadget', 'tech', 'smart', 'wireless'
                    ]);
                    break;

                case 'grocery':
                    res = await getProducts({ page: 1, limit: 50 });
                    products = filterProducts(extractProducts(res), [
                        'grocery', 'food', 'vegetable', 'fruit', 'rice',
                        'atta', 'dal', 'oil', 'spice', 'kitchen'
                    ]);
                    break;

                case 'fashion':
                    res = await getProducts({ page: 1, limit: 50 });
                    products = filterProducts(extractProducts(res), [
                        'fashion', 'clothes', 'dress', 'shirt', 'jeans',
                        'shoes', 'accessory', 'jewelry', 'watch', 'bag'
                    ]);
                    break;

                default:
                    res = await getProducts({ page: 1, limit: 50 });
                    products = extractProducts(res);
            }

            // 🔥 If filtered products are empty → load ALL products (but no dummy)
            if (!products.length) {
                const allRes = await getProducts({ page: 1, limit: 50 });
                products = extractProducts(allRes);
            }

            const processedProducts = products.map(p => processProductData(p, tabId));

            setTabProducts(prev => ({
                ...prev,
                [tabId]: processedProducts
            }));

        } catch (error) {
            console.error(`Error loading ${tabId} products:`, error);
        } finally {
            setLoading(false);
        }
    };


    const generateFallbackProducts = () => {
        return []; // No dummy items
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

            const category_products = productsData.map(item => processProductData(item));
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

    // Updated handleAddToCart function
    const handleAddToCart = async (product, isFragment = false) => {
        try {
            const productId = product.id || product._id;

            // Check minimum quantity for business users
            if (isBusinessUser && product.minQty && product.minQty > 1) {
                Alert.alert('Minimum Quantity Required', `Minimum order quantity for this product is ${product.minQty} units for business customers.`, [{text: 'OK'}]);
                return;
            }

            setAddingToCart(prev => ({...prev, [productId]: true}));

            const cartItem = {
                productId: productId, quantity: product.minQty || 1, variantId: product.variantId || null
            };

            await addCartItem(cartItem);
            await loadCartItems(); // Reload cart items after adding

        } catch (error) {
            console.error('Add to cart error:', error);

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

    // New function to handle quantity updates
    const handleUpdateQuantity = async (productId, variantId, newQuantity) => {
        try {
            const itemId = getCartItemId(productId, variantId);

            if (!itemId) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            if (newQuantity === 0) {
                await removeCartItem(productId, variantId);
                await loadCartItems();
            } else {
                await updateCartItem(itemId, newQuantity);
                await loadCartItems();
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            Alert.alert('Error', 'Failed to update quantity');
        }
    };

    const BusinessUserBadge = () => (<View style={styles.businessBadge}>
        <Text style={styles.businessBadgeText}>BUSINESS</Text>
    </View>);

    const handleFragmentProductPress = (product) => {
        closeCategoryFragment();
        router.push(`/screens/ProductDetailScreen?id=${product._id || product.id}`);
    };

    const handleCategoryPress = (category) => {
        openCategoryFragment(category);
    };

    const handleCategorySelected = (category) => {
        router.push({
            pathname: '/screens/ProductsScreen', params: {
                selectedCategory: category._id || category.id, categoryName: category.name
            }
        });
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

        // Use actual tier pricing for business users
        if (isBusinessUser) {
            const productId = product._id || product.id;
            const variantId = product.variantId || (product.variants?.[0]?._id) || null;
            const productTiers = getProductTierPricing(productId, variantId);

            if (productTiers.length > 0) {
                // Find applicable tier for the given quantity
                const applicableTier = productTiers.find(tier =>
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

                // If no tier found for quantity, use the first tier's min quantity
                const firstTier = productTiers[0];
                if (firstTier) {
                    return buildResponse(
                        firstTier.price,
                        firstTier.price,
                        null,
                        0,
                        firstTier.minQty
                    );
                }
            }
        }

        // Fallback to regular pricing
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


    // Updated renderFragmentProduct function with quantity controls
    const renderFragmentProduct = ({item, index}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = item._id || item.id;
        const cartQuantity = getCartQuantity(productId, item.variantId);
        const imageSource = item.image?.uri ? {uri: item.image.uri} : require("../../../assets/Rectangle 24904.png");

        return (<TouchableOpacity
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

                        {priceInfo.hasDiscount && (<View style={styles.discountBox}>
                            <Text style={styles.fragmentProductOriginalPrice}>
                                ₹{priceInfo.basePrice}
                            </Text>
                            <Text style={styles.discountBadge}>
                                {priceInfo.discountPercent}% OFF
                            </Text>
                        </View>)}
                    </View>
                </View>
                <View style={styles.rowBetween}>
                    {cartQuantity > 0 ? (<View style={styles.quantityControl}>
                        <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleUpdateQuantity(productId, item.variantId, cartQuantity - 1)}
                        >
                            <Text style={styles.quantityMinus}>-</Text>
                        </TouchableOpacity>

                        <Text style={styles.quantityText}>{cartQuantity}</Text>

                        <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleUpdateQuantity(productId, item.variantId, cartQuantity + 1)}
                        >
                            <Text style={styles.quantityPlus}>+</Text>
                        </TouchableOpacity>
                    </View>) : (<TouchableOpacity
                        style={[styles.fragmentAddButton, addingToCart[productId] && styles.fragmentAddButtonDisabled]}
                        disabled={addingToCart[productId]}
                        onPress={() => handleAddToCart(item, true)}
                    >
                        <Text style={styles.fragmentAddButtonText}>
                            {addingToCart[productId] ? "ADDING..." : "ADD"}
                        </Text>
                    </TouchableOpacity>)}
                </View>
            </View>
        </TouchableOpacity>);
    };

    const getProductTierPricing = (productId, variantId = null) => {
        const variantKey = variantId || 'default';
        return tierPricing[productId]?.[variantKey] || [];
    };

    const renderTabProduct = ({item}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = item.id;
        const cartQuantity = getCartQuantity(productId, item.variantId);
        const imageSource = item.image?.uri ? {uri: item.image.uri} : require("../../../assets/Rectangle 24904.png");
        const productTiers = getProductTierPricing(productId, item.variantId);

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

                            {isBusinessUser && priceInfo.minQty > 1 && (
                                <Text style={styles.businessMinQty}>
                                    Min. {priceInfo.minQty} units
                                </Text>
                            )}

                            {/* Show tier pricing info for business users */}
                            {isBusinessUser && productTiers.length > 0 && (
                                <Text style={styles.tierPricingInfo}>
                                    {productTiers.length} tier{productTiers.length > 1 ? 's' : ''} available
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.rowBetween}>
                        {cartQuantity > 0 ? (
                            <View style={styles.quantityControl}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(productId, item.variantId, cartQuantity - 1)}
                                >
                                    <Text style={styles.quantityMinus}>-</Text>
                                </TouchableOpacity>

                                <Text style={styles.quantityText}>{cartQuantity}</Text>

                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(productId, item.variantId, cartQuantity + 1)}
                                >
                                    <Text style={styles.quantityPlus}>+</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.tabAddButton, addingToCart[productId] && styles.tabAddButtonDisabled]}
                                disabled={addingToCart[productId]}
                                onPress={() => handleAddToCart(item)}
                            >
                                <Text style={styles.tabAddButtonText}>
                                    {addingToCart[productId] ? "..." : "ADD"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Rest of your existing functions (fetchCategories, loadUserData, etc.) remain the same
    const fetchCategories = async () => {
        try {
            setLoading(true);

            // Fetch normal categories
            const categoryRes = await getCategories({status: true, limit: 100});

            // Fetch sale categories
            const saleRes = await getSaleCategories({limit: 100});

            // Handle categories
            let categoryList = [];
            if (categoryRes?.success) {
                // Some APIs return { success, data: [] }
                if (Array.isArray(categoryRes.data)) {
                    categoryList = categoryRes.data;
                }
                // Some return { success, data: { data: [] } }
                else if (Array.isArray(categoryRes.data?.data)) {
                    categoryList = categoryRes.data.data;
                }
            }

            // Handle sale categories
            let saleCategoryList = [];
            if (saleRes?.success) {
                if (Array.isArray(saleRes.data)) {
                    saleCategoryList = saleRes.data;
                } else if (Array.isArray(saleRes.data?.data)) {
                    saleCategoryList = saleRes.data.data;
                }
            }

            setSalesCategories(saleCategoryList)
            // Save categories to state
            setCategories(categoryList);
            setGroceryCategories(categoryList);

        } catch (err) {
            console.error("Error fetching categories", err);
        } finally {
            setLoading(false);
        }
    };

    const loadUserData = async () => {
        try {
            let hasValidAddress = false;

            try {
                const addressesResponse = await getAddresses();

                const addresses = extractAddressesFromResponse(addressesResponse);

                if (addresses.length > 0) {
                    const defaultAddress = findDefaultAddress(addresses);
                    await saveAddressToStorage(defaultAddress);
                    hasValidAddress = true;
                }
            } catch (apiError) {
                console.warn('Could not fetch addresses from API, using stored data:', apiError);
            }

            if (!hasValidAddress) {
                const storedAddress = await loadAddressFromStorage();
                if (storedAddress) {
                    setUserAddress(formatAddress(storedAddress));
                    hasValidAddress = true;
                }
            }

            if (!hasValidAddress) {
                setUserAddress('Select delivery address');
            }

            await loadUserName();
            setRandomDeliveryTime();

        } catch (error) {
            console.error('Error in loadUserData:', error);
            setFallbackUserData();
        }
    };

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
        return addresses.find(addr => addr.isDefault === true) || addresses.find(addr => addr.is_default === true) || addresses.find(addr => addr.default === true) || addresses[0];
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

        const parts = [address.address, address.landmark, address.city].filter(part => part && part.trim() !== '');

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
        const minutes = Math.floor(Math.random() * 4320) + 15;
        // 15 mins to 3 days

        let label = "";

        if (minutes < 1440) {
            // Convert to hours only
            const hours = Math.max(1, Math.floor(minutes / 60));
            label = hours === 1 ? "1 hour" : `${hours} hours`;
        } else {
            // Convert to days
            const days = Math.floor(minutes / 1440);
            label = days === 1 ? "1 day" : `${days} days`;
        }

        setDeliveryTime(label);
    };

    const setFallbackUserData = () => {
        setUserAddress("Select delivery address");
        setUserName("Guest User");
        setDeliveryTime("1 hour");
    };

    const processProductData = (product, tabId = 'all') => {
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
            variantId: product.variants?.[0]?._id || null,
            minQty: priceInfo.minQty || 1,
            // Add tier pricing info for business users
            tierPricing: isBusinessUser ? getProductTierPricing(id, product.variants?.[0]?._id) : []
        };
    };

    async function loadFeaturedProducts() {
        try {
            setLoading(true);
            const res = await getProducts({page: 1, limit: 10});
            const payload = res?.data ?? res;
            const items = Array.isArray(payload) ? payload : (payload?.items || payload?.data?.items || []);

            const featured = items.map(item => processProductData(item));
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

    // Pick products from the active tab or fall back to featured
    const currentTabProducts = (tabProducts[activeTab] || featuredProducts).slice(0, 4);

    const activeTabData = TAB_CATEGORIES.find(tab => tab.id === activeTab);

    function handleNotification() {
        router.push("/screens/NotificationScreen");
    }

    const renderFeaturedProduct = (product) => {
        const priceInfo = calculateProductPrice(product);
        const productId = product._id || product.id;
        const cartQuantity = getCartQuantity(productId, product.variantId);
        const imageSource = product.image?.uri ? {uri: product.image.uri} : require("../../../assets/Rectangle 24904.png");

        return (<TouchableOpacity
            key={productId}
            style={styles.productCard}
            onPress={() => handleProductPress(product)}
        >
            {/* Product Image */}
            <Image
                source={imageSource}
                style={styles.productImage}
                resizeMode="cover"
            />

            {/* Product Info */}
            <View style={styles.fragmentProductInfo}>
                <Text style={styles.fragmentProductName} numberOfLines={2}>
                    {product.name}
                </Text>

                {/* Price Section */}
                <View style={styles.leftPriceBox}>
                    <Text style={styles.fragmentProductPrice}>
                        ₹{priceInfo.finalPrice}
                    </Text>

                    {priceInfo.hasDiscount && (<View style={styles.discountBox}>
                        <Text style={styles.fragmentProductOriginalPrice}>
                            ₹{priceInfo.basePrice}
                        </Text>
                        <Text style={styles.discountBadge}>
                            {priceInfo.discountPercent}% OFF
                        </Text>
                    </View>)}
                </View>

                {/* Quantity / Add Button at Bottom */}
                <View style={styles.bottomQuantityContainer}>
                    {cartQuantity > 0 ? (<View style={styles.quantityControl}>
                        <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleUpdateQuantity(productId, product.variantId, cartQuantity - 1)}
                        >
                            <Text style={styles.quantityMinus}>-</Text>
                        </TouchableOpacity>

                        <Text style={styles.quantityText}>{cartQuantity}</Text>

                        <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleUpdateQuantity(productId, product.variantId, cartQuantity + 1)}
                        >
                            <Text style={styles.quantityPlus}>+</Text>
                        </TouchableOpacity>
                    </View>) : (<TouchableOpacity
                        style={[styles.fragmentAddButton, addingToCart[productId] && styles.fragmentAddButtonDisabled,]}
                        disabled={addingToCart[productId]}
                        onPress={() => handleAddToCart(product)}
                    >
                        <Text style={styles.fragmentAddButtonText}>
                            {addingToCart[productId] ? "ADDING..." : "ADD"}
                        </Text>
                    </TouchableOpacity>)}
                </View>
            </View>
        </TouchableOpacity>);
    };

    const handleCartPopupClick = () => {
        router.push('/screens/CartScreen');
    };

    return (<SafeAreaView style={styles.container}>
        <StatusBar backgroundColor={headerColor} barStyle="light-content"/>

        {/* Header Section with Dynamic Background */}
        <View style={[styles.header, {backgroundColor: headerColor}]}>
            {/* Top Row */}
            <View style={styles.topRow}>
                <View style={styles.deliveryInfo}>
                    <Text style={styles.blinkitText}>Healthy Choice</Text>
                </View>
            </View>

            {/*/!* Delivery Time *!/*/}
            {/*<View style={styles.addressRow}>*/}
            {/*    <Text style={styles.deliveryTimeBig}>*/}
            {/*        {deliveryTime}*/}
            {/*    </Text>*/}
            {/*</View>*/}

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
                    <Animated.View style={[styles.searchBar, {
                        width: searchBarWidth, marginLeft: searchBarMargin
                    }]}>
                        <Image
                            source={require('../../../assets/icons/search.png')}
                            style={styles.searchIcon}
                        />
                        <Animated.Text
                            style={[styles.searchPlaceholder, {
                                opacity: placeholderOpacity, transform: [{scale: placeholderScale}]
                            }]}
                        >
                            Search "ice-cream"
                        </Animated.Text>
                        {/*<View style={styles.separator}/>*/}
                        {/*<Image*/}
                        {/*    source={require('../../../assets/icons/mic.png')}*/}
                        {/*    style={styles.micIcon}*/}
                        {/*/>*/}
                    </Animated.View>
                </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabScrollContent}
                >
                    {TAB_CATEGORIES.map((tab) => (<TouchableOpacity
                        key={tab.id}
                        style={[styles.tabItem, activeTab === tab.id && [styles.activeTabItem, {backgroundColor: tab.color}]]}
                        onPress={() => handleTabPress(tab.id)}
                    >
                        <View style={styles.tabIconContainer}>
                            <Image
                                source={tab.icon}
                                style={[styles.tabIcon, activeTab === tab.id && styles.activeTabIcon]}
                            />
                        </View>

                        <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}
                              numberOfLines={1}>
                            {tab.name}
                        </Text>

                        {activeTab === tab.id && (
                            <View style={[styles.activeTabIndicator, {backgroundColor: '#FFFFFF'}]}/>)}
                    </TouchableOpacity>))}
                </ScrollView>
            </View>
        </View>

        {/* Main Content */}
        <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl
                refreshing={false}
                onRefresh={loadUserData}
                colors={[headerColor]}
                tintColor={headerColor}
            />}
        >

            {/* Mega Diwali Sale Banner with Integrated Categories */}
            <View style={[styles.saleBanner, {backgroundColor: headerColor}]}>
                <View style={styles.saleContent}>
                    <Text style={styles.saleTitle}>Mega Diwali Sale</Text>

                    <View style={styles.categoriesSection}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoriesScroll}
                        >
                            {salesCategories.map((category, index) => {
                                const url = category?.image || category?.icon;
                                const imageSource = url ? {uri: `${API_BASE_URL}${url}`} : require("../../../assets/images/gifts.png");

                                return (<TouchableOpacity
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
                                </TouchableOpacity>);
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
                    <TouchableOpacity
                        style={styles.seeAllButton}
                        onPress={() => router.push('/screens/AllProductsScreen')}
                    >
                        <Text style={styles.seeAllButtonText}>See All Products</Text>
                        <Image
                            source={require('../../../assets/icons/right-arrow.png')}
                            style={styles.seeAllArrow}
                        />
                    </TouchableOpacity>
                </View>

                {loading ? (<View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading products...</Text>
                </View>) : (<FlatList
                    data={currentTabProducts}
                    renderItem={renderTabProduct}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    scrollEnabled={false}
                    contentContainerStyle={styles.tabProductsGrid}
                    showsVerticalScrollIndicator={false}
                />)}
            </View>

            {/* Featured Products */}
            <View style={styles.productsSection}>
                <View style={styles.sectionHeaderWithButton}>
                    <Text style={styles.sectionTitle}>Featured Products</Text>
                    <TouchableOpacity
                        style={styles.seeAllButton}
                        onPress={() => router.push('/screens/AllProductsScreen')}
                    >
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
                    {featuredProducts.map((product) => renderFeaturedProduct(product))}
                </ScrollView>
            </View>

            {/* Grocery & Kitchen Section */}
            <View style={styles.grocerySection}>
                <View style={styles.sectionHeaderWithButton}>
                    <Text style={styles.sectionTitle}>Grocery & Kitchen</Text>
                    <TouchableOpacity
                        style={styles.seeAllButton}
                        onPress={() => router.push('/screens/AllCategoriesScreen')}
                    >
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
                        return (<TouchableOpacity
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
                        </TouchableOpacity>)
                    })}
                </ScrollView>
            </View>

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
                            <View style={styles.fragmentLeftColumn}>
                                <ScrollView
                                    style={styles.fragmentCategoriesList}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {categories.map((category) => {
                                        const url = category?.image || category?.icon;
                                        const imageSource = url ? {uri: `${API_BASE_URL}${url}`} : require("../../../assets/images/gifts.png");

                                        return (<TouchableOpacity
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
                                        </TouchableOpacity>);
                                    })}
                                </ScrollView>
                            </View>

                            <View style={styles.fragmentRightColumn}>
                                {fragmentLoading ? (<View style={styles.fragmentLoading}>
                                    <Text style={styles.fragmentLoadingText}>Loading products...</Text>
                                </View>) : categoryProducts.length === 0 ? (<View style={styles.fragmentEmpty}>
                                    <Image
                                        source={require("../../../assets/icons/empty-box.png")}
                                        style={styles.fragmentEmptyIcon}
                                    />
                                    <Text style={styles.fragmentEmptyText}>No products found</Text>
                                    <Text style={styles.fragmentEmptySubtext}>Try selecting another
                                        category</Text>
                                </View>) : (<FlatList
                                    data={categoryProducts}
                                    renderItem={renderFragmentProduct}
                                    keyExtractor={(item) => item._id || item.id}
                                    numColumns={2}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={styles.fragmentProductsGrid}
                                />)}
                            </View>
                        </View>
                    </SafeAreaView>
                </View>
            </View>
        </Modal>

        {/* Cart Popup - Only show when cart has items */}
        {showCartPopup && cartItems.length > 0 && (<Animated.View
            style={[styles.cartPopupContainer, {transform: [{translateX: slideAnim}]}]}
        >
            <TouchableOpacity
                style={styles.cartPopup}
                activeOpacity={0.9}
                onPress={handleCartPopupClick}
            >
                <View style={styles.cartPopupContent}>

                    <View style={styles.cartImagesContainer}>
                        {getCartItemImages().map((imageSource, index) => (<Image
                            key={index}
                            source={imageSource}
                            style={[styles.cartItemImage, {zIndex: 3 - index}]}
                            resizeMode="cover"
                        />))}

                        {cartItems.length > 1 && (<View style={styles.moreItemsBadge}>
                            <Text style={styles.moreItemsText}>
                                +{cartItems.length - 1}
                            </Text>
                        </View>)}
                    </View>

                    <View style={styles.cartInfo}>
                        <Text style={styles.cartItemsCount}>
                            View in cart
                        </Text>
                    </View>

                </View>
            </TouchableOpacity>
        </Animated.View>)}

    </SafeAreaView>);
}

const styles = StyleSheet.create({
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        paddingHorizontal: 8,
        borderColor: '#27AF34',
        paddingVertical: 6,
    },

    quantityMinus: {
        fontSize: 15, color: '#666', fontWeight: 'bold', textAlign: 'center',
    },

    quantityPlus: {
        fontSize: 15, color: '#171717', fontWeight: 'bold', textAlign: 'center',
    },

    quantityText: {
        fontSize: 12, fontWeight: '600', color: '#1B1B1B', marginHorizontal: 12, minWidth: 20, textAlign: 'center',
    }, tabContent: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    }, container: {
        flex: 1, backgroundColor: '#FFFFFF',
    }, tabContainer: {
        paddingHorizontal: 16, paddingTop: 6,
    }, tabScrollContent: {
        paddingRight: 16,
    }, tabItem: {
        alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginRight: 8,
    }, activeTabItem: {
        shadowColor: '#000',
    }, tabIconContainer: {
        marginBottom: 4,
    }, tabIcon: {
        width: 20, height: 20, tintColor: '#000',
    }, activeTabIcon: {
        tintColor: '#FFFFFF',
    }, tabText: {
        fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#000', textAlign: 'center',
    }, activeTabText: {
        fontSize: 13, fontWeight: 'bold', color: '#FFFFFF', fontFamily: 'Poppins-Bold',
    }, activeTabIndicator: {
        position: 'absolute', bottom: -8, left: '50%', marginLeft: -15, width: 30, height: 3, borderRadius: 2,
    }, tabProductsSection: {
        paddingHorizontal: 16, marginTop: 20, marginBottom: 10,
    }, tabProductsGrid: {
        paddingBottom: 10,
    }, tabProductCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        margin: 6,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    }, tabProductImage: {
        width: '100%', height: 100, borderRadius: 8, marginBottom: 8, backgroundColor: '#F8F9FA',
    }, tabProductInfo: {
        flex: 1,
    }, tabProductName: {
        fontSize: 12, fontFamily: 'Poppins-Medium', color: '#1B1B1B', marginBottom: 6, lineHeight: 16, minHeight: 32,
    }, tabProductPrice: {
        fontSize: 14, fontFamily: 'Poppins-Bold', color: '#1B1B1B',
    }, tabProductOriginalPrice: {
        fontSize: 11, fontFamily: 'Poppins-Regular', color: '#999', textDecorationLine: 'line-through', marginLeft: 4,
    }, tabAddButton: {
        borderWidth: 1, borderColor: '#27AF34', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 12,
    }, tabAddButtonText: {
        fontSize: 10, fontFamily: 'Poppins-SemiBold', color: '#27AF34',
    }, tabAddButtonDisabled: {
        opacity: 0.6,
    }, sectionHeaderWithButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
    }, seeAllButton: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    }, seeAllButtonText: {
        fontSize: 12, fontFamily: 'Poppins-SemiBold', color: '#000000', marginRight: 4,
    }, seeAllArrow: {
        width: 12, height: 12, tintColor: '#000000',
    }, loadingContainer: {
        alignItems: 'center', justifyContent: 'center', padding: 40,
    }, loadingText: {
        fontSize: 16, fontFamily: 'Poppins-Medium', color: '#666',
    }, discountBadge: {
        backgroundColor: '#FFE8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "Poppins-SemiBold",
        color: "#EC0505",
    }, header: {
        paddingTop: 20, paddingBottom: 0,
    }, topRow: {
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16,
    }, blinkitText: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        marginTop: 12
    }, deliveryTimeBig: {
        fontFamily: 'Poppins', fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3, color: '#FFFFFF',
    }, profileButton: {
        padding: 4,
    }, profileCircle: {
        width: 40, height: 40, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    }, userIcon: {
        marginTop: 12, width: 15, height: 15, tintColor: '#FFFFFF',
    }, addressRow: {
        flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16,
    }, homeText: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
        letterSpacing: 1,
        color: '#FFFFFF',
        marginRight: 4,
    }, dash: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        marginHorizontal: 4,
    }, userAddress: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        flex: 1,
        marginRight: 8,
    }, downArrow: {
        width: 10, height: 10, tintColor: '#FFFFFF',
    }, searchContainer: {
        paddingHorizontal: 16, marginTop: 10,
    }, searchBarTouchable: {
        width: '100%',
    }, searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#C5C5C5',
        paddingHorizontal: 12,
    }, searchIcon: {
        width: 14, height: 14, marginRight: 8,
    }, searchPlaceholder: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 18,
        letterSpacing: -0.3,
        color: '#9C9C9C',
        flex: 1,
    }, separator: {
        width: 20,
        height: 0,
        borderWidth: 1,
        borderColor: '#C5C5C5',
        transform: [{rotate: '90deg'}],
        marginHorizontal: 8,
    }, micIcon: {
        width: 14, height: 14,
    }, scrollView: {
        flex: 1,
    }, saleBanner: {
        height: 220, position: 'relative', overflow: 'hidden',
    }, saleContent: {
        flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 20,
    }, saleTitle: {
        fontFamily: 'PT Serif',
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 30,
        letterSpacing: -0.3,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 20,
    }, saleImageRight: {
        position: 'absolute', right: 16, top: 20, width: 50, height: 47,
    }, saleImageLeft: {
        position: 'absolute', left: 16, top: 20, width: 50, height: 47, transform: [{scaleX: -1}],
    }, categoriesSection: {
        width: '100%',
    }, categoriesScroll: {
        paddingHorizontal: 15, paddingVertical: 10,
    }, categoryCard: {
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
    }, categoryImage: {
        width: 70, height: 70, marginBottom: 6,
    }, categoryName: {
        fontFamily: 'Poppins',
        fontSize: 10,
        fontWeight: '600',
        lineHeight: 14,
        letterSpacing: -0.3,
        color: '#000000',
        textAlign: 'center',
        paddingHorizontal: 4,
    }, productsSection: {
        paddingHorizontal: 15, marginTop: 20, marginBottom: 10,
    }, sectionTitle: {
        fontFamily: 'Poppins', fontSize: 15, fontWeight: '700', lineHeight: 24, letterSpacing: -0.3, color: '#000000',
    }, productsScroll: {
        paddingRight: 15,
    }, productCard: {
        width: 130,
        marginRight: 15,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
    }, productImage: {
        width: '100%', height: 90, marginBottom: 10, borderRadius: 8,
    }, grocerySection: {
        paddingHorizontal: 15, marginTop: 20, marginBottom: 20,
    }, groceryScroll: {
        paddingRight: 15,
    }, groceryCard: {
        alignItems: 'center', marginRight: 20, width: 80,
    }, groceryImageContainer: {
        width: 80, height: 85, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    }, groceryImage: {
        width: 70, height: 70,
    }, groceryName: {
        fontFamily: 'Poppins',
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 16,
        letterSpacing: -0.3,
        color: '#000000',
        textAlign: 'center',
    }, bottomSpacer: {
        height: 100,
    }, bottomNav: {
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
    }, navLine: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: '#9C9C9C',
    }, navItem: {
        alignItems: 'center', padding: 8,
    }, navIcon: {
        width: 26, height: 26, tintColor: '#9C9C9C', marginBottom: 6,
    }, activeNavIcon: {
        tintColor: '#000000',
    }, activeIndicator: {
        width: 42, height: 3, borderRadius: 2, position: 'absolute', bottom: -8,
    }, modalOverlay: {
        flex: 1, justifyContent: 'flex-end',
    }, halfScreenModal: {
        height: height * 0.75,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    }, fragmentContainer: {
        flex: 1, backgroundColor: '#FFFFFF',
    }, fragmentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    }, fragmentCloseButton: {
        padding: 8,
    }, fragmentCloseIcon: {
        width: 20, height: 20, tintColor: '#000000',
    }, fragmentHeaderTitle: {
        fontSize: 16, fontWeight: '700', color: '#000000', fontFamily: 'Poppins-Bold',
    }, fragmentHeaderPlaceholder: {
        width: 36,
    }, fragmentContent: {
        flex: 1, flexDirection: 'row',
    }, fragmentLeftColumn: {
        width: '25%', backgroundColor: '#F8F9FA', borderRightWidth: 1, borderRightColor: '#E8E8E8',
    }, fragmentCategoriesList: {
        flex: 1,
    }, fragmentCategoryItem: {
        paddingVertical: 16, paddingHorizontal: 12, borderBottomColor: '#4CAD73', backgroundColor: '#FFFFFF',
    }, fragmentSelectedCategoryItem: {
        backgroundColor: '#FFF5F5', borderRightWidth: 4, borderRadius: 4, borderRightColor: '#4CAD73',
    }, fragmentCategoryContent: {
        alignItems: 'center', justifyContent: 'center',
    }, fragmentCategoryImage: {
        width: 50, height: 50, borderRadius: 25, marginBottom: 8, backgroundColor: '#F5F5F5',
    }, fragmentCategoryName: {
        fontSize: 11, color: '#666', textAlign: 'center', fontFamily: 'Poppins-Regular', lineHeight: 14, minHeight: 28,
    }, fragmentSelectedCategoryName: {
        color: '#EC0505', fontWeight: '600', fontFamily: 'Poppins-SemiBold',
    }, fragmentRightColumn: {
        flex: 1, backgroundColor: '#FFFFFF',
    }, fragmentLoading: {
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF',
    }, fragmentLoadingText: {
        fontSize: 14, color: '#666', fontFamily: 'Poppins-Medium',
    }, fragmentEmpty: {
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 40,
    }, fragmentEmptyIcon: {
        width: 80, height: 80, marginBottom: 16, opacity: 0.5,
    }, fragmentEmptyText: {
        fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#666', marginBottom: 8, textAlign: 'center',
    }, fragmentEmptySubtext: {
        fontSize: 12, fontFamily: 'Poppins-Regular', color: '#999', textAlign: 'center',
    }, fragmentProductsGrid: {
        padding: 14, paddingBottom: 100,
    }, fragmentProductCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    }, fragmentLeftCard: {
        marginRight: 4,
    }, fragmentRightCard: {
        marginLeft: 4,
    }, fragmentProductImage: {
        width: '100%', height: 120, borderRadius: 8, marginBottom: 8, backgroundColor: '#F8F9FA',
    }, fragmentProductInfo: {
        flex: 1, marginBottom: 8,
    }, fragmentProductName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#1B1B1B',
        marginBottom: 6,
        lineHeight: 16,
        fontFamily: 'Poppins-Medium',
        minHeight: 32,
    }, fragmentProductPrice: {
        fontSize: 14, fontWeight: '700', color: '#1B1B1B', fontFamily: 'Poppins-Bold',
    }, fragmentProductOriginalPrice: {
        fontSize: 12, color: '#999', textDecorationLine: 'line-through', marginLeft: 6, fontFamily: 'Poppins-Regular',
    }, fragmentAddButton: {
        borderWidth: 1,
        borderColor: '#27AF34',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
    }, fragmentAddButtonText: {
        fontFamily: 'Poppins', fontSize: 10, fontWeight: '600', lineHeight: 15, letterSpacing: -0.3, color: '#27AF34',
    }, fragmentAddButtonDisabled: {
        opacity: 0.6,
    }, rowBetween: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginLeft: 6
    }, leftPriceBox: {
        flexDirection: "column", maxWidth: "65%",
    }, discountBox: {
        flexDirection: "row", alignItems: "center", marginTop: 2,
    }, businessBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#4CAD73',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    }, businessBadgeText: {
        color: '#FFFFFF', fontSize: 8, fontFamily: 'Poppins-Bold',
    }, minQtyBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FF6B35',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    }, minQtyText: {
        color: '#FFFFFF', fontSize: 8, fontFamily: 'Poppins-Bold',
    }, businessMinQty: {
        fontSize: 10, fontFamily: 'Poppins-Regular', color: '#FF6B35', marginTop: 2,
    }, bottomQuantityContainer: {
        borderTopColor: '#eee',
        paddingTop: 10,
        paddingBottom: 4,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    }, cartPopupContainer: {
        position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', zIndex: 1000,
    },

    cartPopup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        paddingVertical: 10,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 8,
        borderColor: '#F0F0F0',
        minWidth: 220,
        justifyContent: 'center',
        alignItems: 'center',
    },

    cartPopupContent: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',   // center inside box
    },

    cartImagesContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', marginRight: 10,
    },

    cartItemImage: {
        width: 36, height: 36, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF', marginLeft: -10,
    },

    moreItemsBadge: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#4CAD73',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -10,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },

    moreItemsText: {
        color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', fontFamily: 'Poppins-Bold',
    },

    cartInfo: {
        justifyContent: 'center', alignItems: 'center', marginLeft: 8,
    },

    cartItemsCount: {
        fontSize: 15, fontFamily: 'Poppins-SemiBold', color: '#1B1B1B',
    },
    tierPricingInfo: {
        fontSize: 9,
        fontFamily: 'Poppins-Regular',
        color: '#4CAD73',
        marginTop: 2,
        fontStyle: 'italic',
    },
});
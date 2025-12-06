import {useRouter} from "expo-router";
import React, {useEffect, useState, useCallback, useRef, memo} from "react";
import {
    Alert, Image, ScrollView, StyleSheet, Text, TextInput, Pressable, View, Dimensions,
    FlatList, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, Platform, Keyboard, SafeAreaView, StatusBar,
    RefreshControl, ActivityIndicator
} from "react-native";
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    applyCoupon as applyCouponApi,
    getCart,
    removeCartItem,
    removeCoupon as removeCouponApi,
    updateCartItem as updateCartItemApi,
    createBulkNegotiation,
    getTierPricing,
    applyTierPricing,
} from '../../api/cartApi';
import {API_BASE_URL} from '../../config/apiConfig';
import {getWishlist, removeFromWishlist} from '../../api/catalogApi';
import {getOrCreateSessionId, getUserType} from "../../api/sessionManager";

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

// Memoized Cart Item Component for better performance
const CartItem = memo(({
                           item,
                           isBusinessUser,
                           tierPricing,
                           updatingItems,
                           stockValidation,
                           onUpdateQuantity,
                           onRemoveItem,
                           onOpenNegotiation
                       }) => {
    const itemValidation = stockValidation[item.id] || {};
    const canIncrease = itemValidation.canIncrease !== false;
    const canDecrease = itemValidation.canDecrease !== false;
    const isOutOfStock = !item.isAvailable;
    const maxReached = item.quantity >= Math.min(item.currentStock, item.maxOrderQty);

    return (
        <View style={[styles.cartItem, isOutOfStock && styles.outOfStockItem]}>
            {isOutOfStock && (
                <View style={styles.outOfStockOverlay}>
                    <Text style={styles.outOfStockText}>Out of Stock</Text>
                </View>
            )}

            <View style={styles.itemLeft}>
                <View style={styles.productImage}>
                    <Image
                        source={item.imageUrl ? {uri: `${API_BASE_URL}${item.imageUrl}`} : require("../../assets/sample-product.png")}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </View>
                <View style={styles.productInfo}>
                    <Text style={[styles.productName, isOutOfStock && styles.disabledText]}
                          numberOfLines={2}>{item.name}</Text>
                    <Text style={[styles.productDescription, isOutOfStock && styles.disabledText]}
                          numberOfLines={1}>{item.description}</Text>

                    {/* Stock Info */}
                    <Text style={[
                        styles.stockText,
                        isOutOfStock ? styles.outOfStockLabel : styles.inStockLabel
                    ]}>
                        {isOutOfStock ? 'Out of Stock' : `${item.currentStock} available`}
                    </Text>

                    {isBusinessUser && item.minQty && item.minQty > 1 && (
                        <Text style={styles.minQtyText}>Min. Qty: {item.minQty}</Text>
                    )}

                    {item.shippingCharge > 0 && (
                        <Text style={styles.shippingText}>Shipping: ₹{item.shippingCharge.toFixed(2)}</Text>
                    )}

                    <View style={styles.priceContainer}>
                        {item.hasDiscount ? (<>
                            <Text
                                style={[styles.finalPrice, isOutOfStock && styles.disabledText]}>₹{item.finalPrice.toFixed(2)}</Text>
                            <Text
                                style={[styles.originalPrice, isOutOfStock && styles.disabledText]}>₹{item.basePrice.toFixed(2)}</Text>
                            <View style={styles.discountBadge}>
                                <Text style={styles.discountText}>
                                    {Math.round(((item.basePrice - item.finalPrice) / item.basePrice) * 100)}% OFF
                                </Text>
                            </View>
                        </>) : (<Text style={[styles.finalPrice, isOutOfStock && styles.disabledText]}></Text>)}
                    </View>

                    {isBusinessUser && tierPricing[item.variantId ? `${item.productId}_${item.variantId}` : item.productId] && (
                        <Text style={styles.tierPricingText}>
                            Tier pricing applied
                        </Text>
                    )}

                    {isBusinessUser && !isOutOfStock && (
                        <Pressable
                            style={styles.negotiateButton}
                            onPress={() => onOpenNegotiation(item)}
                        >
                            <Text style={styles.negotiateButtonText}>Request Better Price</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.itemRight}>
                <Pressable
                    style={[styles.deleteButton, isOutOfStock && styles.disabledButton]}
                    onPress={() => onRemoveItem(item.productId, item.variantId, item.id)}
                    disabled={updatingItems[item.id] || isOutOfStock}
                >
                    <Image
                        source={require("../../assets/icons/deleteIcon.png")}
                        style={[styles.deleteIcon, (updatingItems[item.id] || isOutOfStock) && styles.disabledIcon]}
                    />
                </Pressable>

                <View style={[styles.quantityControl, isOutOfStock && styles.disabledControl]}>
                    <Pressable
                        style={styles.quantityButton}
                        onPress={() => onUpdateQuantity(item.id, item.quantity - 1, item.productId, item.variantId)}
                    >
                        <View
                            style={[
                                styles.minusButton,
                            ]}>
                            <Text style={[
                                styles.minusText,
                            ]}>-</Text>
                        </View>
                    </Pressable>

                    <Text style={[styles.quantityText, isOutOfStock && styles.disabledText]}>
                        {updatingItems[item.id] ? '...' : item.quantity}
                        {maxReached && !updatingItems[item.id] && (
                            <Text style={styles.maxIndicator}> (Max)</Text>
                        )}
                    </Text>

                    <Pressable
                        style={styles.quantityButton}
                        onPress={() => onUpdateQuantity(item.id, item.quantity + 1, item.productId, item.variantId)}
                        disabled={!canIncrease || updatingItems[item.id] || isOutOfStock}
                    >
                        <View style={[
                            styles.plusButton,
                            (!canIncrease || updatingItems[item.id] || isOutOfStock) && styles.disabledButton
                        ]}>
                            <Text style={[
                                styles.plusText,
                                (!canIncrease || updatingItems[item.id] || isOutOfStock) && styles.disabledText
                            ]}>+</Text>
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
    );
});

export default function CartScreen() {
    const router = useRouter();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cartInfo, setCartInfo] = useState({
        subtotal: 0,
        discount: 0,
        shipping: 0,
        tax: 0,
        marketplaceFees: 0,
        total: 0
    });
    const [couponCode, setCouponCode] = useState('');
    const [applyingCoupon, setApplyingCoupon] = useState(false);
    const [removingCoupon, setRemovingCoupon] = useState(false);
    const [updatingItems, setUpdatingItems] = useState({});
    const [selectedAddress, setSelectedAddress] = useState(null);

    // Business user states
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [negotiationModalVisible, setNegotiationModalVisible] = useState(false);
    const [selectedProductForNegotiation, setSelectedProductForNegotiation] = useState(null);
    const [proposedPrice, setProposedPrice] = useState('');
    const [negotiationLoading, setNegotiationLoading] = useState(false);
    const [tierPricing, setTierPricing] = useState({});
    const [sessionId, setSessionId] = useState(null);

    const [wishlistItems, setWishlistItems] = useState([]);

    // Stock validation states
    const [stockValidation, setStockValidation] = useState({});

    // Refs for optimization
    const cartItemsRef = useRef(cartItems);
    cartItemsRef.current = cartItems;

    // State to track if we should show full loading or just update specific parts
    const [updatingCartData, setUpdatingCartData] = useState(false);

    // Initialize session and user type
    const initializeSession = async () => {
        try {
            const sid = await getOrCreateSessionId();
            setSessionId(sid);

            const loginType = await getUserType();
            setIsBusinessUser(loginType === 'business');

            // Load tier pricing for business users
            if (loginType === 'business') {
                await loadTierPricing();
            }
        } catch (error) {
            console.error('Error initializing session:', error);
        }
    };

    // Load tier pricing for business users
    const loadTierPricing = async () => {
        try {
            const response = await getTierPricing();
            if (response.success) {
                const pricingMap = {};
                response.data.forEach(tier => {
                    const key = tier.variantId ? `${tier.productId}_${tier.variantId}` : tier.productId;
                    if (!pricingMap[key]) pricingMap[key] = [];
                    pricingMap[key].push(tier);
                });
                setTierPricing(pricingMap);
            }
        } catch (error) {
            console.error('Error loading tier pricing:', error);
        }
    };

    // Load selected address from AsyncStorage
    const loadSelectedAddress = async () => {
        try {
            const addressRaw = await AsyncStorage.getItem('selectedAddress');
            if (addressRaw) {
                setSelectedAddress(JSON.parse(addressRaw));
            }
        } catch (error) {
            console.error('Error loading selected address:', error);
        }
    };

    // Auto refresh when screen comes into focus
    useFocusEffect(useCallback(() => {
        initializeSession();
        loadCartData();
        loadSelectedAddress();
        loadWishlist();
    }, []));

    const parseUserId = (u) => u?._id || u?.id || u?.userId || null;
    const loadWishlist = async () => {
        try {
            const raw = await AsyncStorage.getItem('userData');
            const user = raw ? JSON.parse(raw) : null;
            const uid = parseUserId(user);
            if (!uid) {
                setWishlistItems([]);
                return;
            }
            const res = await getWishlist(uid);
            const payload = res?.data ?? res;
            const items = Array.isArray(payload) ? payload : (payload?.items || []);
            const mapped = items.map((p, idx) => {
                const id = String(p?._id || p?.id || idx);
                const name = p?.title || p?.name || 'Product';
                const price = Number(p?.finalPrice ?? p?.price ?? 0);
                const thumb = p?.thumbnail || (Array.isArray(p?.images) ? (p.images[0]?.url || p.images[0]) : null);
                const image = thumb ? {uri: `${API_BASE_URL}${thumb}`} : require('../../assets/sample-product.png');
                const unit = p?.unit || '';
                return {id, name, price, image, unit, productId: p?._id || p?.id};
            });
            setWishlistItems(mapped);
        } catch (e) {
            setWishlistItems([]);
        }
    };

    // Load cart data - initial load only
    const loadCartData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const res = await getCart();
            const data = res?.data ?? res;
            const items = Array.isArray(data?.items) ? data.items : [];

            const mapped = items.map((ci) => {
                const basePrice = Number(ci?.price ?? ci?.basePrice ?? 0);
                const finalPrice = Number(ci?.finalPrice ?? ci?.price ?? 0);
                const hasDiscount = basePrice > finalPrice;

                const currentStock = ci?.stockInfo?.currentStock || 0;
                const isAvailable = ci?.stockInfo?.available || false;
                const stockMessage = ci?.stockInfo?.message || '';

                return {
                    id: ci?._id || ci?.id,
                    productId: ci?.productId?._id || ci?.productId,
                    name: ci?.product?.title || ci?.product?.name || 'Product',
                    description: ci?.variant?.name || ci?.description || '',
                    basePrice: basePrice,
                    finalPrice: finalPrice,
                    hasDiscount: hasDiscount,
                    quantity: Number(ci?.quantity || 1),
                    imageUrl: ci?.product?.thumbnail || ci?.product?.images?.[0] || ci?.variant?.images?.[0] || null,
                    variantId: ci?.variantId || null,
                    subtotal: Number(ci?.subtotal ?? 0),
                    minQty: ci?.minQty || 1,
                    shippingCharge: ci?.shippingCharge || 0,
                    currentStock: currentStock,
                    isAvailable: isAvailable,
                    stockMessage: stockMessage,
                    maxOrderQty: ci?.product?.maxOrderQty || 9999,
                    status: ci?.product?.status || 'active'
                };
            });

            setCartItems(mapped);

            // Update stock validation state
            const stockValidationMap = {};
            mapped.forEach(item => {
                stockValidationMap[item.id] = {
                    currentStock: item.currentStock,
                    isAvailable: item.isAvailable,
                    canIncrease: item.quantity < Math.min(item.currentStock, item.maxOrderQty),
                    canDecrease: item.quantity > item.minQty
                };
            });
            setStockValidation(stockValidationMap);

            // Update cart totals
            setCartInfo({
                subtotal: Number(data?.totals?.subtotal ?? 0),
                discount: Number(data?.totals?.discount ?? 0),
                shipping: Number(data?.totals?.shipping ?? 0),
                marketplaceFees: Number(data?.totals?.marketplaceFees ?? 0),
                tax: Number(data?.totals?.tax ?? 0),
                total: Number(data?.totals?.totalPayable ?? 0),
            });

        } catch (error) {
            console.error('Cart load error:', error);
            Alert.alert('Error', 'Failed to load cart data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Optimized: Update cart totals only without reloading everything
    const updateCartTotalsOnly = useCallback(async () => {
        try {
            setUpdatingCartData(true);
            const res = await getCart();
            const data = res?.data ?? res;

            // Only update cart totals, not items
            setCartInfo({
                subtotal: Number(data?.totals?.subtotal ?? 0),
                discount: Number(data?.totals?.discount ?? 0),
                shipping: Number(data?.totals?.shipping ?? 0),
                marketplaceFees: Number(data?.totals?.marketplaceFees ?? 0),
                tax: Number(data?.totals?.tax ?? 0),
                total: Number(data?.totals?.totalPayable ?? 0),
            });
        } catch (error) {
            console.error('Update totals error:', error);
        } finally {
            setUpdatingCartData(false);
        }
    }, []);

    // Optimized quantity update - updates only the specific item
    const updateQuantity = useCallback(async (itemId, newQuantity, productId, variantId = null) => {
        if (newQuantity < 0) return;

        try {
            const item = cartItemsRef.current.find(i => i.id === itemId);
            if (!item) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            // Validate against max order quantity
            if (newQuantity > item.maxOrderQty) {
                Alert.alert('Maximum Quantity', `Maximum order quantity for this product is ${item.maxOrderQty}`);
                return;
            }

            // Validate against current stock
            if (newQuantity > item.currentStock) {
                Alert.alert('Out of Stock', `Only ${item.currentStock} units available`);
                return;
            }

            if (isBusinessUser && item.minQty && newQuantity < item.minQty) {
                Alert.alert('Minimum Quantity', `Minimum quantity for this product is ${item.minQty}`);
                return;
            }

            setUpdatingItems(prev => ({...prev, [itemId]: true}));

            if (newQuantity === 0) {
                // Remove item
                await removeCartItem(productId, variantId);

                // Update local state immediately - remove the item
                setCartItems(prevItems => prevItems.filter(i => i.id !== itemId));
                setStockValidation(prev => {
                    const newState = {...prev};
                    delete newState[itemId];
                    return newState;
                });

                // Update totals only
                await updateCartTotalsOnly();
            } else {
                // Update item quantity via API
                await updateCartItemApi(itemId, newQuantity);

                // Update local state immediately for the specific item only
                setCartItems(prevItems =>
                    prevItems.map(i =>
                        i.id === itemId ? {...i, quantity: newQuantity} : i
                    )
                );

                // Update stock validation for this item only
                setStockValidation(prev => ({
                    ...prev,
                    [itemId]: {
                        ...prev[itemId],
                        canIncrease: newQuantity < Math.min(item.currentStock, item.maxOrderQty),
                        canDecrease: newQuantity > item.minQty
                    }
                }));

                // Update totals only
                await updateCartTotalsOnly();
            }

        } catch (error) {
            console.error('Update quantity error:', error);
            Alert.alert('Error', 'Failed to update quantity');
            // Fallback: reload cart data if update fails
            loadCartData(false);
        } finally {
            setUpdatingItems(prev => ({...prev, [itemId]: false}));
        }
    }, [isBusinessUser, updateCartTotalsOnly, loadCartData]);

    // Optimized item removal - updates only what's needed
    const removeItem = useCallback(async (productId, variantId = null, itemId) => {
        try {
            setUpdatingItems(prev => ({...prev, [itemId]: true}));

            // Remove from API
            await removeCartItem(productId, variantId);

            // Update local state immediately - remove only this item
            setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
            setStockValidation(prev => {
                const newState = {...prev};
                delete newState[itemId];
                return newState;
            });

            // Update totals only
            await updateCartTotalsOnly();

        } catch (error) {
            console.error('Remove item error:', error);
            Alert.alert('Error', 'Failed to remove item');
            // Fallback: reload cart data if remove fails
            loadCartData(false);
        } finally {
            setUpdatingItems(prev => ({...prev, [itemId]: false}));
        }
    }, [updateCartTotalsOnly, loadCartData]);

    // Open negotiation modal
    const openNegotiationModal = useCallback((product) => {
        setSelectedProductForNegotiation(product);
        setProposedPrice(product.finalPrice.toString());
        setNegotiationModalVisible(true);
    }, []);

    // Submit negotiation request
    const submitNegotiation = async () => {
        if (!proposedPrice || !selectedProductForNegotiation) return;

        try {
            setNegotiationLoading(true);
            const loginType = await AsyncStorage.getItem('loginType');
            const cartResponse = await getCart();
            const cartId = cartResponse?.data?.cartId || cartResponse?.cartId;

            if (!cartId) {
                Alert.alert('Error', 'Cart not found');
                return;
            }

            const negotiationData = {
                loginType,
                cartId,
                products: [
                    {
                        productId: selectedProductForNegotiation.productId,
                        variantId: selectedProductForNegotiation.variantId,
                        productName: selectedProductForNegotiation.name,
                        variantName: selectedProductForNegotiation.description,
                        quantity: selectedProductForNegotiation.quantity,
                        currentPrice: selectedProductForNegotiation.finalPrice,
                        proposedPrice: parseFloat(proposedPrice),
                        totalAmount: parseFloat(proposedPrice) * selectedProductForNegotiation.quantity
                    }
                ],
                totalProposedAmount: parseFloat(proposedPrice) * selectedProductForNegotiation.quantity
            };

            const result = await createBulkNegotiation(negotiationData);

            if (result.success) {
                Alert.alert('Success', 'Negotiation request submitted successfully!');
                setNegotiationModalVisible(false);
                setSelectedProductForNegotiation(null);
                setProposedPrice('');
            } else {
                Alert.alert('Error', result.error || 'Failed to submit negotiation');
            }
        } catch (error) {
            console.error('Negotiation error:', error);
            Alert.alert('Error', 'Failed to submit negotiation request');
        } finally {
            setNegotiationLoading(false);
        }
    };

    // Coupon application with optimized updates
    const applyCoupon = useCallback(async () => {
        if (!couponCode.trim()) return;

        try {
            setApplyingCoupon(true);
            const result = await applyCouponApi(couponCode);

            if (result.success) {
                // Only update totals, not the entire cart
                await updateCartTotalsOnly();
                setCouponCode('');
                Alert.alert('Success', result.data.message || 'Coupon applied successfully!');
            } else {
                Alert.alert('Coupon Error', result.error || 'Failed to apply coupon');
            }
        } catch (error) {
            console.error('Apply coupon error:', error);
            Alert.alert('Error', 'Failed to apply coupon');
        } finally {
            setApplyingCoupon(false);
        }
    }, [couponCode, updateCartTotalsOnly]);

    // Coupon removal with optimized updates
    const removeCoupon = useCallback(async () => {
        try {
            setRemovingCoupon(true);
            await removeCouponApi();
            // Only update totals
            await updateCartTotalsOnly();
            Alert.alert('Success', 'Coupon removed successfully!');
        } catch (error) {
            console.error('Remove coupon error:', error);
            Alert.alert('Error', 'Failed to remove coupon');
        } finally {
            setRemovingCoupon(false);
        }
    }, [updateCartTotalsOnly]);

    const handleCheckOut = () => {
        if (cartItems.length === 0) {
            Alert.alert('Empty Cart', 'Please add items to your cart before checkout');
            return;
        }

        // Check if all items are available
        const unavailableItems = cartItems.filter(item => !item.isAvailable);
        if (unavailableItems.length > 0) {
            Alert.alert(
                'Stock Issue',
                'Some items in your cart are out of stock. Please remove them or update quantities before checkout.'
            );
            return;
        }

        if (!selectedAddress) {
            router.push("/screens/AddressListScreen");
        } else {
            router.push("/screens/SummaryScreen");
        }
    };

    const handleSelectAddress = () => {
        router.push("/screens/AddressListScreen");
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.replace('/Home');
        } else {
            router.replace('/Home');
        }
    };

    const handleProductPress = (product) => {
        const productid = product._id || product.id;
        router.push(`/screens/ProductDetailScreen?id=${productid}`);
    }
    // Memoized render functions
    const renderCartItem = useCallback((item) => (
        <CartItem
            key={item.id}
            item={item}
            isBusinessUser={isBusinessUser}
            tierPricing={tierPricing}
            updatingItems={updatingItems}
            stockValidation={stockValidation}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onOpenNegotiation={openNegotiationModal}
        />
    ), [isBusinessUser, tierPricing, updatingItems, stockValidation, updateQuantity, removeItem, openNegotiationModal]);

    const renderWishlistItem = useCallback(({ item }) => (
        <Pressable onPress={() => handleProductPress(item)}>
            <View style={styles.wishlistCard}>

                <Image source={item.image} style={styles.wishlistImage} />

                {/* Delete Button */}
                <Pressable
                    style={styles.wishlistRemove}
                    onPress={async () => {
                        try {
                            const raw = await AsyncStorage.getItem('userData');
                            const user = raw ? JSON.parse(raw) : null;
                            const uid = parseUserId(user);
                            if (!uid) return;

                            await removeFromWishlist(uid, item.productId);

                            setWishlistItems(prev =>
                                prev.filter(w => String(w.id) !== String(item.id))
                            );
                        } catch (_) {}
                    }}
                >
                    <Image
                        source={require('../../assets/icons/deleteIcon.png')}
                        style={styles.wishlistRemoveIcon}
                    />
                </Pressable>

                {/* Text */}
                <View style={styles.wishlistContent}>
                    <Text style={styles.wishlistName} numberOfLines={2}>
                        {item.name}
                    </Text>
                </View>

            </View>
        </Pressable>
    ), [handleProductPress]);

    if (loading) {
        return (
            <SafeAreaView style={{flex: 1, backgroundColor: "#FFFFFF"}}>
                <View style={[styles.header, {paddingTop: safeAreaInsets.top}]}>
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
                    <Text style={styles.headerTitle}>Cart</Text>
                    <View style={styles.headerPlaceholder}/>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={isTablet ? "large" : "large"} color="#4CAD73"/>
                    <Text style={styles.loadingText}>Loading Your Cart...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#FFFFFF"
                translucent={false}
            />

            {/* Header - Always static */}
            <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
                <View style={[styles.header, {paddingTop: safeAreaInsets.top}]}>
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
                    <Text style={styles.headerTitle}>Cart</Text>
                    <View style={styles.headerPlaceholder}/>
                </View>
            </SafeAreaView>

            {/* Main Content */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadCartData(true)}
                        colors={["#4CAD73"]}
                        tintColor="#4CAD73"
                        progressViewOffset={safeAreaInsets.top}
                    />
                }
                contentContainerStyle={styles.scrollContent}
            >
                {/* Business User Notice - Static unless user type changes */}
                {isBusinessUser && (
                    <View style={styles.businessNotice}>
                        <Text style={styles.businessNoticeText}>
                            Business Account - Tier pricing applied. Minimum quantities may apply.
                        </Text>
                    </View>
                )}

                {/* Cart Items Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Cart Items {cartItems.length > 0 && `(${cartItems.length})`}
                        </Text>
                    </View>

                    {cartItems.length === 0 ? (
                        <View style={styles.emptyCart}>
                            <Image
                                source={require("../../assets/icons/empty-box.png")}
                                style={styles.emptyCartImage}
                            />
                            <Text style={styles.emptyCartText}>Your cart is empty</Text>
                            <Text style={styles.emptyCartSubtitle}>
                                Add items to get started with your order
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.ordersContainer}>
                            {cartItems.map(renderCartItem)}
                        </View>
                    )}
                </View>

                {/* Your Wishlist Section - Static unless wishlist changes */}
                {wishlistItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>⭐ Your Wishlist</Text>
                            <Pressable onPress={() => router.push("/screens/WishlistScreen")}>
                                <Text style={styles.seeAllText}>See all</Text>
                            </Pressable>
                        </View>
                        <FlatList
                            data={wishlistItems}
                            renderItem={renderWishlistItem}
                            keyExtractor={item => String(item.id)}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.wishlistContainer}
                        />
                    </View>
                )}

                {/* Shipping Address Section - Static unless address changes */}
                {cartItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Shipping Address</Text>
                        </View>

                        <View style={styles.addressCard}>
                            {selectedAddress ? (
                                <View style={styles.addressContent}>
                                    <View style={styles.addressHeader}>
                                        <Text style={styles.addressName}>{selectedAddress.name}</Text>
                                        <Text style={styles.addressPhone}>{selectedAddress.phone}</Text>
                                    </View>
                                    <Text style={styles.addressText} numberOfLines={2}>
                                        {selectedAddress.address}
                                    </Text>
                                    <Text style={styles.addressArea}>
                                        {[selectedAddress.city, selectedAddress.state, selectedAddress.pincode]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </Text>
                                    <Pressable
                                        style={styles.changeAddressButton}
                                        onPress={handleSelectAddress}
                                    >
                                        <Text style={styles.changeAddressText}>Change Address</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <View style={styles.noAddressContent}>
                                    <Text style={styles.noAddressText}>No address selected</Text>
                                    <Pressable
                                        style={styles.selectAddressButton}
                                        onPress={handleSelectAddress}
                                    >
                                        <Text style={styles.selectAddressText}>Select Address</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Bill Details Section - Only totals update */}
                {cartItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.billCard}>
                            <Text style={styles.sectionTitle}>Bill Details</Text>
                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Item Total</Text>
                                <Text style={styles.billValue}>
                                    {updatingCartData ? '...' : `₹${cartInfo.subtotal.toFixed(2)}`}
                                </Text>
                            </View>

                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Delivery Fee</Text>
                                <Text style={styles.billValue}>
                                    {updatingCartData ? '...' : `₹${cartInfo.shipping.toFixed(2)}`}
                                </Text>
                            </View>

                            {cartInfo.tax > 0 && (
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Tax</Text>
                                    <Text style={styles.billValue}>
                                        {updatingCartData ? '...' : `₹${cartInfo.tax.toFixed(2)}`}
                                    </Text>
                                </View>
                            )}

                            {cartInfo.discount > 0 && (
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Discount</Text>
                                    <Text style={[styles.billValue, styles.discountText]}>
                                        {updatingCartData ? '...' : `-₹${cartInfo.discount.toFixed(2)}`}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Platform Fee</Text>
                                <Text style={styles.billValue}>
                                    {updatingCartData ? '...' : `₹${cartInfo.marketplaceFees.toFixed(2)}`}
                                </Text>
                            </View>

                            <View style={styles.divider}/>

                            <View style={styles.billRow}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalValue}>
                                    {updatingCartData ? '...' : `₹${cartInfo.total.toFixed(2)}`}
                                </Text>
                            </View>

                            {/* Coupon Section */}
                            <View style={styles.couponSection}>
                                <TextInput
                                    placeholder="Apply coupon code"
                                    value={couponCode}
                                    onChangeText={setCouponCode}
                                    style={styles.couponInput}
                                    placeholderTextColor="#999"
                                />
                                <Pressable
                                    style={[styles.applyButton, (!couponCode.trim() || applyingCoupon || updatingCartData) && styles.applyButtonDisabled]}
                                    onPress={applyCoupon}
                                    disabled={!couponCode.trim() || applyingCoupon || updatingCartData}
                                >
                                    <Text style={styles.applyButtonText}>
                                        {applyingCoupon || updatingCartData ? '...' : 'Apply'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Cancellation Policy Section - Static */}
                        <View style={styles.cancellationSection}>
                            <Text style={styles.cancellationTitle}>Cancellation Policy</Text>
                            <Text style={styles.cancellationText}>
                                Once order placed, any cancellation may result in a fee. In case of unexpected delays
                                leading to order cancellation, a complete refund will be provided.
                            </Text>
                        </View>

                        {/* Checkout Button - Updates only based on state */}
                        <Pressable
                            style={[styles.checkoutButton, (!selectedAddress || cartItems.some(item => !item.isAvailable) || updatingCartData) && styles.checkoutButtonDisabled]}
                            onPress={handleCheckOut}
                            disabled={!selectedAddress || cartItems.some(item => !item.isAvailable) || updatingCartData}
                        >
                            <View style={styles.checkoutLeft}>
                                <Text style={styles.checkoutText}>
                                    {!selectedAddress ? 'Select Address First' :
                                        cartItems.some(item => !item.isAvailable) ? 'Resolve Stock Issues' :
                                            updatingCartData ? 'Updating...' : 'Proceed to Checkout'}
                                </Text>
                            </View>
                            <Text style={styles.checkoutPrice}>
                                {updatingCartData ? '...' : `₹ ${cartInfo.total.toFixed(2)}`}
                            </Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>

            {/* Negotiation Modal - Independent component */}
            <Modal
                visible={negotiationModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setNegotiationModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={{flex: 1}}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Request Better Price</Text>

                                {selectedProductForNegotiation && (
                                    <View style={styles.negotiationProduct}>
                                        <Image
                                            source={
                                                selectedProductForNegotiation.imageUrl
                                                    ? {uri: `${API_BASE_URL}${selectedProductForNegotiation.imageUrl}`}
                                                    : require("../../assets/sample-product.png")
                                            }
                                            style={styles.negotiationImage}
                                        />
                                        <View style={styles.negotiationProductInfo}>
                                            <Text style={styles.negotiationProductName}>
                                                {selectedProductForNegotiation.name}
                                            </Text>
                                            <Text style={styles.negotiationProductDesc}>
                                                {selectedProductForNegotiation.description}
                                            </Text>
                                            <Text style={styles.currentPrice}>
                                                Current Price: ₹{selectedProductForNegotiation.finalPrice.toFixed(2)}
                                            </Text>
                                            <Text style={styles.currentQuantity}>
                                                Quantity: {selectedProductForNegotiation.quantity}
                                            </Text>
                                            <Text style={styles.stockInfo}>
                                                Stock: {selectedProductForNegotiation.currentStock} available
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <Text style={styles.modalLabel}>Your Proposed Price (per unit)</Text>

                                <TextInput
                                    style={styles.priceInput}
                                    value={proposedPrice}
                                    onChangeText={setProposedPrice}
                                    placeholder="Enter your proposed price"
                                    keyboardType="numeric"
                                    placeholderTextColor="#999"
                                />

                                {proposedPrice && selectedProductForNegotiation && (
                                    <View style={styles.totalCalculation}>
                                        <Text style={styles.totalCalculationText}>
                                            Total: ₹
                                            {(parseFloat(proposedPrice) * selectedProductForNegotiation.quantity).toFixed(2)}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.modalButtons}>
                                    <Pressable
                                        style={[styles.modalButton, styles.cancelButton]}
                                        onPress={() => setNegotiationModalVisible(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </Pressable>

                                    <Pressable
                                        style={[
                                            styles.modalButton,
                                            styles.submitButton,
                                            (!proposedPrice || negotiationLoading) && styles.disabledButton,
                                        ]}
                                        onPress={submitNegotiation}
                                        disabled={!proposedPrice || negotiationLoading}
                                    >
                                        <Text style={styles.submitButtonText}>
                                            {negotiationLoading ? "Submitting..." : "Submit Request"}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    // Container Styles
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    safeAreaTop: {
        backgroundColor: '#FFFFFF',
    },

    // Header Styles
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
        color: "#1B1B1B",
        fontFamily: "Poppins-SemiBold",
        textAlign: "center",
        flex: 1,
        marginHorizontal: RF(8),
    },
    headerPlaceholder: {
        width: RF(32),
    },
    businessBadge: {
        position: 'absolute',
        right: RF(20),
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(12),
        paddingVertical: RF(4),
        borderRadius: RF(12),
    },
    businessBadgeText: {
        color: '#FFFFFF',
        fontSize: RF(12),
        fontFamily: 'Poppins-SemiBold',
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

    // ScrollView Styles
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: safeAreaInsets.bottom + RF(80),
        paddingTop: RF(16)
    },

    // Section Styles
    section: {
        marginBottom: RF(24),
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: RF(16),
        marginBottom: RF(12),
    },
    sectionTitle: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
    },
    seeAllText: {
        fontSize: RF(14),
        color: '#4CAD73',
        fontFamily: 'Poppins-Medium',
    },

    // Business Notice
    businessNotice: {
        backgroundColor: '#E6F2FF',
        marginHorizontal: RF(16),
        padding: RF(12),
        borderRadius: RF(8),
        marginBottom: RF(16),
        borderLeftWidth: 4,
        borderLeftColor: '#4CAD73',
    },
    businessNoticeText: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
        color: "#1B1B1B",
    },

    // Empty Cart Styles
    emptyCart: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: RH(20),
        paddingHorizontal: RF(20),
    },
    emptyCartImage: {
        width: RF(120),
        height: RF(120),
        marginBottom: RF(16),
    },
    emptyCartText: {
        fontSize: RF(18),
        fontFamily: 'Poppins-SemiBold',
        color: "#1B1B1B",
        marginBottom: RF(8),
        textAlign: 'center',
    },
    emptyCartSubtitle: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Regular',
        color: "#868889",
        textAlign: 'center',
        lineHeight: RF(20),
    },

    // Orders Container
    ordersContainer: {
        paddingHorizontal: RF(16),
        gap: RF(12),
    },

    // Cart Item Styles
    cartItem: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: RF(12),
        padding: RF(16),
        shadowColor: "#000",
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        elevation: 3,
        position: 'relative',
    },
    outOfStockItem: {
        opacity: 0.7,
    },
    outOfStockOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: RF(12),
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    outOfStockText: {
        color: '#FF3B30',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        borderRadius: RF(20),
    },
    disabledText: {
        color: '#999',
    },
    disabledButton: {
        opacity: 0.5,
    },
    disabledControl: {
        opacity: 0.5,
    },
    itemLeft: {
        flexDirection: "row",
        flex: 1,
        zIndex: 0,
    },
    productImage: {
        width: RF(80),
        height: RF(80),
        borderRadius: RF(8),
        overflow: "hidden",
        backgroundColor: "#F5F6FA",
        marginRight: RF(12),
    },
    image: {
        width: "100%",
        height: "100%",
    },
    productInfo: {
        flex: 1,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: RF(15),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        lineHeight: RF(20),
        marginBottom: RF(4),
    },
    productDescription: {
        fontSize: RF(13),
        fontFamily: "Poppins-Regular",
        color: "#666",
        marginBottom: RF(4),
    },
    stockText: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Medium',
        marginBottom: RF(2),
    },
    inStockLabel: {
        color: '#4CAD73',
    },
    outOfStockLabel: {
        color: '#FF3B30',
    },
    minQtyText: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#FF6B35',
        marginTop: RF(2),
    },
    shippingText: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginTop: RF(2),
    },
    tierPricingText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-Regular',
        color: '#4CAD73',
        fontStyle: 'italic',
        marginTop: RF(2),
    },
    negotiateButton: {
        backgroundColor: '#FFA500',
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        borderRadius: RF(6),
        marginTop: RF(8),
        alignSelf: 'flex-start',
    },
    negotiateButtonText: {
        color: '#FFFFFF',
        fontSize: RF(12),
        fontFamily: 'Poppins-SemiBold',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: RF(4),
        flexWrap: 'wrap',
        gap: RF(6),
    },
    finalPrice: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#4CAD73",
    },
    originalPrice: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#999",
        textDecorationLine: 'line-through',
    },
    discountBadge: {
        backgroundColor: '#FFE8E8',
        paddingHorizontal: RF(8),
        paddingVertical: RF(4),
        borderRadius: RF(6),
    },
    discountText: {
        fontSize: RF(12),
        fontFamily: "Poppins-SemiBold",
        color: "#EC0505",
    },
    itemRight: {
        alignItems: "flex-end",
        justifyContent: 'space-between',
        zIndex: 0,
    },
    deleteButton: {
        padding: RF(4),
    },
    deleteIcon: {
        width: RF(20),
        height: RF(20),
        tintColor: '#FF3B30',
    },
    disabledIcon: {
        opacity: 0.5,
    },
    quantityControl: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: '#F8F9FA',
        borderRadius: RF(8),
        padding: RF(2),
    },
    quantityButton: {
        padding: RF(2),
    },
    minusButton: {
        width: RF(32),
        height: RF(32),
        borderWidth: 1,
        borderColor: "#4CAD73",
        borderRadius: RF(8),
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#FFFFFF',
    },
    plusButton: {
        width: RF(32),
        height: RF(32),
        backgroundColor: "#4CAD73",
        borderRadius: RF(8),
        justifyContent: "center",
        alignItems: "center",
    },
    minusText: {
        color: "#4CAD73",
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
    },
    plusText: {
        color: "#FFFFFF",
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
    },
    quantityText: {
        fontSize: RF(15),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        marginHorizontal: RF(12),
        minWidth: RF(24),
        textAlign: 'center',
    },
    maxIndicator: {
        fontSize: RF(10),
        color: '#FF6B35',
        fontFamily: 'Poppins-Regular',
    },

    // Wishlist Styles
    wishlistContainer: {
        paddingHorizontal: RF(16),
        gap: RF(12),
    },
    wishlistCard: {
        width: RF(140),
        backgroundColor: '#FFFFFF',
        borderRadius: RF(12),
        padding: RF(12),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        elevation: 2,
    },
    wishlistImage: {
        width: '100%',
        height: RF(100),
        borderRadius: RF(8),
        marginBottom: RF(8),
    },
    wishlistRemove: {
        position: 'absolute',
        top: RF(8),
        right: RF(8),
        backgroundColor: '#FFFFFF',
        padding: RF(4),
        borderRadius: RF(12),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: RF(1)},
        shadowOpacity: 0.2,
        shadowRadius: RF(2),
        elevation: 2,
    },
    wishlistRemoveIcon: {
        width: RF(16),
        height: RF(16)
    },
    wishlistContent: {
        flex: 1,
    },
    wishlistName: {
        fontSize: RF(13),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        lineHeight: RF(18),
    },

    // Shipping Address Styles
    addressCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: RF(12),
        padding: RF(16),
        marginHorizontal: RF(16),
        shadowColor: "#000",
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.08,
        shadowRadius: RF(8),
        elevation: 3,
    },
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: RF(8),
    },
    addressName: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
    },
    addressPhone: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#666",
    },
    addressText: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#333",
        lineHeight: RF(20),
        marginBottom: RF(4),
    },
    addressArea: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#666",
        marginBottom: RF(12),
    },
    changeAddressButton: {
        alignSelf: 'flex-start',
    },
    changeAddressText: {
        color: '#4CAD73',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },
    noAddressContent: {
        alignItems: 'center',
        paddingVertical: RF(20),
    },
    noAddressText: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginBottom: RF(12),
    },
    selectAddressButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(20),
        paddingVertical: RF(12),
        borderRadius: RF(8),
    },
    selectAddressText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },

    // Bill Details Styles
    billCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: RF(16),
        borderRadius: RF(12),
        padding: RF(16),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        elevation: 3,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: RF(8),
    },
    billLabel: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    billValue: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: RF(12),
    },
    totalLabel: {
        fontSize: RF(16),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
    },
    totalValue: {
        fontSize: RF(18),
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
    },

    // Coupon Section
    couponSection: {
        flexDirection: 'row',
        gap: RF(8),
        marginTop: RF(16),
        marginBottom: RF(16),
    },
    couponInput: {
        flex: 1,
        height: RF(44),
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: RF(8),
        paddingHorizontal: RF(12),
        fontSize: RF(14),
        fontFamily: 'Poppins-Regular',
    },
    applyButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(20),
        height: RF(44),
        borderRadius: RF(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },

    // Cancellation Policy Styles
    cancellationSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: RF(16),
        marginTop: RF(20),
        borderRadius: RF(12),
        padding: RF(16),
        marginBottom: RF(16),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        elevation: 3,
    },
    cancellationTitle: {
        fontSize: RF(16),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: RF(8),
    },
    cancellationText: {
        fontSize: RF(13),
        color: '#666',
        fontFamily: 'Poppins-Regular',
        lineHeight: RF(18),
    },

    // Checkout Button
    checkoutButton: {
        backgroundColor: '#4CAD73',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: RF(15),
        borderRadius: RF(12),
        marginHorizontal: RF(16),
        shadowColor: '#000',
        shadowOffset: {width: 0, height: RF(4)},
        shadowOpacity: 0.2,
        shadowRadius: RF(8),
        elevation: 4,
    },
    checkoutButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    checkoutLeft: {
        flex: 1,
    },
    checkoutText: {
        color: '#FFFFFF',
        fontSize: RF(16),
        fontFamily: 'Poppins-SemiBold',
        marginBottom: RF(4),
    },
    checkoutPrice: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        borderRadius: RF(6),
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: RF(20),
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: RF(16),
        padding: RF(20),
        width: '100%',
        maxWidth: RF(400),
    },
    modalTitle: {
        fontSize: RF(20),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: RF(16),
        textAlign: 'center',
    },
    negotiationProduct: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        padding: RF(12),
        borderRadius: RF(8),
        marginBottom: RF(16),
    },
    negotiationImage: {
        width: RF(60),
        height: RF(60),
        borderRadius: RF(8),
    },
    negotiationProductInfo: {
        flex: 1,
        marginLeft: RF(12),
    },
    negotiationProductName: {
        fontSize: RF(15),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
    },
    negotiationProductDesc: {
        fontSize: RF(13),
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    currentPrice: {
        fontSize: RF(13),
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
        marginTop: RF(4),
    },
    currentQuantity: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginTop: RF(2),
    },
    stockInfo: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginTop: RF(2),
    },
    modalLabel: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
        marginBottom: RF(8),
    },
    priceInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: RF(8),
        padding: RF(12),
        fontSize: RF(16),
        fontFamily: 'Poppins-Regular',
        marginBottom: RF(12),
    },
    totalCalculation: {
        backgroundColor: '#F8F9FA',
        padding: RF(8),
        borderRadius: RF(6),
        marginBottom: RF(16),
    },
    totalCalculationText: {
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
        textAlign: 'center',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: RF(12),
    },
    modalButton: {
        flex: 1,
        padding: RF(16),
        borderRadius: RF(8),
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },
    submitButton: {
        backgroundColor: '#4CAD73',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },
});
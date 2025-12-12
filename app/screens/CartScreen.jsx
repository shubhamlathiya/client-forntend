import {useLocalSearchParams, useRouter} from "expo-router";
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
} from '../../api/cartApi';
import {API_BASE_URL} from '../../config/apiConfig';
import {getWishlist, removeFromWishlist} from '../../api/catalogApi';
import {getOrCreateSessionId, getUserType, setCurrentSessionId} from "../../api/sessionManager";
import {
    getNotificationContext,
    loadCartFromNotification,
    restoreOriginalSession,
    isNotificationCart as checkIsNotificationCart,
} from "../../api/cartNotificationHelpers";
import {RF, RH, safeAreaInsets} from "../../utils/responsive";

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');


// Check if device is tablet
const isTablet = screenWidth >= 768;

export default function CartScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [couponCode, setCouponCode] = useState('');
    const [applyingCoupon, setApplyingCoupon] = useState(false);
    const [removingCoupon, setRemovingCoupon] = useState(false);
    const [updatingItems, setUpdatingItems] = useState({});
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [notificationLoading, setNotificationLoading] = useState(false);
    // Business user states
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [negotiationModalVisible, setNegotiationModalVisible] = useState(false);
    const [selectedProductForNegotiation, setSelectedProductForNegotiation] = useState(null);
    const [proposedPrice, setProposedPrice] = useState('');
    const [negotiationLoading, setNegotiationLoading] = useState(false);
    const [tierPricing, setTierPricing] = useState({});

    const [wishlistItems, setWishlistItems] = useState([]);

    const [stockValidation, setStockValidation] = useState({});

    const [isNotificationCartMode, setIsNotificationCartMode] = useState(false);
    const [notificationContext, setNotificationContext] = useState({
        cartId: null,
        sessionId: null,
        negotiationId: null,
        isNotificationCart: false
    });
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
    const [sessionId, setSessionId] = useState(null);

    // Refs for tracking
    const isProcessingNotification = useRef(false);
    const lastLoadTime = useRef(0);
    const paramsProcessed = useRef(false);
    const notificationLoadingInProgress = useRef(false);
    const LOAD_THROTTLE_TIME = 3000; // 3 seconds minimum between loads

    const cartItemsRef = useRef(cartItems);
    cartItemsRef.current = cartItems;

    // State to track if we should show full loading or just update specific parts
    const [updatingCartData, setUpdatingCartData] = useState(false);

    const initializeSession = useCallback(async () => {
        try {

            const sid = await getOrCreateSessionId();
            setSessionId(sid);

            const loginType = await getUserType();
            setIsBusinessUser(loginType === 'business');

            // THIRD: Check notification context BEFORE processing params
            const context = await getNotificationContext();
            setNotificationContext(context);

            if (context.isNotificationCart) {

                setIsNotificationCartMode(true);

                // Verify we're using the correct session
                const currentSession = await AsyncStorage.getItem("sessionId");
                if (currentSession !== context.sessionId) {

                    await setCurrentSessionId(context.sessionId);
                    setSessionId(context.sessionId);
                }

                // Load cart immediately for notification mode
                await loadCartData(false, true);
            } else {
                await checkNotificationParams();
            }

            // Load tier pricing for business users
            if (loginType === 'business') {
                await loadTierPricing();
            }
        } catch (error) {
            console.error('Error initializing session:', error);
        }
    }, []);

    const checkNotificationParams = useCallback(async () => {


        const {cartId, sessionId, negotiationId, action} = params;

        if (action === 'load_cart' && cartId && sessionId) {

            const now = Date.now();
            if (now - lastLoadTime.current < LOAD_THROTTLE_TIME && paramsProcessed.current) {
                // console.log("Skipping duplicate params processing (throttled)");
                return;
            }

            paramsProcessed.current = true;
            await handleNotificationCartLoading(cartId, sessionId, negotiationId);
        } else {
            paramsProcessed.current = true;
        }
    }, [params]);


    const handleNotificationCartLoading = async (cartId, sessionId, negotiationId = null) => {
        const now = Date.now();

        if (notificationLoadingInProgress.current) {
            return;
        }

        if (now - lastLoadTime.current < LOAD_THROTTLE_TIME) {
            return;
        }

        try {
            notificationLoadingInProgress.current = true;
            isProcessingNotification.current = true;


            // Check if we're already in this notification cart
            const existingContext = await getNotificationContext();
            if (existingContext.cartId === cartId && existingContext.sessionId === sessionId) {
                setIsNotificationCartMode(true);
                await loadCartData(false, true); // Force refresh
                return;
            }

            // FIRST: Save original session context BEFORE switching
            const originalSessionId = await getOrCreateSessionId();
            const originalLoginType = await getUserType();

            // Store original context
            await AsyncStorage.multiSet([
                ["original_session_id", originalSessionId || ""],
                ["original_login_type", originalLoginType || ""]
            ]);

            // SECOND: Switch to notification session
            await setCurrentSessionId(sessionId);
            setSessionId(sessionId);

            // THIRD: Load cart from notification
            const result = await loadCartFromNotification(cartId, sessionId, negotiationId);

            if (result.skip) {
                return;
            }

            if (result.success && result.cart) {
                // Set notification context
                const newContext = {
                    cartId,
                    sessionId,
                    negotiationId: negotiationId,
                    isNotificationCart: true
                };
                setNotificationContext(newContext);
                setIsNotificationCartMode(true);

                // Load cart data with force refresh
                await loadCartData(false, true);

                // Show success message
                Alert.alert(
                    'Negotiation Cart Loaded',
                    'Your approved negotiation cart has been loaded with special prices.',
                    [{text: 'OK'}]
                );
            } else {
                throw new Error(result.error || 'Failed to load negotiation cart');
            }
        } catch (error) {
            console.error('Error loading notification cart:', error);
            Alert.alert(
                'Error',
                'Could not load the negotiated cart. Please try again.',
                [
                    {
                        text: 'OK',
                        onPress: async () => {
                            await restoreOriginalSession();
                            setIsNotificationCartMode(false);
                            await loadCartData(false, true);
                        }
                    }
                ]
            );
        } finally {
            notificationLoadingInProgress.current = false;
            isProcessingNotification.current = false;
        }
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
                               onOpenNegotiation,
                               isNotificationCart // Add this prop
                           }) => {
        const itemValidation = stockValidation[item.id] || {};
        const canIncrease = itemValidation.canIncrease !== false;
        const isOutOfStock = !item.isAvailable;
        const maxReached = item.quantity >= Math.min(item.currentStock, item.maxOrderQty);
        const isDisabled = isOutOfStock || updatingItems[item.id];
        const tierPricingApplied = isBusinessUser && tierPricing[item.variantId ? `${item.productId}_${item.variantId}` : item.productId];
        const hasNegotiatedPrice = item.hasNegotiatedPrice && isNotificationCart;
        console.log("shubham")
        console.log(item)
        return (
            <View style={[styles.cartItemContainer, isOutOfStock && styles.outOfStockItem]}>
                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                    <View style={styles.outOfStockOverlay}>
                        <Text style={styles.outOfStockText}>Out of Stock</Text>
                    </View>
                )}

                {/* Negotiation Badge */}
                {hasNegotiatedPrice && (
                    <View style={styles.negotiationBadge}>
                        <Text style={styles.negotiationBadgeText}>Negotiated Price</Text>
                    </View>
                )}

                <View style={styles.contentRow}>
                    {/* 1. Left Section: Product Image */}
                    <View style={styles.imageWrapper}>
                        <Image
                            source={item.imageUrl ? {uri: `${API_BASE_URL}${item.imageUrl}`} : require("../../assets/sample-product.png")}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    </View>

                    {/* 2. Right Section: Details, Pricing, Controls */}
                    <View style={styles.detailsContainer}>
                        {/* Top Row: Name and Remove Button */}
                        <View style={styles.headerRow}>
                            <Text style={[styles.productName, isDisabled && styles.disabledText]} numberOfLines={2}>
                                {item.name}
                            </Text>
                            <Pressable
                                style={[styles.removeButton, isDisabled && styles.disabledButton]}
                                onPress={() => onRemoveItem(item.productId, item.variantId, item.id)}
                                disabled={isDisabled}
                            >
                                <Image
                                    source={require("../../assets/icons/deleteIcon.png")}
                                    style={[styles.removeIcon, isDisabled && styles.disabledIcon]}
                                />
                            </Pressable>
                        </View>

                        {/* Description/Stock/Min Qty Info */}
                        <Text style={[styles.productDescription, isDisabled && styles.disabledText]} numberOfLines={1}>
                            {item.description}
                        </Text>

                        <Text style={[
                            styles.stockText,
                            isOutOfStock ? styles.outOfStockLabel : styles.inStockLabel
                        ]}>
                            {isOutOfStock ? 'Out of Stock' : `${item.currentStock} available`}
                        </Text>

                        {isBusinessUser && item.minQty && item.minQty > 1 && (
                            <Text style={styles.minQtyText}>Min. Qty: {item.minQty}</Text>
                        )}

                        {/* Pricing */}
                        <View style={styles.priceSection}>
                            {item.hasDiscount || hasNegotiatedPrice ? (
                                <View style={styles.priceRow}>
                                    <Text style={[styles.finalPrice, isDisabled && styles.disabledText]}>
                                        ₹{item.finalPrice.toFixed(2)}
                                    </Text>
                                    {hasNegotiatedPrice && (
                                        <Text style={[styles.originalPrice, styles.negotiatedOriginalPrice]}>
                                            ₹{item.basePrice.toFixed(2)}
                                        </Text>
                                    )}
                                    {item.hasDiscount && !hasNegotiatedPrice && (
                                        <Text style={[styles.originalPrice, isDisabled && styles.disabledText]}>
                                            ₹{item.basePrice.toFixed(2)}
                                        </Text>
                                    )}
                                    {item.hasDiscount && !hasNegotiatedPrice && (
                                        <View style={styles.discountBadge}>
                                            <Text style={styles.discountText}>
                                                {Math.round(((item.basePrice - item.finalPrice) / item.basePrice) * 100)}%
                                                OFF
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <Text style={[styles.finalPrice, isDisabled && styles.disabledText]}>
                                    ₹{item.finalPrice.toFixed(2)}
                                </Text>
                            )}
                        </View>

                        {/* Subtotal and Additional Info */}
                        <View style={styles.subtotalRow}>
                            {/* Shipping Charge */}
                            {item.shippingCharge > 0 && (
                                <Text style={styles.shippingText}>Shipping: ₹{item.shippingCharge.toFixed(2)}</Text>
                            )}
                        </View>

                        {/* Tier Pricing / Negotiation */}
                        {(tierPricingApplied || (isBusinessUser && !isOutOfStock)) && (
                            <View style={styles.businessFeaturesRow}>
                                {tierPricingApplied && (
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
                        )}

                        {/* Quantity Control (Bottom Right) */}
                        <View style={styles.quantityControlWrapper}>
                            <View style={[styles.quantityControl, isDisabled && styles.disabledControl]}>
                                <Pressable
                                    style={styles.quantityButton}
                                    onPress={() => onUpdateQuantity(item.id, item.quantity - 1, item.productId, item.variantId)}
                                    disabled={isDisabled || item.quantity <= 1}
                                >
                                    <Text style={styles.controlText}>-</Text>
                                </Pressable>

                                <Text style={[styles.quantityText, isDisabled && styles.disabledText]}>
                                    {updatingItems[item.id] ? '...' : item.quantity}
                                </Text>

                                <Pressable
                                    style={styles.quantityButton}
                                    onPress={() => onUpdateQuantity(item.id, item.quantity + 1, item.productId, item.variantId)}
                                    disabled={!canIncrease || isDisabled}
                                >
                                    <Text style={styles.controlText}>+</Text>
                                </Pressable>
                            </View>
                            {maxReached && !updatingItems[item.id] && (
                                <Text style={styles.maxIndicatorText}>Max Quantity Reached</Text>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    });

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
    useFocusEffect(
        useCallback(() => {


            const checkAndRefresh = async () => {
                const now = Date.now();
                // Only refresh if it's been more than 10 seconds since last load
                if (now - lastLoadTime.current > 10000) {
                    await loadCartData(false, true);
                }
            };

            checkAndRefresh();

            return () => {
                // Cleanup if needed
            };
        }, [])
    );

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

    const lastProcessedParams = useRef(null);

    useEffect(() => {
        console.log("CartScreen params updated:", params);

        // Only process params once when they change
        if (params.action === "load_cart" && params.cartId && params.sessionId) {
            const paramKey = `${params.cartId}-${params.sessionId}`;
            console.log(paramKey)
            console.log(lastProcessedParams.current)
            console.log("hy")
            lastProcessedParams.current = paramKey;
            checkNotificationParams();
        }
    }, [params]);


    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            if (mounted) {
                await initializeSession();
                await loadCartData();
                await loadSelectedAddress();
                await loadWishlist();
            }
        };

        initialize();

        return () => {
            mounted = false;
            // Cleanup refs
            isProcessingNotification.current = false;
            notificationLoadingInProgress.current = false;
        };
    }, []); // Empty dependency array - runs once

    const loadCartData = useCallback(async (isRefresh = false, force = false) => {
        const now = Date.now();

        // Throttle checks - but allow force refresh
        if (!force && now - lastLoadTime.current < LOAD_THROTTLE_TIME) {
            console.log("Skipping duplicate cart load (throttled)");
            return;
        }

        // Don't load if notification is being processed, unless it's a force refresh
        if (!force && (isProcessingNotification.current || notificationLoadingInProgress.current)) {
            console.log("Skipping cart load - notification processing in progress");
            return;
        }

        try {
            lastLoadTime.current = now;

            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            console.log("=== LOADING CART DATA ===");
            console.log("Is notification cart mode:", isNotificationCartMode);

            // Get current session for debugging
            const currentSessionId = await AsyncStorage.getItem('sessionId');
            console.log("Current sessionId:", currentSessionId);

            // Check if we should be in notification mode
            const isActuallyNotificationCart = await checkIsNotificationCart();
            if (isActuallyNotificationCart !== isNotificationCartMode) {
                setIsNotificationCartMode(isActuallyNotificationCart);
            }

            // Always use force=true to bypass API throttling
            const res = await getCart(true);

            // Handle null response (throttled)
            if (res === null) {
                // Try again without throttle
                const retryRes = await getCart(true);
                if (retryRes === null) {
                    throw new Error("Failed to load cart after retry");
                }
                processCartData(retryRes, isActuallyNotificationCart);
                return;
            }

            processCartData(res, isActuallyNotificationCart);

        } catch (error) {
            console.error('Cart load error:', error);

            // If error in notification mode, try to restore
            if (isNotificationCartMode) {

                await restoreOriginalSession();
                setIsNotificationCartMode(false);

                // Try loading regular cart
                try {
                    const regularCart = await getCart(true);
                    if (regularCart) {
                        processCartData(regularCart, false);
                    } else {
                        throw new Error("Failed to load regular cart");
                    }
                } catch (retryError) {
                    Alert.alert('Error', 'Failed to load cart data');
                }
            } else {
                Alert.alert('Error', 'Failed to load cart data');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isNotificationCartMode]);

    const processCartData = (cartData, isActuallyNotificationCart) => {
        const data = cartData?.data ?? cartData;
        const items = Array.isArray(data?.items) ? data.items : [];

        console.log("Cart data received:", {
            hasData: !!data,
            itemCount: items.length,
            cartId: data?._id || data?.id,
            isNotificationCart: isActuallyNotificationCart
        });

        // Handle empty notification cart
        if (isActuallyNotificationCart && items.length === 0) {
            console.log("⚠️ Notification cart is empty");
            Alert.alert(
                'Empty Cart',
                'The negotiated cart appears to be empty or expired.',
                [
                    {
                        text: 'Switch to Regular Cart',
                        onPress: async () => {
                            await restoreOriginalSession();
                            setIsNotificationCartMode(false);
                            await loadCartData(false, true);
                        }
                    }
                ]
            );
        }

        const mapped = items.map((ci) => {
            // ... your existing mapping logic ...
            const basePrice = Number(ci?.variant?.price ?? ci?.unitPrice ?? 0);
            const finalPrice = Number(ci?.finalPrice ?? ci?.unitPrice ?? 0);
            const hasDiscount = basePrice > finalPrice;

            const currentStock = ci?.stockInfo?.currentStock || 0;
            const isAvailable = ci?.stockInfo?.available || false;
            const stockMessage = ci?.stockInfo?.message || '';

            return {
                id: ci?._id || ci?.id,
                productId: ci?.productId?._id || ci?.productId || ci?.product?._id,
                name: ci?.product?.title || ci?.product?.name || ci?.name || 'Product',
                description: ci?.variant?.name || ci?.variantAttributes || ci?.description || '',
                basePrice: basePrice,
                finalPrice: finalPrice,
                hasDiscount: hasDiscount,
                quantity: Number(ci?.quantity || 1),
                imageUrl: ci?.image || ci?.product?.thumbnail || ci?.product?.images?.[0] || ci?.variant?.images?.[0] || null,
                variantId: ci?.variantId || null,
                subtotal: Number(ci?.subtotal ?? (finalPrice * (ci?.quantity || 1))),
                minQty: ci?.minQty || 1,
                shippingCharge: ci?.shippingCharge || 0,
                currentStock: currentStock,
                isAvailable: isAvailable,
                stockMessage: stockMessage,
                maxOrderQty: ci?.product?.maxOrderQty || 9999,
                status: ci?.product?.status || 'active',
                hasNegotiatedPrice: ci?.hasNegotiatedPrice || false // Add this line
            };
        });

        setCartItems(mapped);
        console.log("Mapped items count:", mapped.length);

        // Update cart totals
        setCartInfo({
            subtotal: Number(data?.totals?.subtotal ?? 0),
            discount: Number(data?.totals?.discount ?? 0),
            shipping: Number(data?.totals?.shipping ?? 0),
            marketplaceFees: Number(data?.totals?.marketplaceFees ?? 0),
            tax: Number(data?.totals?.tax ?? 0),
            total: Number(data?.totals?.totalPayable ?? 0),
        });
    };

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

                // Update totals only
                await updateCartTotalsOnly();
            }

        } catch (error) {
            console.error('Update quantity error:', error);
            Alert.alert('Error', 'Failed to update quantity');
            // Force refresh cart data if update fails
            await loadCartData(false, true);
        } finally {
            setUpdatingItems(prev => ({...prev, [itemId]: false}));
        }
    }, [isBusinessUser, updateCartTotalsOnly]);
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
            isNotificationCart={isNotificationCartMode}
        />
    ), [isBusinessUser, tierPricing, updatingItems, stockValidation, updateQuantity, removeItem, openNegotiationModal, isNotificationCartMode]);

    const renderWishlistItem = useCallback(({item}) => (
        <Pressable
            onPress={() => handleProductPress(item)}
            // Use the wishlistCard style directly on the outer Pressable for better hit area
            style={styles.wishlistCard}
        >
            {/*<View style={styles.wishlistCard}>*/}

            <Image
                source={item.image}
                style={styles.wishlistImage}
                resizeMode="cover" // Ensure the image covers the area
            />

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
                    } catch (_) {
                    }
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

            {/*</View>*/}
        </Pressable>
    ), [handleProductPress]);

    if (loading || notificationLoading) {
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
                    <Text style={styles.headerTitle}>
                        {notificationLoading ? 'Loading...' : 'Cart'}
                    </Text>
                    <View style={styles.headerPlaceholder}/>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={isTablet ? "large" : "large"} color="#4CAD73"/>
                    <Text style={styles.loadingText}>
                        {notificationLoading ? 'Loading Negotiated Cart...' : 'Loading Your Cart...'}
                    </Text>
                    {notificationLoading && (
                        <Text style={styles.loadingSubtext}>
                            Loading your approved negotiation with special prices
                        </Text>
                    )}
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
                            {isNotificationCartMode ? 'Negotiated Items' : 'Cart Items'}
                            {cartItems.length > 0 && ` (${cartItems.length})`}
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
    cartItemContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: RF(12),
        padding: RF(12), // Slightly less padding for a tighter look
        shadowColor: "#000",
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        elevation: 3,
        position: 'relative',
    },
    contentRow: {
        flexDirection: "row", // Image on the left, Details on the right
        flex: 1,
    },

    // 1. LEFT: Image Section
    imageWrapper: {
        width: RF(90),
        height: RF(90),
        borderRadius: RF(8),
        overflow: "hidden",
        backgroundColor: "#F5F6FA",
        marginRight: RF(12),
        // Ensure image container doesn't shrink
        flexShrink: 0,
    },
    image: {
        width: "100%",
        height: "100%",
    },

    // 2. RIGHT: Details Section
    detailsContainer: {
        flex: 1, // Takes up remaining space
        justifyContent: 'space-between',
    },

    // --- DETAILS COMPONENTS ---

    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: RF(4),
    },
    removeButton: {
        padding: RF(4),
        marginLeft: RF(8),
    },
    removeIcon: {
        width: RF(16),
        height: RF(16),
        tintColor: '#999',
    },

    // Pricing Layout
    priceSection: {
        marginTop: RF(6),
        marginBottom: RF(4),
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    finalPrice: {
        fontSize: RF(16),
        fontFamily: 'Poppins-SemiBold',
        color: '#333',
        marginRight: RF(8),
    },
    originalPrice: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#999',
        textDecorationLine: 'line-through',
        marginRight: RF(8),
    },
    discountBadge: {
        backgroundColor: '#FF3B30',
        borderRadius: RF(4),
        paddingHorizontal: RF(6),
        paddingVertical: RF(2),
    },
    discountText: {
        color: '#FFFFFF',
        fontSize: RF(10),
        fontFamily: 'Poppins-SemiBold',
    },

    // Subtotal and Shipping
    subtotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: RF(4),
        marginBottom: RF(8),
    },
    itemSubtotal: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Medium',
        color: '#333',
    },
    shippingText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-Regular',
        color: '#007AFF', // Example color for shipping
    },

    // Business Features
    businessFeaturesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: RF(8),
    },
    tierPricingText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-Medium',
        color: '#FF9500', // Warning/Highlight color
    },
    negotiateButton: {
        backgroundColor: '#E0F0FF',
        borderRadius: RF(20),
        paddingHorizontal: RF(10),
        paddingVertical: RF(5),
    },
    negotiateButtonText: {
        fontSize: RF(10),
        fontFamily: 'Poppins-SemiBold',
        color: '#007AFF',
    },

    // Quantity Control (Bottom Right Alignment)
    quantityControlWrapper: {
        marginTop: RF(10),
        alignSelf: 'flex-end', // Aligns control to the bottom right
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: RF(20),
        backgroundColor: '#F7F7F7',
    },
    quantityButton: {
        paddingHorizontal: RF(12),
        paddingVertical: RF(4),
    },
    controlText: {
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
        color: '#333',
    },
    quantityText: {
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
        color: '#333',
        minWidth: RF(30),
        textAlign: 'center',
    },
    maxIndicatorText: {
        fontSize: RF(10),
        fontFamily: 'Poppins-Medium',
        color: '#FF9500',
        textAlign: 'right',
        marginTop: RF(4),
    },


    // --- TEXT & STATUS STYLES (Adjusted/Retained) ---

    productName: {
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
        color: '#333',
        flex: 1, // Allows name to take up space beside remove button
        marginRight: RF(8),
    },
    productDescription: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    stockText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-Medium',
        marginTop: RF(4),
    },
    inStockLabel: {
        color: '#34C759', // Green
    },
    outOfStockLabel: {
        color: '#FF3B30', // Red
    },
    minQtyText: {
        fontSize: RF(11),
        fontFamily: 'Poppins-Regular',
        color: '#007AFF',
        marginTop: RF(2),
    },

    // --- DISABLED/STATUS OVERRIDES (Retained) ---

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
        zIndex: 10, // Increased zIndex to ensure it's on top
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
    disabledIcon: {
        tintColor: '#CCC',
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

    productInfo: {
        flex: 1,
        justifyContent: 'space-between',
    },

    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: RF(4),
        flexWrap: 'wrap',
        gap: RF(6),
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
    maxIndicator: {
        fontSize: RF(10),
        color: '#FF6B35',
        fontFamily: 'Poppins-Regular',
    },

    // Wishlist Styles
    wishlistContainer: {
        paddingHorizontal: RF(15),
        gap: RF(11),
        marginBottom: RF(15),
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
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    notificationBadge: {
        fontSize: RF(10),
        color: '#4CAD73',
        fontFamily: 'Poppins-SemiBold',
        backgroundColor: '#E6F2FF',
        paddingHorizontal: RF(8),
        paddingVertical: RF(2),
        borderRadius: RF(12),
        marginTop: RF(2),
    },
    exitNotificationButton: {
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        backgroundColor: '#FF6B35',
        borderRadius: RF(8),
    },
    exitNotificationText: {
        color: '#FFFFFF',
        fontSize: RF(12),
        fontFamily: 'Poppins-SemiBold',
    },
    negotiationNotice: {
        backgroundColor: '#E8F5E9',
        borderLeftColor: '#4CAD73',
        paddingVertical: RF(14),
    },
    negotiationIdText: {
        fontSize: RF(12),
        color: '#2E7D32',
        fontFamily: 'Poppins-Medium',
        marginTop: RF(4),
        textAlign: 'center',
    },
    negotiationBadge: {
        position: 'absolute',
        top: RF(8),
        left: RF(8),
        backgroundColor: '#4CAD73',
        borderRadius: RF(4),
        paddingHorizontal: RF(6),
        paddingVertical: RF(2),
        zIndex: 5,
    },
    negotiationBadgeText: {
        color: '#FFFFFF',
        fontSize: RF(10),
        fontFamily: 'Poppins-SemiBold',
    },
    negotiatedOriginalPrice: {
        fontSize: RF(12),
        fontFamily: 'Poppins-Regular',
        color: '#999',
        textDecorationLine: 'line-through',
        marginRight: RF(8),
    },
    loadingSubtext: {
        fontSize: RF(12),
        color: '#868889',
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        marginTop: RF(8),
        lineHeight: RF(18),
    },
    switchToRegularButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(24),
        paddingVertical: RF(12),
        borderRadius: RF(8),
        marginTop: RF(16),
    },
    switchToRegularText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
    },
});
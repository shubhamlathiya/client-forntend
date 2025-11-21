import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
    Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions,
    FlatList, Modal
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
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
import { API_BASE_URL } from '../../config/apiConfig';
import RelatedProducts from "../../components/screens/RelatedProducts";
import {getOrCreateSessionId, getUserType} from "../../api/sessionManager";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CartScreen() {
    const router = useRouter();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [cartInfo, setCartInfo] = useState({ subtotal: 0, discount: 0, shipping: 0, total: 0, marketplaceFees: 0 });
    const [couponCode, setCouponCode] = useState('');
    const [applyingCoupon, setApplyingCoupon] = useState(false);
    const [removingCoupon, setRemovingCoupon] = useState(false);
    const [updatingItems, setUpdatingItems] = useState({});
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [selectedInstructions, setSelectedInstructions] = useState([]);

    // Business user states
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [negotiationModalVisible, setNegotiationModalVisible] = useState(false);
    const [selectedProductForNegotiation, setSelectedProductForNegotiation] = useState(null);
    const [proposedPrice, setProposedPrice] = useState('');
    const [negotiationLoading, setNegotiationLoading] = useState(false);
    const [tierPricing, setTierPricing] = useState({});
    const [sessionId, setSessionId] = useState(null);

    // Mock data for special deals - only one
    const [specialDeal] = useState({
        id: '1',
        title: 'Buy 1 Get 1 Free',
        description: 'On selected beverages',
        image: require('../../assets/Rectangle 24904.png'),
        validUntil: 'Today',
        discount: '50% OFF'
    });

    // Delivery instructions options
    const deliveryInstructions = [
        {
            id: '1',
            title: 'Avoid Calling',
            description: 'Please avoid calling, use message instead',
            icon: '📱'
        },
        {
            id: '2',
            title: "Don't Ring Bell",
            description: 'Please do not ring the door bell',
            icon: '🔕'
        },
        {
            id: '3',
            title: 'Leave at Door',
            description: 'Leave the order at the door',
            icon: '🚪'
        }
    ];

    const [wishlistItems] = useState([
        {
            id: '1',
            name: 'Organic Apples',
            price: 299,
            image: require('../../assets/Rectangle 24904.png'),
            unit: '1kg'
        },
        {
            id: '2',
            name: 'Fresh Milk',
            price: 65,
            image: require('../../assets/Rectangle 24904.png'),
            unit: '1L'
        },
        {
            id: '3',
            name: 'Whole Wheat Bread',
            price: 45,
            image: require('../../assets/Rectangle 24904.png'),
            unit: '400g'
        },
        {
            id: '4',
            name: 'Eggs',
            price: 90,
            image: require('../../assets/Rectangle 24904.png'),
            unit: '6pcs'
        }
    ]);

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

    // Apply tier pricing to cart for business users
    const applyTierPricingToCart = async () => {
        if (!isBusinessUser) return;

        try {
            await applyTierPricing();
            await loadCartData(false);
        } catch (error) {
            console.error('Error applying tier pricing:', error);
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
    }, []));

    // Load cart data with proper error handling
    const loadCartData = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);

            const res = await getCart();
            const data = res?.data ?? res;
            const items = Array.isArray(data?.items) ? data.items : [];

            const mapped = items.map((ci) => {
                const basePrice = Number(ci?.price ?? ci?.basePrice ?? 0);
                const finalPrice = Number(ci?.finalPrice ?? ci?.price ?? 0);
                const hasDiscount = basePrice > finalPrice;

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
                    minQty: ci?.minQty || 1, // For business users
                    shippingCharge: ci?.shippingCharge || 0
                };
            });

            setCartItems(mapped);

            // Extract all totals from API correctly
            setCartInfo({
                subtotal: Number(data?.totals?.subtotal ?? 0),
                discount: Number(data?.totals?.discount ?? 0),
                shipping: Number(data?.totals?.shipping ?? 0),
                marketplaceFees: Number(data?.totals?.marketplaceFees ?? 0),
                tax: Number(data?.totals?.tax ?? 0), // Added tax field
                total: Number(data?.totals?.totalPayable ?? 0),
            });

        } catch (error) {
            console.error('Cart load error:', error);
            Alert.alert('Error', 'Failed to load cart data');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, []);

    // Optimized quantity update with immediate UI feedback
    const updateQuantity = useCallback(async (itemId, newQuantity, productId, variantId = null) => {
        // Early exit if newQuantity is negative
        if (newQuantity < 0) return;

        try {
            // Find the cart item locally
            const item = cartItems.find(i => i.id === itemId);
            if (!item) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            // Check minimum quantity for business users
            if (isBusinessUser && item.minQty && newQuantity < item.minQty) {
                Alert.alert('Minimum Quantity', `Minimum quantity for this product is ${item.minQty}`);
                return;
            }

            setUpdatingItems(prev => ({ ...prev, [itemId]: true }));

            if (newQuantity === 0) {
                // Remove item if quantity is zero
                await removeCartItem(productId, variantId);
            } else {
                // Optimistic update
                setCartItems(prevItems =>
                    prevItems.map(i =>
                        i.id === itemId ? { ...i, quantity: newQuantity } : i
                    )
                );

                // Update quantity via API
                await updateCartItemApi(itemId, newQuantity);
            }

            // Refresh cart to sync with backend
            await loadCartData(false);

        } catch (error) {
            console.error('Update quantity error:', error);
            Alert.alert('Error', 'Failed to update quantity');

            // Revert optimistic update on error
            await loadCartData(false);

        } finally {
            setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
        }
    }, [cartItems, loadCartData, isBusinessUser]);

    // Optimized item removal
    const removeItem = useCallback(async (productId, variantId = null, itemId) => {
        try {
            setUpdatingItems(prev => ({ ...prev, [itemId]: true }));

            // Optimistic removal
            const updatedItems = cartItems.filter(item => item.id !== itemId);
            setCartItems(updatedItems);

            // API call
            await removeCartItem(productId, variantId);

            // Refresh data
            await loadCartData(false);

        } catch (error) {
            console.error('Remove item error:', error);
            Alert.alert('Error', 'Failed to remove item');
            // Revert optimistic removal on error
            await loadCartData(false);
        } finally {
            setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
        }
    }, [cartItems, loadCartData]);

    // Open negotiation modal
    const openNegotiationModal = (product) => {
        setSelectedProductForNegotiation(product);
        setProposedPrice(product.finalPrice.toString());
        setNegotiationModalVisible(true);
    };

    // Submit negotiation request
    const submitNegotiation = async () => {
        if (!proposedPrice || !selectedProductForNegotiation) return;

        try {
            setNegotiationLoading(true);

            // 1. Get loginType
            const loginType = await AsyncStorage.getItem('loginType');

            // 2. Get cart info (to extract cartId)
            const cartResponse = await getCart();
            const cartId = cartResponse?.data?.cartId || cartResponse?.cartId;

            if (!cartId) {
                Alert.alert('Error', 'Cart not found');
                return;
            }

            // 3. Build negotiation payload
            const negotiationData = {
                loginType,
                cartId, // <-- added cartId here
                products: [
                    {
                        productId: selectedProductForNegotiation.productId,
                        variantId: selectedProductForNegotiation.variantId,
                        productName: selectedProductForNegotiation.name,
                        variantName: selectedProductForNegotiation.description,
                        quantity: selectedProductForNegotiation.quantity,
                        currentPrice: selectedProductForNegotiation.finalPrice,
                        proposedPrice: parseFloat(proposedPrice),
                        totalAmount:
                            parseFloat(proposedPrice) *
                            selectedProductForNegotiation.quantity
                    }
                ],
                totalProposedAmount:
                    parseFloat(proposedPrice) *
                    selectedProductForNegotiation.quantity
            };

            // 4. Send request
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


    // Coupon application with immediate feedback
    const applyCoupon = useCallback(async () => {
        if (!couponCode.trim()) return;

        try {
            setApplyingCoupon(true);
            const result = await applyCouponApi(couponCode);

            if (result.success) {
                await loadCartData(false);
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
    }, [couponCode, loadCartData]);

    // Coupon removal
    const removeCoupon = useCallback(async () => {
        try {
            setRemovingCoupon(true);
            await removeCouponApi();
            await loadCartData(false);
            Alert.alert('Success', 'Coupon removed successfully!');
        } catch (error) {
            console.error('Remove coupon error:', error);
            Alert.alert('Error', 'Failed to remove coupon');
        } finally {
            setRemovingCoupon(false);
        }
    }, [loadCartData]);

    const handleCheckOut = () => {
        if (cartItems.length === 0) {
            Alert.alert('Empty Cart', 'Please add items to your cart before checkout');
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

    const handleAddToCart = (item) => {
        Alert.alert('Added', `${item.name} added to cart`);
    };

    const handleSpecialDeal = () => {
        Alert.alert('Special Deal', 'Special deal applied to your cart!');
    };

    const toggleInstruction = (instructionId) => {
        setSelectedInstructions(prev =>
            prev.includes(instructionId)
                ? prev.filter(id => id !== instructionId)
                : [...prev, instructionId]
        );
    };

    const renderWishlistItem = ({ item }) => (
        <TouchableOpacity style={styles.wishlistCard}>
            <Image source={item.image} style={styles.wishlistImage} />
            <View style={styles.wishlistContent}>
                <Text style={styles.wishlistName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.wishlistUnit}>{item.unit}</Text>
                <View style={styles.wishlistBottom}>
                    <Text style={styles.wishlistPrice}>₹{item.price}</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => handleAddToCart(item)}
                    >
                        <Text style={styles.addButtonText}>ADD</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderCartItem = useCallback((item) => (
        <View key={item.id} style={styles.cartItem}>
            <View style={styles.itemLeft}>
                <View style={styles.productImage}>
                    <Image
                        source={item.imageUrl ? { uri: `${API_BASE_URL}${item.imageUrl}` } : require("../../assets/sample-product.png")}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </View>
                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productDescription} numberOfLines={1}>{item.description}</Text>

                    {/* Minimum quantity warning for business users */}
                    {isBusinessUser && item.minQty && item.minQty > 1 && (
                        <Text style={styles.minQtyText}>Min. Qty: {item.minQty}</Text>
                    )}

                    {/* Shipping cost display */}
                    {item.shippingCharge > 0 && (
                        <Text style={styles.shippingText}>Shipping: ₹{item.shippingCharge.toFixed(2)}</Text>
                    )}

                    <View style={styles.priceContainer}>
                        {item.hasDiscount ? (<>
                            <Text style={styles.finalPrice}>₹{item.finalPrice.toFixed(2)}</Text>
                            <Text style={styles.originalPrice}>₹{item.basePrice.toFixed(2)}</Text>
                            <View style={styles.discountBadge}>
                                <Text style={styles.discountText}>
                                    {Math.round(((item.basePrice - item.finalPrice) / item.basePrice) * 100)}% OFF
                                </Text>
                            </View>
                        </>) : (<Text style={styles.finalPrice}>₹{item.finalPrice.toFixed(2)}</Text>)}
                    </View>

                    {/* Tier pricing info for business users */}
                    {isBusinessUser && tierPricing[item.variantId ? `${item.productId}_${item.variantId}` : item.productId] && (
                        <Text style={styles.tierPricingText}>
                            Tier pricing applied
                        </Text>
                    )}

                    {/* Negotiation button for business users */}
                    {isBusinessUser && (
                        <TouchableOpacity
                            style={styles.negotiateButton}
                            onPress={() => openNegotiationModal(item)}
                        >
                            <Text style={styles.negotiateButtonText}>Request Better Price</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.itemRight}>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removeItem(item.productId, item.variantId, item.id)}
                    disabled={updatingItems[item.id]}
                >
                    <Image
                        source={require("../../assets/icons/deleteIcon.png")}
                        style={[styles.deleteIcon, updatingItems[item.id] && styles.disabledIcon]}
                    />
                </TouchableOpacity>

                <View style={styles.quantityControl}>
                    <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.id, item.quantity - 1, item.productId, item.variantId)}
                    >
                        <View
                            style={[styles.minusButton, (updatingItems[item.id] || item.quantity <= (item.minQty || 1)) && styles.disabledButton]}>
                            <Text style={styles.minusText}>-</Text>
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.quantityText}>
                        {updatingItems[item.id] ? '...' : item.quantity}
                    </Text>

                    <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.id, item.quantity + 1, item.productId, item.variantId)}
                        disabled={updatingItems[item.id]}
                    >
                        <View style={[styles.plusButton, updatingItems[item.id] && styles.disabledButton]}>
                            <Text style={styles.plusText}>+</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    ), [updateQuantity, removeItem, updatingItems, isBusinessUser, openNegotiationModal, tierPricing]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.iconBox}
                    />
                </TouchableOpacity>
                <Text style={styles.heading}>Cart</Text>
                {isBusinessUser && (
                    <View style={styles.businessBadge}>
                        <Text style={styles.businessBadgeText}>Business</Text>
                    </View>
                )}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
            >

                {/* Business User Notice */}
                {isBusinessUser && (
                    <View style={styles.businessNotice}>
                        <Text style={styles.businessNoticeText}>
                            🏢 Business Account - Tier pricing applied. Minimum quantities may apply.
                        </Text>
                    </View>
                )}

                {/* Special Deal Section - Single Card */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>🔥 Special Deal For You</Text>
                    </View>

                    <View style={styles.specialDealCard}>
                        <View style={styles.specialDealInnerCard}>
                            <View style={styles.dealContent}>
                                <View style={styles.dealTextContent}>
                                    <Text style={styles.dealTitle}>{specialDeal.title}</Text>
                                    <Text style={styles.dealDescription}>{specialDeal.description}</Text>
                                    <Text style={styles.dealDiscount}>{specialDeal.discount}</Text>
                                    <Text style={styles.dealValid}>Valid until: {specialDeal.validUntil}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.dealAddButton}
                                    onPress={handleSpecialDeal}
                                >
                                    <Text style={styles.dealAddButtonText}>ADD</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.dealUnlockText}>
                            <Text style={styles.dealUnlockTextContent}>🎉 Yay! Special deal unlocked</Text>
                        </View>
                    </View>
                </View>

                {/* Cart Items Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Cart Items {cartItems.length > 0 && `(${cartItems.length})`}
                        </Text>
                    </View>

                    {cartItems.length === 0 && !loading && (
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
                    )}

                    {cartItems.map(renderCartItem)}
                </View>

                {/* Your Wishlist Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>⭐ Your Wishlist</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllText}>See all</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={wishlistItems}
                        renderItem={renderWishlistItem}
                        keyExtractor={item => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.wishlistContainer}
                    />
                </View>

                <RelatedProducts />

                {/* Shipping Address Section */}
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
                                    <TouchableOpacity
                                        style={styles.changeAddressButton}
                                        onPress={handleSelectAddress}
                                    >
                                        <Text style={styles.changeAddressText}>Change Address</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.noAddressContent}>
                                    <Text style={styles.noAddressText}>No address selected</Text>
                                    <TouchableOpacity
                                        style={styles.selectAddressButton}
                                        onPress={handleSelectAddress}
                                    >
                                        <Text style={styles.selectAddressText}>Select Address</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Bill Details Section */}
                {cartItems.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.billCard}>
                            <Text style={styles.sectionTitle}>Bill Details</Text>
                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Item Total</Text>
                                <Text style={styles.billValue}>₹{cartInfo.subtotal.toFixed(2)}</Text>
                            </View>

                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Delivery Fee</Text>
                                <Text style={styles.billValue}>₹{cartInfo.shipping.toFixed(2)}</Text>
                            </View>

                            {/* Tax Row - Added from cart data */}
                            {cartInfo.tax > 0 && (
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Tax</Text>
                                    <Text style={styles.billValue}>₹{cartInfo.tax.toFixed(2)}</Text>
                                </View>
                            )}

                            {cartInfo.discount > 0 && (
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Discount</Text>
                                    <Text style={[styles.billValue, styles.discountText]}>-₹{cartInfo.discount.toFixed(2)}</Text>
                                </View>
                            )}

                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Platform Fee</Text>
                                <Text style={styles.billValue}>₹{cartInfo.marketplaceFees.toFixed(2)}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.billRow}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalValue}>₹{cartInfo.total.toFixed(2)}</Text>
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
                                <TouchableOpacity
                                    style={[styles.applyButton, (!couponCode.trim() || applyingCoupon) && styles.applyButtonDisabled]}
                                    onPress={applyCoupon}
                                    disabled={!couponCode.trim() || applyingCoupon}
                                >
                                    <Text style={styles.applyButtonText}>
                                        {applyingCoupon ? '...' : 'Apply'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Delivery Instructions Section */}
                        <View style={styles.instructionsSection}>
                            <Text style={styles.instructionsTitle}>Delivery instructions</Text>
                            <View style={styles.instructionsGrid}>
                                {deliveryInstructions.map((instruction) => (
                                    <TouchableOpacity
                                        key={instruction.id}
                                        style={[
                                            styles.instructionCard,
                                            selectedInstructions.includes(instruction.id) && styles.instructionCardSelected
                                        ]}
                                        onPress={() => toggleInstruction(instruction.id)}
                                    >
                                        <Text style={styles.instructionIcon}>{instruction.icon}</Text>
                                        <Text style={styles.instructionTitle}>{instruction.title}</Text>
                                        <Text style={styles.instructionDescription}>{instruction.description}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Cancellation Policy Section */}
                        <View style={styles.cancellationSection}>
                            <Text style={styles.cancellationTitle}>Cancellation Policy</Text>
                            <Text style={styles.cancellationText}>
                                Once order placed, any cancellation may result in a fee. In case of unexpected delays leading to order cancellation, a complete refund will be provided.
                            </Text>
                        </View>

                        {/* Checkout Button */}
                        <TouchableOpacity
                            style={[styles.checkoutButton, !selectedAddress && styles.checkoutButtonDisabled]}
                            onPress={handleCheckOut}
                            disabled={!selectedAddress}
                        >
                            <View style={styles.checkoutLeft}>
                                <Text style={styles.checkoutText}>
                                    {selectedAddress ? 'Proceed to Checkout' : 'Select Address First'}
                                </Text>
                                <Text style={styles.deliveryText}>Delivery in 10 mins</Text>
                            </View>
                            <Text style={styles.checkoutPrice}>₹{cartInfo.total.toFixed(2)}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Negotiation Modal */}
            <Modal
                visible={negotiationModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setNegotiationModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Request Better Price</Text>

                        {selectedProductForNegotiation && (
                            <View style={styles.negotiationProduct}>
                                <Image
                                    source={selectedProductForNegotiation.imageUrl ?
                                        { uri: `${API_BASE_URL}${selectedProductForNegotiation.imageUrl}` } :
                                        require("../../assets/sample-product.png")}
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
                                    Total: ₹{(parseFloat(proposedPrice) * selectedProductForNegotiation.quantity).toFixed(2)}
                                </Text>
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setNegotiationModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitButton, (!proposedPrice || negotiationLoading) && styles.disabledButton]}
                                onPress={submitNegotiation}
                                disabled={!proposedPrice || negotiationLoading}
                            >
                                <Text style={styles.submitButtonText}>
                                    {negotiationLoading ? 'Submitting...' : 'Submit Request'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    topBar: {
        padding: 20,
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    heading: {
        fontSize: 24,
        fontWeight: '500',
        color: '#1B1B1B',
        alignItems: 'center',
        marginLeft: 20
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    // Business User Styles
    businessBadge: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 'auto',
    },
    businessBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
    },
    businessNotice: {
        backgroundColor: '#E6F2FF',
        marginHorizontal: 16,
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAD73',
    },
    businessNoticeText: {
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
    },
    minQtyText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#FF6B35',
        marginTop: 2,
    },
    shippingText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginTop: 2,
    },
    tierPricingText: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        color: '#4CAD73',
        fontStyle: 'italic',
        marginTop: 2,
    },
    negotiateButton: {
        backgroundColor: '#FFA500',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    negotiateButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: 16,
        textAlign: 'center',
    },
    negotiationProduct: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    negotiationImage: {
        width: 50,
        height: 50,
        borderRadius: 6,
    },
    negotiationProductInfo: {
        flex: 1,
        marginLeft: 12,
    },
    negotiationProductName: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
    },
    negotiationProductDesc: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginTop: 2,
    },
    currentPrice: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
        marginTop: 4,
    },
    currentQuantity: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginTop: 2,
    },
    modalLabel: {
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
        marginBottom: 8,
    },
    priceInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
        marginBottom: 12,
    },
    totalCalculation: {
        backgroundColor: '#F8F9FA',
        padding: 8,
        borderRadius: 6,
        marginBottom: 16,
    },
    totalCalculationText: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
        textAlign: 'center',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
    submitButton: {
        backgroundColor: '#4CAD73',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
    // ... (keep all the existing styles from previous implementation)
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
    },
    seeAllText: {
        fontSize: 14,
        color: '#4CAD73',
        fontFamily: 'Poppins-Medium',
    },
    // Shipping Address Styles
    addressCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    addressContent: {
        // Content styles for when address exists
    },
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    addressName: {
        fontSize: 16,
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
    },
    addressPhone: {
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#666",
    },
    addressText: {
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#333",
        lineHeight: 20,
        marginBottom: 4,
    },
    addressArea: {
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#666",
        marginBottom: 12,
    },
    changeAddressButton: {
        alignSelf: 'flex-start',
    },
    changeAddressText: {
        color: '#4CAD73',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
    noAddressContent: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    noAddressText: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#666',
        marginBottom: 12,
    },
    selectAddressButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    selectAddressText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
    // Special Deal Styles
    specialDealCard: {
        marginHorizontal: 16,
    },
    specialDealInnerCard: {
        backgroundColor: '#E6F2FF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
    },
    dealContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dealTextContent: {
        flex: 1,
    },
    dealTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
        marginBottom: 4,
    },
    dealDescription: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'Poppins-Regular',
        marginBottom: 4,
    },
    dealDiscount: {
        fontSize: 16,
        color: '#4CAD73',
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    dealValid: {
        fontSize: 12,
        color: '#999',
        fontFamily: 'Poppins-Regular',
    },
    dealAddButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginLeft: 12,
    },
    dealAddButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
    dealUnlockText: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    dealUnlockTextContent: {
        fontSize: 14,
        color: '#4CAD73',
        fontFamily: 'Poppins-SemiBold',
    },
    // Cart Items Styles
    cartItem: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    itemLeft: {
        flexDirection: "row",
        flex: 1,
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#F5F6FA",
    },
    image: {
        width: "100%",
        height: "100%",
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 14,
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        lineHeight: 18,
    },
    productDescription: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
        color: "#666",
        marginTop: 2,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        flexWrap: 'wrap',
    },
    finalPrice: {
        fontSize: 14,
        fontFamily: "Poppins-SemiBold",
        color: "#4CAD73",
        marginRight: 6,
    },
    originalPrice: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
        color: "#999",
        textDecorationLine: 'line-through',
        marginRight: 6,
    },
    discountBadge: {
        backgroundColor: '#FFE8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    discountText: {
        fontSize: 10,
        fontFamily: "Poppins-SemiBold",
        color: "#EC0505",
    },
    itemRight: {
        alignItems: "flex-end",
        justifyContent: 'space-between',
    },
    deleteButton: {
        padding: 4,
    },
    deleteIcon: {
        width: 18,
        height: 18,
        tintColor: '#FF3B30',
    },
    disabledIcon: {
        opacity: 0.5,
    },
    quantityControl: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 2,
    },
    quantityButton: {
        padding: 2,
    },
    minusButton: {
        width: 28,
        height: 28,
        borderWidth: 1,
        borderColor: "#4CAD73",
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#FFFFFF',
    },
    plusButton: {
        width: 28,
        height: 28,
        backgroundColor: "#4CAD73",
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
    },
    disabledButton: {
        opacity: 0.5,
    },
    minusText: {
        color: "#4CAD73",
        fontSize: 14,
        fontFamily: "Poppins-SemiBold",
    },
    plusText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontFamily: "Poppins-SemiBold",
    },
    quantityText: {
        fontSize: 14,
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        marginHorizontal: 8,
        minWidth: 20,
        textAlign: 'center',
    },
    // Empty Cart Styles
    emptyCart: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyCartImage: {
        width: 120,
        height: 120,
        marginBottom: 16,
    },
    emptyCartText: {
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyCartSubtitle: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    // Wishlist Styles
    wishlistContainer: {
        paddingHorizontal: 16,
        gap: 12,
    },
    wishlistCard: {
        width: 140,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginRight: 6,
    },
    wishlistImage: {
        width: '100%',
        height: 80,
        borderRadius: 8,
        marginBottom: 8,
    },
    wishlistContent: {
        flex: 1,
    },
    wishlistName: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: 4,
        lineHeight: 16,
    },
    wishlistUnit: {
        fontSize: 10,
        color: '#666',
        fontFamily: 'Poppins-Regular',
        marginBottom: 8,
    },
    wishlistBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wishlistPrice: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
    },
    addButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: 'Poppins-SemiBold',
    },
    // Bill Details Styles
    billCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    billLabel: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#666',
    },
    billValue: {
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
    },
    totalValue: {
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        color: '#4CAD73',
    },
    // Coupon Section
    couponSection: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
        marginBottom: 16,
    },
    couponInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
    },
    applyButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 16,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
    },
    // Delivery Instructions Styles
    instructionsSection: {
        marginHorizontal: 16,
        marginBottom: 20,
    },
    instructionsTitle: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: 12,
    },
    instructionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    instructionCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    instructionCardSelected: {
        borderColor: '#4CAD73',
        backgroundColor: '#F0F9F0',
    },
    instructionIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    instructionTitle: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        textAlign: 'center',
        marginBottom: 4,
    },
    instructionDescription: {
        fontSize: 10,
        color: '#666',
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 12,
    },
    // Cancellation Policy Styles
    cancellationSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cancellationTitle: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: 8,
    },
    cancellationText: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Poppins-Regular',
        lineHeight: 16,
    },
    // Checkout Button
    checkoutButton: {
        backgroundColor: '#4CAD73',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginHorizontal: 16,
    },
    checkoutButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    checkoutLeft: {
        flex: 1,
    },
    checkoutText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 4,
    },
    deliveryText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        opacity: 0.9,
    },
    checkoutPrice: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
});
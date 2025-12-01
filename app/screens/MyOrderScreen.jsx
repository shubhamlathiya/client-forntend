import React, {useState, useEffect} from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, ActivityIndicator, Alert, RefreshControl,
    Modal, SafeAreaView, Dimensions, Platform
} from "react-native";
import {useRouter} from "expo-router";
import {getOrders} from "../../api/ordersApi";
import {API_BASE_URL} from "../../config/apiConfig";
import OrderActionMenu from "../../components/ui/OrderActionMenu";

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

export default function MyOrderScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

    const showMessage = (msg, isError = false) => {
        if (isError) {
            Alert.alert('Error', msg);
        } else {
            Alert.alert('Success', msg);
        }
    };

    const loadOrders = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const res = await getOrders();
            const list = res?.data ?? res;
            const ordersList = Array.isArray(list) ? list : (list?.orders || []);
            setOrders(ordersList);

        } catch (error) {
            console.error('Orders load error:', error);
            showMessage('Failed to load orders', true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const getStatusColor = (status) => {
        const statusLower = status?.toLowerCase();
        switch (statusLower) {
            case "pending":
            case "processing":
            case "confirmed":
            case "placed":
                return "#09CA67";
            case "shipped":
            case "out_for_delivery":
                return "#FFA500";
            case "delivered":
            case "completed":
                return "#4CAD73";
            case "cancelled":
            case "refunded":
            case "returned":
                return "#F34E4E";
            default:
                return "#868889";
        }
    };

    const getStatusText = (status) => {
        const statusLower = status?.toLowerCase();
        switch (statusLower) {
            case "pending":
                return "Pending";
            case "processing":
                return "Processing";
            case "confirmed":
                return "Confirmed";
            case "placed":
                return "Placed";
            case "shipped":
                return "Shipped";
            case "out_for_delivery":
                return "Out for Delivery";
            case "delivered":
                return "Delivered";
            case "completed":
                return "Completed";
            case "cancelled":
                return "Cancelled";
            case "refunded":
                return "Refunded";
            case "returned":
                return "Returned";
            default:
                return status || "Pending";
        }
    };

    // Check if order is eligible for return/replacement
    const isOrderEligibleForReturn = (order) => {
        if (!order) return false;

        const orderStatus = order?.status?.toLowerCase();
        const eligibleStatuses = ['delivered', 'completed'];

        // Check if order is delivered/completed
        if (!eligibleStatuses.includes(orderStatus)) {
            return false;
        }

        // Check if it's within return period
        const orderDate = new Date(order?.placedAt || order?.createdAt);
        const today = new Date();
        const daysSinceOrder = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

        // Return window based on user type
        const returnWindow = isTablet ? 30 : 7; // Adjust based on business logic
        return daysSinceOrder <= returnWindow;
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Date not available";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return "Date not available";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return `₹${Number(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const handleOrderPress = (order) => {
        setSelectedOrderDetail(order);
        setDetailModalVisible(true);
    };

    const handleThreeDotMenu = (order, event) => {
        event?.stopPropagation?.();
        setSelectedOrder(order);
        setMenuVisible(true);
    };

    const handleReorder = (order) => {
        showMessage('Reorder functionality will be implemented soon');
    };

    const handleRateProduct = (product, order) => {
        router.push({
            pathname: '/screens/FeedbackScreen',
            params: {
                product: JSON.stringify(product),
                order: JSON.stringify(order)
            }
        });
    };

    const OrderCard = ({order, index}) => {
        const totalAmount = order?.totals?.grandTotal || order?.priceBreakdown?.grandTotal || order?.total || 0;
        const itemCount = order?.items?.length || 0;
        const isEligibleForReturn = isOrderEligibleForReturn(order);
        const productImages = order?.items?.slice(0, 3).map(item => {
            let imageUrl = item.image || null;
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('file://')) {
                imageUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
            }
            return imageUrl || require("../../assets/icons/order.png");
        }) || [];

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => handleOrderPress(order)}
                activeOpacity={0.7}
            >
                {/* Order Header */}
                <View style={styles.orderHeader}>
                    <View style={styles.orderIconContainer}>
                        <Image
                            source={require("../../assets/icons/order.png")}
                            style={styles.orderIcon}
                        />
                    </View>

                    <View style={styles.orderInfo}>
                        <Text style={styles.orderNumber} numberOfLines={1}>
                            Order #{order.orderNumber || order._id?.substring(0, 8) || 'N/A'}
                        </Text>
                        <View style={styles.orderMeta}>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(totalAmount)}
                            </Text>
                            <Text style={styles.orderDate}>
                                • {formatDate(order.placedAt)}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.threeDotButton}
                        onPress={(e) => handleThreeDotMenu(order, e)}
                        hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                    >
                        <Image
                            source={require('../../assets/icons/menu_dots.png')}
                            style={styles.threeDotIcon}
                        />
                    </TouchableOpacity>
                </View>

                {/* Product Images */}
                <View style={styles.imagesContainer}>
                    {productImages.length > 0 ? (
                        productImages.map((image, imgIndex) => (
                            <Image
                                key={imgIndex}
                                source={typeof image === 'string' ? {uri: image} : image}
                                style={[
                                    styles.productImage,
                                    imgIndex > 0 && styles.overlappingImage
                                ]}
                                defaultSource={require("../../assets/icons/order.png")}
                            />
                        ))
                    ) : (
                        <Image
                            source={require("../../assets/icons/order.png")}
                            style={styles.productImage}
                        />
                    )}
                    {itemCount > 3 && (
                        <View style={[styles.moreItemsBadge, styles.overlappingImage]}>
                            <Text style={styles.moreItemsText}>+{itemCount - 3}</Text>
                        </View>
                    )}
                </View>

                {/* Status Badge */}
                <View style={[styles.statusBadge, {backgroundColor: getStatusColor(order.status)}]}>
                    <Text style={styles.statusText} numberOfLines={1}>
                        {getStatusText(order.status)}
                    </Text>
                </View>

                {/* Order Footer */}
                <View style={styles.orderFooter}>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.textButton}
                            onPress={(e) => {
                                e.stopPropagation?.();
                                handleReorder(order);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.textButtonText}>Reorder</Text>
                        </TouchableOpacity>

                        {(order.status === 'delivered' || order.status === 'completed') && (
                            <TouchableOpacity
                                style={styles.textButton}
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    if (order.items && order.items.length > 0) {
                                        handleRateProduct(order.items[0], order);
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.textButtonText}>Rate Order</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const OrderDetailModal = ({order, visible, onClose}) => {
        if (!order) return null;

        const totalAmount = order?.totals?.grandTotal || order?.priceBreakdown?.grandTotal || order?.total || 0;
        const subtotal = order?.totals?.subtotal || order?.priceBreakdown?.itemsTotal || order?.subtotal || 0;
        const tax = order?.totals?.tax || order?.priceBreakdown?.tax || 0;
        const shipping = order?.totals?.shipping || order?.priceBreakdown?.shipping || 0;
        const discount = order?.totals?.discount || order?.priceBreakdown?.discount || 0;
        const isEligibleForReturn = isOrderEligibleForReturn(order);

        const timeline = order.timeline || generateDefaultTimeline(order);

        function generateDefaultTimeline(orderData) {
            const status = orderData.status?.toLowerCase();
            const baseTimeline = [
                {event: "Order Placed", completed: true, date: orderData.placedAt},
                {event: "Order Confirmed", completed: true, date: orderData.placedAt},
                {
                    event: "Shipped",
                    completed: ['shipped', 'out_for_delivery', 'delivered', 'completed'].includes(status),
                    date: null
                },
                {
                    event: "Out for Delivery",
                    completed: ['out_for_delivery', 'delivered', 'completed'].includes(status),
                    date: null
                },
                {
                    event: "Delivered",
                    completed: ['delivered', 'completed'].includes(status),
                    date: null
                }
            ];

            return baseTimeline;
        }

        const TimelineItem = ({item, isLast, index}) => {
            return (
                <View style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                        {!isLast && (
                            <View style={[
                                styles.timelineLine,
                                item.completed ? styles.timelineLineCompleted : styles.timelineLineIncomplete
                            ]}/>
                        )}
                        <View style={[
                            styles.timelineDot,
                            item.completed ? styles.timelineDotCompleted : styles.timelineDotIncomplete
                        ]}/>
                    </View>

                    <View style={styles.timelineContent}>
                        <Text style={[
                            styles.timelineEvent,
                            item.completed ? styles.timelineEventCompleted : styles.timelineEventIncomplete
                        ]} numberOfLines={1}>
                            {item.event}
                        </Text>
                        <Text style={styles.timelineDate} numberOfLines={1}>
                            {item.date ? formatDateTime(item.date) : 'Pending'}
                        </Text>
                    </View>
                </View>
            );
        };

        return (
            <Modal
                visible={visible}
                animationType="slide"
                statusBarTranslucent={true}
                onRequestClose={onClose}
            >
                <SafeAreaView style={styles.fullScreenModalContainer}>
                    <View style={[styles.fullScreenModalHeader, { paddingTop: safeAreaInsets.top }]}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            activeOpacity={0.7}
                            hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                        >
                            <Image
                                source={require("../../assets/icons/back_icon.png")}
                                style={styles.closeIcon}
                            />
                        </TouchableOpacity>
                        <Text style={styles.fullScreenModalTitle}>Order Details</Text>
                        <View style={styles.placeholder}/>
                    </View>

                    <ScrollView
                        style={styles.fullScreenModalContent}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: safeAreaInsets.bottom + RF(20) }}
                    >
                        {/* Order Summary */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Order Summary</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Order Number:</Text>
                                <Text style={styles.summaryValue} numberOfLines={1}>
                                    {order.orderNumber || order._id || 'N/A'}
                                </Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Order Date:</Text>
                                <Text style={styles.summaryValue} numberOfLines={1}>
                                    {formatDateTime(order.placedAt)}
                                </Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Status:</Text>
                                <View style={[styles.statusBadge, {backgroundColor: getStatusColor(order.status)}]}>
                                    <Text style={styles.statusText}>
                                        {getStatusText(order.status)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Items */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>
                                Items ({order.totalItems || order.items?.length || 0})
                            </Text>
                            {order.items?.map((item, index) => {
                                let itemImage = item.image;
                                if (itemImage && !itemImage.startsWith('http') && !itemImage.startsWith('file://')) {
                                    itemImage = `${API_BASE_URL}${itemImage.startsWith('/') ? itemImage : '/' + itemImage}`;
                                }

                                return (
                                    <View key={index} style={styles.itemRow}>
                                        <Image
                                            source={itemImage ? {uri: itemImage} : require("../../assets/icons/order.png")}
                                            style={styles.itemImage}
                                            defaultSource={require("../../assets/icons/order.png")}
                                        />
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName} numberOfLines={2}>
                                                {item.name || 'Product'}
                                            </Text>
                                            <Text style={styles.itemBrand} numberOfLines={1}>
                                                {item.brand || ''}
                                            </Text>
                                            <Text style={styles.itemPrice} numberOfLines={1}>
                                                {formatCurrency(item.unitPrice || 0)} x {item.quantity || 1}
                                            </Text>
                                            {item.variantAttributes && (
                                                <Text style={styles.itemVariant} numberOfLines={1}>
                                                    {item.variantAttributes}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.itemTotal} numberOfLines={1}>
                                            {formatCurrency(item.finalPrice || (item.unitPrice * item.quantity) || 0)}
                                        </Text>

                                        {(order.status === 'delivered' || order.status === 'completed') && (
                                            <TouchableOpacity
                                                style={styles.rateProductButton}
                                                onPress={() => {
                                                    onClose();
                                                    handleRateProduct(item, order);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.rateProductText}>Rate</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* Price Breakdown */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Price Details</Text>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Subtotal:</Text>
                                <Text style={styles.priceValue}>{formatCurrency(subtotal)}</Text>
                            </View>
                            {discount > 0 && (
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceLabel}>Discount:</Text>
                                    <Text style={[styles.priceValue, styles.discountText]}>
                                        -{formatCurrency(discount)}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Shipping:</Text>
                                <Text style={styles.priceValue}>{formatCurrency(shipping)}</Text>
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Tax:</Text>
                                <Text style={styles.priceValue}>{formatCurrency(tax)}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total Amount:</Text>
                                <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
                            </View>
                        </View>

                        {/* Order Timeline */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Order Timeline</Text>
                            <View style={styles.timelineContainer}>
                                {timeline.map((timelineItem, index) => (
                                    <TimelineItem
                                        key={index}
                                        item={timelineItem}
                                        isLast={index === timeline.length - 1}
                                        index={index}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Payment Information */}
                        {order.payment && (
                            <View style={styles.detailSection}>
                                <Text style={styles.sectionTitle}>Payment Information</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Payment Method:</Text>
                                    <Text style={styles.summaryValue} numberOfLines={1}>
                                        {order.payment.method ?
                                            order.payment.method.charAt(0).toUpperCase() + order.payment.method.slice(1) :
                                            'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Payment Status:</Text>
                                    <Text style={styles.summaryValue} numberOfLines={1}>
                                        {order.payment.status ?
                                            order.payment.status.charAt(0).toUpperCase() + order.payment.status.slice(1) :
                                            'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Paid Amount:</Text>
                                    <Text style={styles.summaryValue}>{formatCurrency(order.payment.amount || 0)}</Text>
                                </View>
                            </View>
                        )}

                        {/* Shipping Address */}
                        {order.shippingAddress && (
                            <View style={styles.detailSection}>
                                <Text style={styles.sectionTitle}>Shipping Address</Text>
                                <Text style={styles.addressText} numberOfLines={1}>
                                    {order.shippingAddress.name}
                                </Text>
                                <Text style={styles.addressText} numberOfLines={1}>
                                    {order.shippingAddress.phone}
                                </Text>
                                <Text style={styles.addressText} numberOfLines={2}>
                                    {order.shippingAddress.address}
                                </Text>
                                <Text style={styles.addressText} numberOfLines={1}>
                                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
                                </Text>
                                <Text style={styles.addressText} numberOfLines={1}>
                                    {order.shippingAddress.country}
                                </Text>
                            </View>
                        )}

                        {/* Return/Replacement Button (if eligible) */}
                        {isEligibleForReturn && (
                            <View style={styles.detailSection}>
                                <TouchableOpacity
                                    style={styles.returnActionButton}
                                    onPress={() => {
                                        onClose();
                                        const payload = {
                                            orderId: String(order._id || order.id),
                                            type: 'return',
                                            orderDetails: JSON.stringify({
                                                items: (Array.isArray(order?.items) ? order.items : []).map((i) => ({
                                                    productId: i.productId,
                                                    productName: i.name,
                                                    quantity: i.quantity || 1,
                                                    image: i.image,
                                                    price: i.unitPrice || 0,
                                                })),
                                                totalPrice: order?.totals?.grandTotal || order?.priceBreakdown?.grandTotal || 0,
                                                placedAt: order?.placedAt,
                                                status: order?.status,
                                                deliveryInfo: 'Delivered',
                                            })
                                        };
                                        router.push({pathname: '/screens/ReturnReplacementScreen', params: payload});
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.returnActionButtonText}>Request Return/Replacement</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
                <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                        hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                    >
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.headerPlaceholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={isTablet ? "large" : "large"} color="#4CAD73"/>
                    <Text style={styles.loadingText}>Loading your orders...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#FFFFFF"
                translucent={false}
            />

            {/* Header */}
            <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
                <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                        activeOpacity={0.7}
                        hitSlop={{top: RF(10), bottom: RF(10), left: RF(10), right: RF(10)}}
                    >
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.headerPlaceholder} />
                </View>
            </SafeAreaView>

            {/* Orders List */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadOrders(true)}
                        colors={["#4CAD73"]}
                        tintColor="#4CAD73"
                        progressViewOffset={safeAreaInsets.top}
                    />
                }
                contentContainerStyle={{
                    paddingBottom: safeAreaInsets.bottom + RF(20),
                    paddingTop: RF(16)
                }}
            >
                <View style={styles.ordersContainer}>
                    {orders.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Image
                                source={require("../../assets/icons/order.png")}
                                style={styles.emptyIcon}
                            />
                            <Text style={styles.emptyTitle}>No orders yet</Text>
                            <Text style={styles.emptyText}>
                                When you place orders, they will appear here
                            </Text>
                        </View>
                    ) : (
                        orders.map((order, index) => (
                            <OrderCard key={order._id || order.id || index} order={order} index={index}/>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Order Action Menu */}
            <OrderActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                onSelect={(action) => {
                    setMenuVisible(false);
                    if (!selectedOrder) return;

                    switch (action) {
                        case 'details':
                            setSelectedOrderDetail(selectedOrder);
                            setDetailModalVisible(true);
                            break;
                        case 'return':
                            const isEligible = isOrderEligibleForReturn(selectedOrder);
                            if (isEligible) {
                                const payload = {
                                    orderId: String(selectedOrder._id || selectedOrder.id),
                                    type: 'return',
                                    orderDetails: JSON.stringify({
                                        items: (Array.isArray(selectedOrder?.items) ? selectedOrder.items : []).map((i) => ({
                                            productId: i.productId,
                                            productName: i.name,
                                            quantity: i.quantity || 1,
                                            image: i.image,
                                            price: i.unitPrice || 0,
                                        })),
                                        totalPrice: selectedOrder?.totals?.grandTotal || selectedOrder?.priceBreakdown?.grandTotal || 0,
                                        placedAt: selectedOrder?.placedAt,
                                        status: selectedOrder?.status,
                                        deliveryInfo: 'Delivered',
                                    })
                                };
                                router.push({pathname: '/screens/ReturnReplacementScreen', params: payload});
                            } else {
                                Alert.alert(
                                    'Not Eligible',
                                    'This order is not eligible for return/replacement. Orders must be delivered/completed and within the return period.'
                                );
                            }
                            break;
                        case 'track':
                            showMessage('Track order functionality will be implemented soon');
                            break;
                    }
                }}
                order={selectedOrder}
                isEligibleForReturn={selectedOrder ? isOrderEligibleForReturn(selectedOrder) : false}
            />

            {/* Order Detail Modal */}
            <OrderDetailModal
                order={selectedOrderDetail}
                visible={detailModalVisible}
                onClose={() => setDetailModalVisible(false)}
            />
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

    // Empty State Styles
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: RH(20),
        paddingHorizontal: RF(20),
    },
    emptyIcon: {
        width: RF(80),
        height: RF(80),
        opacity: 0.5,
        marginBottom: RF(16),
    },
    emptyTitle: {
        fontSize: RF(18),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        marginBottom: RF(8),
    },
    emptyText: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#868889",
        textAlign: "center",
        lineHeight: RF(20),
    },

    // ScrollView Styles
    scrollView: {
        flex: 1,
    },
    ordersContainer: {
        paddingHorizontal: RF(16),
        gap: RF(16),
    },

    // Order Card Styles
    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: RF(12),
        padding: RF(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: RF(2) },
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        elevation: 3,
    },
    orderHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: RF(16),
    },
    orderIconContainer: {
        marginRight: RF(12),
    },
    orderIcon: {
        width: RF(40),
        height: RF(40),
        borderRadius: RF(20),
        backgroundColor: "#EDF8E7",
        justifyContent: "center",
        alignItems: "center",
    },
    orderInfo: {
        flex: 1,
        gap: RF(4),
    },
    orderNumber: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        lineHeight: RF(20),
    },
    orderMeta: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: 'wrap',
        gap: RF(4),
    },
    orderAmount: {
        fontSize: RF(14),
        fontFamily: "Poppins-SemiBold",
        color: "#4CAD73",
    },
    orderDate: {
        fontSize: RF(12),
        fontFamily: "Poppins-Regular",
    },
    threeDotButton: {
        padding: RF(4),
    },
    threeDotIcon: {
        width: RF(20),
        height: RF(20),
    },

    // Image Styles
    imagesContainer: {
        flexDirection: "row",
        marginBottom: RF(12),
    },
    productImage: {
        width: RF(60),
        height: RF(60),
        borderRadius: RF(8),
        backgroundColor: "#F5F5F5",
        borderWidth: 2,
        borderColor: "#FFFFFF",
    },
    overlappingImage: {
        marginLeft: RF(-10),
    },
    moreItemsBadge: {
        width: RF(60),
        height: RF(60),
        borderRadius: RF(8),
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#FFFFFF",
    },
    moreItemsText: {
        color: "#FFFFFF",
        fontSize: RF(14),
        fontFamily: "Poppins-SemiBold",
    },

    // Status Badge
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        borderRadius: RF(16),
        marginBottom: RF(12),
    },
    statusText: {
        fontSize: RF(12),
        fontFamily: "Poppins-Medium",
        color: "#FFFFFF",
    },

    // Action Buttons
    orderFooter: {
        borderTopWidth: 1,
        borderTopColor: "#F5F5F5",
        paddingTop: RF(12),
    },
    actionButtons: {
        flexDirection: "row",
        flexWrap: 'wrap',
        gap: RF(12),
    },
    textButton: {
        paddingVertical: RF(8),
        paddingHorizontal: RF(12),
        borderRadius: RF(6),
    },
    textButtonText: {
        fontSize: RF(14),
        fontFamily: "Poppins-SemiBold",
        color: "#4CAD73",
    },
    returnButton: {
        backgroundColor: '#FFF0F0',
        borderWidth: 1,
        borderColor: '#FF6B6B',
    },
    returnButtonText: {
        color: '#FF6B6B',
    },

    // Order Detail Modal Styles
    fullScreenModalContainer: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    fullScreenModalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: RF(16),
        paddingVertical: RF(12),
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F5",
    },
    fullScreenModalTitle: {
        fontSize: RF(18),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        textAlign: "center",
        flex: 1,
        marginHorizontal: RF(8),
    },
    closeButton: {
        padding: RF(4),
    },
    closeIcon: {
        width: RF(24),
        height: RF(24),
    },
    placeholder: {
        width: RF(32),
    },
    fullScreenModalContent: {
        flex: 1,
        paddingHorizontal: RF(16),
    },

    // Detail Section Styles
    detailSection: {
        marginBottom: RF(24),
    },
    sectionTitle: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        marginBottom: RF(12),
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: RF(8),
    },
    summaryLabel: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#868889",
    },
    summaryValue: {
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
        color: "#1B1B1B",
        flex: 1,
        textAlign: 'right',
        marginLeft: RF(8),
    },

    // Item Row Styles
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: RF(12),
        padding: RF(12),
        backgroundColor: "#F9F9F9",
        borderRadius: RF(8),
    },
    itemImage: {
        width: RF(50),
        height: RF(50),
        borderRadius: RF(6),
        marginRight: RF(12),
        backgroundColor: "#F5F5F5",
    },
    itemInfo: {
        flex: 1,
        marginRight: RF(8),
    },
    itemName: {
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
        color: "#1B1B1B",
        marginBottom: RF(2),
        lineHeight: RF(18),
    },
    itemBrand: {
        fontSize: RF(12),
        fontFamily: "Poppins-Regular",
        color: "#868889",
        marginBottom: RF(2),
    },
    itemPrice: {
        fontSize: RF(12),
        fontFamily: "Poppins-Regular",
        color: "#868889",
        marginBottom: RF(2),
    },
    itemVariant: {
        fontSize: RF(11),
        fontFamily: "Poppins-Regular",
        color: "#666666",
        fontStyle: 'italic',
    },
    itemTotal: {
        fontSize: RF(14),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        marginRight: RF(8),
    },
    rateProductButton: {
        backgroundColor: "#4CAD73",
        paddingHorizontal: RF(12),
        paddingVertical: RF(6),
        borderRadius: RF(6),
    },
    rateProductText: {
        color: "#FFFFFF",
        fontSize: RF(12),
        fontFamily: "Poppins-SemiBold",
    },

    // Price Breakdown Styles
    priceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: RF(8),
    },
    priceLabel: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#868889",
    },
    priceValue: {
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
        color: "#1B1B1B",
    },
    discountText: {
        color: "#F34E4E",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: RF(12),
        paddingTop: RF(12),
        borderTopWidth: 1,
        borderTopColor: "#F5F5F5",
    },
    totalLabel: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
    },
    totalValue: {
        fontSize: RF(16),
        fontFamily: "Poppins-SemiBold",
        color: "#4CAD73",
    },

    // Address Styles
    addressText: {
        fontSize: RF(14),
        fontFamily: "Poppins-Regular",
        color: "#1B1B1B",
        marginBottom: RF(4),
        lineHeight: RF(20),
    },

    // Timeline Styles
    timelineContainer: {
        marginLeft: RF(8),
    },
    timelineItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: RF(20),
    },
    timelineLeft: {
        width: RF(24),
        alignItems: "center",
        marginRight: RF(12),
    },
    timelineLine: {
        width: RF(2),
        flex: 1,
        marginTop: RF(4),
        marginBottom: RF(4),
    },
    timelineLineCompleted: {
        backgroundColor: "#4CAD73",
    },
    timelineLineIncomplete: {
        backgroundColor: "#E5E5E5",
    },
    timelineDot: {
        width: RF(12),
        height: RF(12),
        borderRadius: RF(6),
        borderWidth: RF(2),
    },
    timelineDotCompleted: {
        backgroundColor: "#4CAD73",
        borderColor: "#4CAD73",
    },
    timelineDotIncomplete: {
        backgroundColor: "#FFFFFF",
        borderColor: "#E5E5E5",
    },
    timelineContent: {
        flex: 1,
        paddingTop: 0,
    },
    timelineEvent: {
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
        marginBottom: RF(2),
    },
    timelineEventCompleted: {
        color: "#1B1B1B",
    },
    timelineEventIncomplete: {
        color: "#868889",
    },
    timelineDate: {
        fontSize: RF(12),
        fontFamily: "Poppins-Regular",
        color: "#868889",
    },

    // Return Action Button
    returnActionButton: {
        backgroundColor: "#FF6B6B",
        paddingVertical: RF(14),
        borderRadius: RF(8),
        alignItems: "center",
        marginTop: RF(8),
    },
    returnActionButtonText: {
        color: "#FFFFFF",
        fontSize: RF(14),
        fontFamily: "Poppins-SemiBold",
    },

    // Order Action Menu Styles
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: RF(20),
        borderTopRightRadius: RF(20),
        paddingHorizontal: RF(16),
        paddingTop: RF(8),
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    handleContainer: {
        alignItems: 'center',
        marginBottom: RF(8),
    },
    handle: {
        width: RF(40),
        height: RF(4),
        backgroundColor: '#DADADA',
        borderRadius: RF(2),
    },
    menuTitle: {
        fontSize: RF(16),
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: RF(16),
        textAlign: 'center',
    },
    optionsContainer: {
        marginBottom: RF(16),
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: RF(12),
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    optionIcon: {
        width: RF(20),
        height: RF(20),
        marginRight: RF(12),
    },
    optionLabel: {
        fontSize: RF(15),
        fontFamily: 'Poppins-Regular',
    },
    cancelButton: {
        paddingVertical: RF(14),
        borderRadius: RF(8),
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        marginBottom: RF(8),
    },
    cancelText: {
        fontSize: RF(14),
        fontFamily: 'Poppins-SemiBold',
        color: '#666666',
    },
});
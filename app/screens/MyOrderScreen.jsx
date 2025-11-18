import React, {useState, useEffect} from "react";
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, ActivityIndicator, Alert, RefreshControl,
    Modal, FlatList
} from "react-native";
import {useRouter} from "expo-router";
import AppHeader from "../../components/ui/AppHeader";
import OrderActionMenu from "../../components/ui/OrderActionMenu";
import {getOrders} from "../../api/ordersApi";
import {API_BASE_URL} from "../../config/apiConfig";

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
        switch (status?.toLowerCase()) {
            case "pending":
            case "processing":
            case "confirmed":
            case "placed":
                return "#09CA67";
            case "shipped":
                return "#FFA500";
            case "delivered":
            case "completed":
                return "#4CAD73";
            case "cancelled":
            case "refunded":
                return "#F34E4E";
            default:
                return "#868889";
        }
    };

    const getStatusText = (status) => {
        switch (status?.toLowerCase()) {
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
            case "delivered":
                return "Delivered";
            case "completed":
                return "Completed";
            case "cancelled":
                return "Cancelled";
            case "refunded":
                return "Refunded";
            default:
                return status || "Pending";
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Date not available";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return `$${Number(amount || 0).toFixed(2)}`;
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

    const handleRateOrder = (order) => {
        showMessage('Rate order functionality will be implemented soon');
    };

    const OrderCard = ({order, index}) => {
        const totalAmount = order?.totals?.grandTotal || order?.priceBreakdown?.grandTotal || order?.total || 0;
        const itemCount = order?.totalItems || order?.items?.length || 0;

        // Get first 3 product images with API_BASE_URL
        const productImages = order?.items?.slice(0, 3).map(item => {
            let imageUrl = item.image || null;

            // Add API_BASE_URL if the image is a relative path
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('file://')) {
                imageUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
            }

            return imageUrl || require("../../assets/icons/order.png");
        }) || [];

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => handleOrderPress(order)}
            >
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>
                {/* Order Header - New Design */}
                <View style={styles.orderHeader}>
                    {/* Left Side Icon */}
                    <View style={styles.orderIconContainer}>
                        <Image
                            source={require("../../assets/icons/order.png")}
                            style={styles.orderIcon}
                        />
                    </View>

                    {/* Order Info - Two Lines */}
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderNumber}>
                            {(order.orderNumber || order._id?.substring(18) || 'N/A').substring(0, 18)}...
                        </Text>
                        <View style={styles.orderMeta}>
                            <Text style={styles.orderAmount}>
                                {formatCurrency(totalAmount)}
                            </Text>
                            <Text style={styles.orderDate}>
                                • Placed on {formatDate(order.placedAt)}
                            </Text>
                        </View>
                    </View>

                    {/* Three Dot Icon */}
                    <TouchableOpacity
                        style={styles.threeDotButton}
                        onPress={(e) => handleThreeDotMenu(order, e)}
                    >
                        <Image
                            source={require('../../assets/icons/menu_dots.png')}
                            style={styles.threeDotIcon}
                        />
                    </TouchableOpacity>
                </View>

                {/* Product Images - No Changes */}
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

                {/* Order Footer - Text Only Buttons */}
                <View style={styles.orderFooter}>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.textButton}
                            onPress={(e) => {
                                e.stopPropagation?.();
                                handleReorder(order);
                            }}
                        >
                            <Text style={styles.textButtonText}>Reorder</Text>
                        </TouchableOpacity>

                        {/*{(order.status === 'delivered' || order.status === 'completed') && (*/}
                            <TouchableOpacity
                                style={styles.textButton}
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    handleRateOrder(order);
                                }}
                            >
                                <Text style={styles.textButtonText}>Rate Order</Text>
                            </TouchableOpacity>
                        {/*)}*/}
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

        return (
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={styles.modalContainer}>
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Image
                                source={require("../../assets/icons/back_icon.png")}
                                style={styles.closeIcon}
                            />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Order Details</Text>
                        <View style={styles.placeholder} />
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {/* Order Summary */}
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Order Summary</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Order Number:</Text>
                                <Text style={styles.summaryValue}>
                                    {order.orderNumber || order._id?.substring(18) || 'N/A'}
                                </Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Order Date:</Text>
                                <Text style={styles.summaryValue}>
                                    {formatDate(order.placedAt)}
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
                            <Text style={styles.sectionTitle}>Items ({order.totalItems || order.items?.length || 0})</Text>
                            {order.items?.map((item, index) => {
                                // Process image URL for each item
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
                                            <Text style={styles.itemName}>
                                                {item.name || 'Product'}
                                            </Text>
                                            <Text style={styles.itemBrand}>
                                                {item.brand || ''}
                                            </Text>
                                            <Text style={styles.itemPrice}>
                                                {formatCurrency(item.unitPrice || 0)} x {item.quantity || 1}
                                            </Text>
                                            {item.variantAttributes && (
                                                <Text style={styles.itemVariant}>
                                                    {item.variantAttributes}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.itemTotal}>
                                            {formatCurrency(item.finalPrice || (item.unitPrice * item.quantity) || 0)}
                                        </Text>
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
                                    <Text style={[styles.priceValue, styles.discountText]}>-{formatCurrency(discount)}</Text>
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

                        {/* Payment Information */}
                        {order.payment && (
                            <View style={styles.detailSection}>
                                <Text style={styles.sectionTitle}>Payment Information</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Payment Method:</Text>
                                    <Text style={styles.summaryValue}>
                                        {order.payment.method ? order.payment.method.charAt(0).toUpperCase() + order.payment.method.slice(1) : 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Payment Status:</Text>
                                    <Text style={styles.summaryValue}>
                                        {order.payment.status ? order.payment.status.charAt(0).toUpperCase() + order.payment.status.slice(1) : 'N/A'}
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
                                <Text style={styles.addressText}>
                                    {order.shippingAddress.name}
                                </Text>
                                <Text style={styles.addressText}>
                                    {order.shippingAddress.phone}
                                </Text>
                                <Text style={styles.addressText}>
                                    {order.shippingAddress.address}
                                </Text>
                                <Text style={styles.addressText}>
                                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
                                </Text>
                                <Text style={styles.addressText}>
                                    {order.shippingAddress.country}
                                </Text>
                            </View>
                        )}

                        {/* Order Timeline */}
                        {order.timeline && order.timeline.length > 0 && (
                            <View style={styles.detailSection}>
                                <Text style={styles.sectionTitle}>Order Timeline</Text>
                                {order.timeline.map((timelineItem, index) => (
                                    <View key={index} style={styles.timelineItem}>
                                        <View style={[
                                            styles.timelineDot,
                                            {backgroundColor: timelineItem.completed ? '#4CAD73' : '#E5E5E5'}
                                        ]} />
                                        <View style={styles.timelineContent}>
                                            <Text style={styles.timelineEvent}>
                                                {timelineItem.event}
                                            </Text>
                                            <Text style={styles.timelineDate}>
                                                {timelineItem.date ? formatDate(timelineItem.date) : 'Pending'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>
                <AppHeader title="My Orders"/>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAD73"/>
                    <Text style={styles.loadingText}>Loading your orders...</Text>
                </View>
            </View>
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
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>

            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.iconBox}
                    />
                </TouchableOpacity>
                <Text style={styles.heading}>My Orders</Text>
            </View>

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
                    />
                }
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

            {/* Three Dot Menu */}
            <OrderActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                onSelect={(action) => {
                    setMenuVisible(false);
                    if (!selectedOrder) return;

                    switch (action) {
                        case 'share':
                            showMessage('Share order functionality will be implemented soon');
                            break;
                        case 'delete':
                            showMessage('Delete order functionality will be implemented soon');
                            break;
                        case 'return':
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
                            router.push({ pathname: '/screens/ReturnReplacementScreen', params: payload });
                            break;
                        case 'details':
                            setSelectedOrderDetail(selectedOrder);
                            setDetailModalVisible(true);
                            break;
                    }
                }}
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
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
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
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        fontFamily: "Poppins",
        color: "#868889",
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        gap: 16,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#868889",
    },
    emptyText: {
        fontSize: 14,
        fontFamily: "Poppins",
        color: "#868889",
        textAlign: "center",
    },
    scrollView: {
        flex: 1,
    },
    ordersContainer: {
        padding: 16,
        gap: 16,
    },
    statusContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#FFFFFF",
    },
    orderTotal: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#4CAD73",
    },
    reorderButton: {
        flex: 1,
        backgroundColor: "#4CAD73",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    reorderText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
    rateButton: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#4CAD73",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    rateText: {
        color: "#4CAD73",
        fontSize: 14,
        fontWeight: "600",
    },




    orderCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 12,
    },
    orderHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    orderIconContainer: {
        marginRight: 12,
    },
    orderIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#EDF8E7",
        justifyContent: "center",
        alignItems: "center",
    },
    orderInfo: {
        flex: 1,
        gap: 4,
    },
    orderNumber: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#000000",
        lineHeight: 20,
    },
    orderMeta: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: 'wrap',
        gap: 4,
    },
    orderAmount: {
        fontSize: 14,
        fontFamily: "Poppins",
        fontWeight: "600",
        color: "#4CAD73",
    },
    orderDate: {
        fontSize: 12,
        fontFamily: "Poppins",
        fontWeight: "400",
        color: "#868889",
    },
    threeDotButton: {
        padding: 4,
        marginLeft: 8,
    },
    threeDotIcon: {
        width: 20,
        height: 20,
    },
    imagesContainer: {
        flexDirection: "row",
        marginBottom: 16,
        position: "relative",
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: "#F5F5F5",
    },
    overlappingImage: {
        marginLeft: -10,
    },
    moreItemsBadge: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    moreItemsText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
    orderFooter: {
        width: "auto",
        borderTopWidth: 1,
        borderTopColor: "#F5F5F5",
        paddingTop: 12,
    },
    actionButtons: {
        flexDirection: "row",
        gap: 20,
    },
    textButton: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 4,
    },
    textButtonText: {
        color: "#4CAD73",
        fontSize: 14,
        fontWeight: "600",
        fontFamily: "Poppins",
    },
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F5F5",
    },
    closeButton: {
        padding: 4,
    },
    closeIcon: {
        width: 24,
        height: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#000000",
    },
    placeholder: {
        width: 24,
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    detailSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000000",
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: "#868889",
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: "500",
        color: "#000000",
    },
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        padding: 8,
        backgroundColor: "#F9F9F9",
        borderRadius: 8,
    },
    itemImage: {
        width: 50,
        height: 50,
        borderRadius: 6,
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: "500",
        color: "#000000",
        marginBottom: 2,
    },
    itemBrand: {
        fontSize: 12,
        color: "#868889",
        marginBottom: 2,
    },
    itemPrice: {
        fontSize: 12,
        color: "#868889",
        marginBottom: 2,
    },
    itemVariant: {
        fontSize: 11,
        color: "#666666",
        fontStyle: 'italic',
    },
    itemTotal: {
        fontSize: 14,
        fontWeight: "600",
        color: "#000000",
    },
    priceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    priceLabel: {
        fontSize: 14,
        color: "#868889",
    },
    priceValue: {
        fontSize: 14,
        color: "#000000",
    },
    discountText: {
        color: "#F34E4E",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#F5F5F5",
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000000",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "600",
        color: "#4CAD73",
    },
    addressText: {
        fontSize: 14,
        color: "#000000",
        marginBottom: 4,
    },
    timelineItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
        marginTop: 2,
    },
    timelineContent: {
        flex: 1,
    },
    timelineEvent: {
        fontSize: 14,
        fontWeight: "500",
        color: "#000000",
        marginBottom: 2,
    },
    timelineDate: {
        fontSize: 12,
        color: "#868889",
    },
});
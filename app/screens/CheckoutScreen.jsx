import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter, useSegments} from "expo-router";
import {useEffect, useState} from "react";
import {
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {getCart} from '../../api/cartApi';
import {getProductById} from '../../api/catalogApi';
import {API_BASE_URL} from '../../config/apiConfig';


export default function CheckoutScreen() {
    const router = useRouter();


    const handleBack = () => {
        // Check if there’s a previous route in history
        if (router.canGoBack()) {
            router.back();
        } else {
            // Alternative action - go to home or do nothing
            router.replace('/Home');
        }
    };
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [subtotal, setSubtotal] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [finalTotal, setFinalTotal] = useState(0);

    useEffect(() => {
        let mounted = true;

        async function loadCart() {
            setLoading(true);
            try {
                const res = await getCart();
                const data = res?.data || res || {};
                const cartItems = data?.items || [];
                const disc = Number(data?.discount || 0);
                const total = Number(data?.cartTotal || 0);
                // Attempt to enrich items with product details
                const enriched = await Promise.all(cartItems.map(async (ci) => {
                    const base = {
                        productId: ci?.productId,
                        variantId: ci?.variantId || null,
                        quantity: Number(ci?.quantity || 1),
                        price: Number(ci?.price || 0),
                        finalPrice: Number(ci?.finalPrice || ci?.price || 0),
                        name: 'Product',
                        imageUrl: null,
                    };
                    try {
                        if (ci?.productId) {
                            const pr = await getProductById(String(ci.productId));
                            const p = pr?.data || pr?.product || pr || null;
                            return {
                                ...base,
                                name: p?.title || p?.name || base.productId || 'Product',
                                imageUrl: p?.thumbnail
                                    ? `${API_BASE_URL}${p.thumbnail}`
                                    : (p?.images?.[0]?.url ? `${API_BASE_URL}${p.images[0].url}` : null),
                            };
                        }
                    } catch (_) {
                    }
                    return base;
                }));

                const sub = enriched.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
                if (mounted) {
                    setItems(enriched);
                    setSubtotal(sub);
                    setDiscount(disc);
                    setFinalTotal(total);
                }
            } catch (e) {
                console.log('Checkout cart error:', e?.response?.data || e?.message || e);
                if (mounted) {
                    setItems([]);
                    setSubtotal(0);
                    setDiscount(0);
                    setFinalTotal(0);
                }
            } finally {
                setLoading(false);
            }
        }

        loadCart();
        return () => {
            mounted = false;
        };
    }, []);

    const handleProceed = () => {
        // Navigate to address selection for checkout
        router.push('/screens/AddressListScreen');
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
                <Text style={styles.heading}>Checkout</Text>

            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}>
                {(!loading && items.length === 0) ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>Your cart is empty</Text>
                    </View>
                ) : (
                    <View style={styles.itemsContainer}>
                        {items.map((item, index) => (
                            <View key={`${item.productId}-${index}`} style={styles.itemCard}>
                                <View style={styles.itemLeft}>
                                    <View style={styles.imageBox}>
                                        <Image
                                            source={item.imageUrl ? {uri: item.imageUrl} : require('../../assets/sample-product.png')}
                                            style={styles.image}
                                        />
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                                        <Text style={styles.itemMeta}>Unit: ${Number(item.price).toFixed(2)}</Text>
                                    </View>
                                </View>
                                <View style={styles.itemRight}>
                                    <Text
                                        style={styles.itemTotal}>${(Number(item.price) * Number(item.quantity)).toFixed(2)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Cart Summary</Text>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>${Number(subtotal).toFixed(2)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Discount</Text>
                            <Text style={styles.summaryValue}>-${Number(discount).toFixed(2)}</Text>
                        </View>
                        <View style={styles.divider}/>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>${Number(finalTotal).toFixed(2)}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.proceedButton} onPress={handleProceed}>
                        <Text style={styles.proceedText}>Select Address</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1, backgroundColor: '#FFFFFF'},
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
    scrollView: {flex: 1},
    scrollContent: {paddingHorizontal: 20, paddingBottom: 24},

    emptyState: {paddingVertical: 60, alignItems: 'center'},
    emptyText: {fontSize: 16, color: '#838383', fontFamily: 'Poppins'},

    itemsContainer: {gap: 12},
    itemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: '#E6E6E6',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    itemLeft: {flexDirection: 'row', alignItems: 'center', gap: 12},
    imageBox: {width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2F2F2'},
    image: {width: '100%', height: '100%'},
    itemInfo: {gap: 4},
    itemName: {fontSize: 14, fontFamily: 'Poppins', fontWeight: '500', color: '#1B1B1B'},
    itemMeta: {fontSize: 12, fontFamily: 'Poppins', color: '#838383'},
    itemRight: {},
    itemTotal: {fontSize: 16, fontFamily: 'Poppins', fontWeight: 'bold', color: '#4CAD73'},

    summarySection: {marginTop: 20, gap: 12},
    sectionTitle: {fontSize: 16, fontFamily: 'Poppins', fontWeight: 'bold', color: '#1B1B1B'},
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E6E6E6'
    },
    summaryRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    summaryLabel: {fontSize: 14, fontFamily: 'Poppins', color: '#838383'},
    summaryValue: {fontSize: 14, fontFamily: 'Poppins', fontWeight: 'bold', color: '#1B1B1B'},
    divider: {width: '100%', height: 1, backgroundColor: '#EDEDED'},
    totalRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    totalLabel: {fontSize: 14, fontFamily: 'Poppins', fontWeight: 'bold', color: '#1B1B1B'},
    totalValue: {fontSize: 20, fontFamily: 'Poppins', fontWeight: 'bold', color: '#4CAD73'},
    proceedButton: {
        height: 48,
        borderRadius: 12,
        backgroundColor: '#4CAD73',
        alignItems: 'center',
        justifyContent: 'center'
    },
    proceedText: {fontSize: 16, fontFamily: 'Poppins', fontWeight: '500', color: '#FFFFFF'},
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View
} from "react-native";
import { addCartItem, getCartItems, getOrCreateSessionId, removeCartItem, updateCartItem } from '../../api/cartApi';
import { getProducts } from '../../api/catalogApi';
import { API_BASE_URL } from '../../config/apiConfig';

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export default function ProductsScreen({ selectedCategory, searchQuery }) {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({});
    const [loginType, setLoginType] = useState('individual');

    useEffect(() => {
        let mounted = true;

        async function load() {
            setLoading(true);
            try {
                const [productsRes, cartRes] = await Promise.all([
                    getProducts({ page: 1, limit: 50 }), // Increased limit to get more products for filtering
                    loadCartItems()
                ]);

                const payload = productsRes?.data ?? productsRes;
                const items = Array.isArray(payload)
                    ? payload
                    : (payload?.items || productsRes?.data?.items || productsRes?.items || []);

                if (mounted) {
                    setProducts(items);
                    setFilteredProducts(items); // Initialize filtered products with all products
                }
            } catch (e) {
                console.log('Products fetch error:', e?.response?.data || e?.message || e);
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, []);

    // Filter products when category or search query changes
    useEffect(() => {
        let filtered = [...products];

        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(product =>
                product.categoryIds?.includes(selectedCategory) ||
                product.categoryId === selectedCategory
            );
        }

        // Filter by search query
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
    }, [selectedCategory, searchQuery, products]);

    // Load cart items
    const loadCartItems = async () => {
        try {
            const sessionId = await getOrCreateSessionId();
            if (sessionId) {
                const cartData = await getCartItems(sessionId);
                setCartItems(cartData?.items || []);
                return cartData;
            }
        } catch (error) {
            console.log('Error loading cart:', error);
        }
    };

    // Load login type
    useEffect(() => {
        (async () => {
            try {
                const lt = await AsyncStorage.getItem('loginType');
                if (lt) setLoginType(lt);
            } catch (_) { }
        })();
    }, []);

    function handleProductClick(id) {
        router.replace({ pathname: "/screens/ProductDetailScreen", params: { id: String(id) } });
    }

    function getProductId(item) {
        return item?.id || item?._id || item?.productId;
    }

    function computeProductPrice(item) {
        const base = Number(item?.basePrice ?? item?.price ?? 0);
        const discount = item?.discount && typeof item.discount.value === 'number' ? Number(item.discount.value) : 0;
        const hasPercent = item?.discount?.type === 'percent' && discount > 0;
        const final = hasPercent ? (base - (base * discount / 100)) : base;
        return { base, final, hasDiscount: hasPercent };
    }

    function getBusinessPriceInfo(item) {
        const priceRange = item?.priceRange;
        const negotiated = item?.negotiatedPrice ?? item?.businessPrice;
        const tiers = item?.tierPricing || item?.priceTiers || item?.tiers || [];
        let mainText = '';
        if (typeof negotiated === 'number' && negotiated > 0) {
            mainText = `$${Number(negotiated).toFixed(2)} (Negotiated)`;
        } else if (priceRange && (priceRange.min || priceRange.max)) {
            const min = Number(priceRange.min ?? 0).toFixed(2);
            const max = Number(priceRange.max ?? min).toFixed(2);
            mainText = `$${min} - $${max}`;
        }
        let tierText = '';
        if (Array.isArray(tiers) && tiers.length > 0) {
            const t0 = tiers[0] || {};
            const minQty = t0.minQty ?? t0.min ?? 0;
            const maxQty = t0.maxQty ?? t0.max ?? null;
            const price = t0.negotiatedPrice ?? t0.price ?? t0.unitPrice ?? null;
            const qtyPart = maxQty ? `${minQty}-${maxQty}` : `≥${minQty}`;
            if (price != null) tierText = `Tier: ${qtyPart} @ $${Number(price).toFixed(2)}`;
        }
        return { mainText, tierText };
    }

    function computeVariantPrice(variant, product) {
        const vFinal = variant?.finalPrice;
        const vBase = variant?.basePrice;
        const base = Number(vBase ?? vFinal ?? product?.basePrice ?? 0);
        const discount = product?.discount && typeof product.discount.value === 'number' ? Number(product.discount.value) : 0;
        const hasPercent = product?.discount?.type === 'percent' && discount > 0 && vFinal == null;
        const final = hasPercent ? (base - (base * discount / 100)) : Number(vFinal ?? base);
        return { base: Number(base), final: Number(final), hasDiscount: hasPercent };
    }

    const getCartQuantity = (productId, variantId = null) => {
        const item = cartItems.find(cartItem =>
            cartItem.productId === String(productId) &&
            cartItem.variantId === (variantId ? String(variantId) : null)
        );
        return item ? item.quantity : 0;
    };

    async function handleAddToCart(item) {
        try {
            const productId = getProductId(item);
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const selectedVariantId = selectedVariants[String(productId)] || null;
            const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
            const effectiveVariantId = selectedVariantId || (defaultVariant ? String(defaultVariant?._id || defaultVariant?.id || defaultVariant?.variantId) : null);
            const sessionId = await getOrCreateSessionId();
            const payload = {
                productId: String(productId),
                quantity: 1,
                variantId: effectiveVariantId ? String(effectiveVariantId) : null,
                ...(sessionId ? { sessionId: String(sessionId) } : {}),
            };
            await addCartItem(payload);
            await loadCartItems();
            if (Platform.OS === 'android') {
                ToastAndroid.show('Added to cart', ToastAndroid.SHORT);
            } else {
                Alert.alert('', 'Added to cart');
            }
        } catch (e) {
            console.log('Add to cart error:', e);
        }
    }

    async function handleUpdateQuantity(productId, variantId, newQuantity) {
        try {
            const sessionId = await getOrCreateSessionId();

            if (newQuantity === 0) {
                await removeCartItem(productId, variantId, sessionId);
                await loadCartItems();
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Removed from cart', ToastAndroid.SHORT);
                }
            } else {
                await updateCartItem(productId, { quantity: newQuantity, variantId }, { sessionId });
                await loadCartItems();
            }
        } catch (error) {
            console.log('Update quantity error:', error);
            Alert.alert('Error', 'Failed to update quantity');
        }
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Results Count */}
            <View style={styles.resultsInfo}>
                <Text style={styles.resultsText}>
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
                    {selectedCategory && ' in this category'}
                    {searchQuery && ` for "${searchQuery}"`}
                </Text>
            </View>

            {/* Product Grid */}
            <View style={styles.grid}>
                {loading ? (
                    <Text style={styles.loadingText}>Loading products…</Text>
                ) : (filteredProducts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No products found</Text>
                        <Text style={styles.emptySubtext}>
                            {selectedCategory || searchQuery
                                ? 'Try changing your filters or search term'
                                : 'No products available at the moment'}
                        </Text>
                    </View>
                ) : filteredProducts.map((item, index) => {
                    const productId = getProductId(item);
                    const selectedVariantId = selectedVariants[String(productId)] || null;
                    const productPrice = computeProductPrice(item);
                    const images = Array.isArray(item?.images) ? item.images : [];
                    const variants = Array.isArray(item?.variants) ? item.variants : [];
                    const showDiscount = productPrice.hasDiscount;
                    const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
                    const effectiveVariantId = selectedVariantId || (defaultVariant ? String(defaultVariant?._id || defaultVariant?.id || defaultVariant?.variantId) : null);
                    const selectedVariantObj = variants.find(v => String(v?._id || v?.id || v?.variantId) === String(effectiveVariantId)) || null;
                    const displayFinalPrice = effectiveVariantId
                        ? computeVariantPrice(selectedVariantObj || {}, item).final
                        : productPrice.final;
                    const isOutOfStock = effectiveVariantId ? (selectedVariantObj?.stock === 0) : (item?.stock === 0);
                    const isBusiness = String(loginType || '').toLowerCase() === 'business';
                    const bizInfo = isBusiness ? getBusinessPriceInfo(item) : null;
                    const cartQuantity = getCartQuantity(productId, effectiveVariantId);

                    return (
                        <View key={index} style={[styles.card, { width: CARD_WIDTH }]}>
                            <TouchableOpacity onPress={() => handleProductClick(productId)}>
                                <View style={styles.imageContainer}>
                                    <Image style={styles.image}
                                           source={item?.thumbnail ? { uri: `${API_BASE_URL}${item.thumbnail}` } : require("../../assets/icons/fruit.png")} />
                                </View>

                                <View style={styles.content}>
                                    <Text style={styles.name}>
                                        {item?.title || item?.name}
                                        {item?.brandId?.name ? ` · ${item.brandId.name}` : ''}
                                    </Text>
                                    {variants.length > 0 && selectedVariantObj ? (
                                        <Text style={styles.tierText}>
                                            {Array.isArray(selectedVariantObj?.attributes) && selectedVariantObj.attributes.length
                                                ? selectedVariantObj.attributes.map(a => a?.value || a?.name || '').filter(Boolean).join(' / ')
                                                : (selectedVariantObj?.sku ? String(selectedVariantObj.sku) : 'Default Variant')}
                                        </Text>
                                    ) : null}
                                    {((String(loginType || '').toLowerCase() === 'business' && (bizInfo?.mainText || displayFinalPrice != null)) ||
                                        (String(loginType || '').toLowerCase() !== 'business' && displayFinalPrice != null)) && (
                                        <View style={styles.priceRow}>
                                            {String(loginType || '').toLowerCase() === 'business' ? (
                                                <>
                                                    {bizInfo?.mainText ? (
                                                        <Text style={styles.newPrice}>{bizInfo.mainText}</Text>
                                                    ) : (
                                                        <Text
                                                            style={styles.newPrice}>${Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {showDiscount && (
                                                        <Text
                                                            style={styles.oldPrice}>${Number(productPrice.base).toFixed(2)}</Text>
                                                    )}
                                                    <Text
                                                        style={styles.newPrice}>${Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                                </>
                                            )}
                                        </View>
                                    )}
                                    {variants.length > 0 && selectedVariantObj ? (
                                        <Text style={styles.tierText}>Stock: {selectedVariantObj?.stock ?? '-'}</Text>
                                    ) : null}
                                    {String(loginType || '').toLowerCase() === 'business' && bizInfo?.tierText ? (
                                        <Text style={styles.tierText}>{bizInfo.tierText}</Text>
                                    ) : null}

                                    {cartQuantity > 0 ? (
                                        <View style={styles.quantityControl}>
                                            <TouchableOpacity
                                                style={styles.quantityButton}
                                                onPress={() => handleUpdateQuantity(productId, effectiveVariantId, cartQuantity - 1)}
                                            >
                                                <View style={styles.minusButton}>
                                                    <Text style={styles.minusText}>-</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <Text style={styles.quantityText}>{cartQuantity}</Text>

                                            <TouchableOpacity
                                                style={styles.quantityButton}
                                                onPress={() => handleUpdateQuantity(productId, effectiveVariantId, cartQuantity + 1)}
                                                disabled={isOutOfStock}
                                            >
                                                <View
                                                    style={[styles.plusButton, isOutOfStock && styles.disabledButton]}>
                                                    <Text
                                                        style={[styles.plusText, isOutOfStock && styles.disabledText]}>+</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.cartButton, isOutOfStock && styles.disabledButton]}
                                            onPress={() => handleAddToCart(item)}
                                            disabled={isOutOfStock}
                                        >
                                            <Image
                                                style={[styles.cartIcon, isOutOfStock && styles.disabledIcon]}
                                                source={require("../../assets/icons/plus.png")}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                }))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 30 , padding:20 },
    resultsInfo: {
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    resultsText: {
        fontFamily: 'Poppins',
        fontSize: 14,
        color: '#838383',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontFamily: 'Poppins',
        fontSize: 16,
        color: '#1B1B1B',
        marginBottom: 8,
    },
    emptySubtext: {
        fontFamily: 'Poppins',
        fontSize: 14,
        color: '#838383',
        textAlign: 'center',
    },
    // ... rest of the styles remain the same as your original file
    categories: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    categoryItem: { alignItems: "center" },
    categoryText: {
        fontFamily: "Poppins",
        fontSize: 14,
        color: "#1B1B1B",
    },
    activeText: { color: "#4CAD73", fontWeight: "500" },
    activeLine: {
        width: 40,
        height: 4,
        backgroundColor: "#4CAD73",
        borderRadius: 5,
        marginTop: 4,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 16,
    },
    loadingText: { fontFamily: 'Poppins', fontSize: 14, color: '#838383' },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        overflow: "hidden",
    },
    imageContainer: {
        height: 120,
        backgroundColor: "#C4C4C4",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        overflow: "hidden",
    },
    image: { width: "100%", height: "100%" },
    content: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 4,
        position: 'relative',
    },
    name: {
        fontFamily: "Poppins",
        fontSize: 14,
        fontWeight: "500",
        color: "#000",
    },
    priceRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 4,
    },
    oldPrice: {
        fontSize: 12,
        color: "#838383",
        textDecorationLine: "line-through",
    },
    newPrice: {
        fontSize: 16,
        fontWeight: "500",
        color: "#4CAD73",
    },
    tierText: {
        fontSize: 12,
        color: "#838383",
        marginTop: 2,
        fontFamily: 'Poppins'
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    quantityButton: {
        padding: 4,
    },
    minusButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#E8E8E8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#4CAD73',
        justifyContent: 'center',
        alignItems: 'center',
    },
    minusText: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
    },
    plusText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: 12,
        minWidth: 20,
        textAlign: 'center',
    },
    disabledButton: {
        backgroundColor: '#CCCCCC',
        opacity: 0.6,
    },
    disabledText: {
        color: '#999999',
    },
    disabledIcon: {
        opacity: 0.5,
    },
    cartButton: {
        position: "absolute",
        right: 12,
        bottom: 12,
        width: 32,
        height: 32,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 8,
    },
    cartIcon: {
        width: 32,
        height: 32,
    },
});
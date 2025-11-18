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
    View,
    Modal,
    FlatList,
    SafeAreaView
} from "react-native";
import { addCartItem, getCartItems, getOrCreateSessionId, removeCartItem, updateCartItem } from '../../api/cartApi';
import { getProducts, getCategories } from '../../api/catalogApi';
import { API_BASE_URL } from '../../config/apiConfig';

const { width, height } = Dimensions.get("window");

export default function ProductsScreen({ selectedCategory, searchQuery }) {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({});
    const [loginType, setLoginType] = useState('individual');
    const [activeCategory, setActiveCategory] = useState(null);
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            setLoading(true);
            try {
                const [productsRes, categoriesRes, cartRes] = await Promise.all([
                    getProducts({ page: 1, limit: 50 }),
                    getCategories(),
                    loadCartItems()
                ]);

                const payload = productsRes?.data ?? productsRes;
                const items = Array.isArray(payload)
                    ? payload
                    : (payload?.items || productsRes?.data?.items || productsRes?.items || []);

                // Process categories
                const categoriesData = categoriesRes?.data ?? categoriesRes;
                const categoriesList = Array.isArray(categoriesData)
                    ? categoriesData
                    : (categoriesData?.data || categoriesData?.items || []);

                if (mounted) {
                    setProducts(items);
                    setFilteredProducts(items);
                    setCategories(categoriesList);
                    if (categoriesList.length > 0) {
                        setActiveCategory(categoriesList[0]);
                    }
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

        // Filter by active category
        if (activeCategory) {
            filtered = filtered.filter(product =>
                product.categoryIds?.includes(activeCategory._id) ||
                product.categoryId === activeCategory._id ||
                product.category?._id === activeCategory._id
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
    }, [activeCategory, searchQuery, products]);

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
        return { base, final, hasDiscount: hasPercent, discountPercent: discount };
    }

    function getBusinessPriceInfo(item) {
        const priceRange = item?.priceRange;
        const negotiated = item?.negotiatedPrice ?? item?.businessPrice;
        const tiers = item?.tierPricing || item?.priceTiers || item?.tiers || [];
        let mainText = '';
        if (typeof negotiated === 'number' && negotiated > 0) {
            mainText = `₹${Number(negotiated).toFixed(2)} (Negotiated)`;
        } else if (priceRange && (priceRange.min || priceRange.max)) {
            const min = Number(priceRange.min ?? 0).toFixed(2);
            const max = Number(priceRange.max ?? min).toFixed(2);
            mainText = `₹${min} - ₹${max}`;
        }
        let tierText = '';
        if (Array.isArray(tiers) && tiers.length > 0) {
            const t0 = tiers[0] || {};
            const minQty = t0.minQty ?? t0.min ?? 0;
            const maxQty = t0.maxQty ?? t0.max ?? null;
            const price = t0.negotiatedPrice ?? t0.price ?? t0.unitPrice ?? null;
            const qtyPart = maxQty ? `${minQty}-${maxQty}` : `≥${minQty}`;
            if (price != null) tierText = `Tier: ${qtyPart} @ ₹${Number(price).toFixed(2)}`;
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

    async function handleAddToCart(item, variant = null) {
        try {
            const productId = getProductId(item);
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const selectedVariantId = variant ? String(variant._id || variant.id) : selectedVariants[String(productId)];
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

            // Close variant modal if open
            if (variant) {
                setShowVariantModal(false);
                setSelectedProductForVariant(null);
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

    const handleVariantSelect = (product) => {
        setSelectedProductForVariant(product);
        setShowVariantModal(true);
    };

    const closeVariantModal = () => {
        setShowVariantModal(false);
        setSelectedProductForVariant(null);
    };

    const renderProductItem = ({ item }) => {
        const productId = getProductId(item);
        const productPrice = computeProductPrice(item);
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        const showDiscount = productPrice.hasDiscount;
        const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
        const selectedVariantId = selectedVariants[String(productId)];
        const selectedVariantObj = variants.find(v => String(v?._id || v?.id) === String(selectedVariantId)) || defaultVariant;
        const displayFinalPrice = selectedVariantObj
            ? computeVariantPrice(selectedVariantObj, item).final
            : productPrice.final;
        const isOutOfStock = selectedVariantObj ? (selectedVariantObj?.stock === 0) : (item?.stock === 0);
        const isBusiness = String(loginType || '').toLowerCase() === 'business';
        const bizInfo = isBusiness ? getBusinessPriceInfo(item) : null;
        const cartQuantity = getCartQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id);
        const hasMultipleVariants = variants.length > 1;

        return (
            <View style={styles.productCard}>
                <TouchableOpacity onPress={() => handleProductClick(productId)}>
                    <View style={styles.imageContainer}>
                        <Image
                            style={styles.image}
                            source={item?.thumbnail ? { uri: `${API_BASE_URL}${item.thumbnail}` } : require("../../assets/icons/fruit.png")}
                        />
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.name} numberOfLines={2}>
                            {item?.title || item?.name}
                        </Text>

                        {selectedVariantObj && (
                            <Text style={styles.variantText} numberOfLines={1}>
                                {Array.isArray(selectedVariantObj?.attributes) && selectedVariantObj.attributes.length
                                    ? selectedVariantObj.attributes.map(a => a?.value || a?.name || '').filter(Boolean).join(' / ')
                                    : (selectedVariantObj?.name || selectedVariantObj?.sku || 'Default')}
                            </Text>
                        )}

                        <View style={styles.priceRow}>
                            {isBusiness ? (
                                <>
                                    {bizInfo?.mainText ? (
                                        <Text style={styles.newPrice}>{bizInfo.mainText}</Text>
                                    ) : (
                                        <Text style={styles.newPrice}>₹{Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                    )}
                                </>
                            ) : (
                                <>
                                    {showDiscount && (
                                        <Text style={styles.oldPrice}>₹{Number(productPrice.base).toFixed(2)}</Text>
                                    )}
                                    <Text style={styles.newPrice}>₹{Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                    {showDiscount && (
                                        <Text style={styles.discountPercent}>{productPrice.discountPercent}% OFF</Text>
                                    )}
                                </>
                            )}
                        </View>

                        {selectedVariantObj && (
                            <Text style={styles.stockText}>
                                Stock: {selectedVariantObj?.stock ?? 'Available'}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>

                <View style={styles.actionContainer}>
                    {cartQuantity > 0 ? (
                        <View style={styles.quantityControl}>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => handleUpdateQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id, cartQuantity - 1)}
                            >
                                <Text style={styles.quantityMinus}>-</Text>
                            </TouchableOpacity>

                            <Text style={styles.quantityText}>{cartQuantity}</Text>

                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => handleUpdateQuantity(productId, selectedVariantObj?._id || selectedVariantObj?.id, cartQuantity + 1)}
                                disabled={isOutOfStock}
                            >
                                <Text style={[styles.quantityPlus, isOutOfStock && styles.disabledText]}>+</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.addButton, hasMultipleVariants && styles.variantButton, isOutOfStock && styles.disabledButton]}
                            onPress={() => hasMultipleVariants ? handleVariantSelect(item) : handleAddToCart(item)}
                            disabled={isOutOfStock}
                        >
                            <Text style={[styles.addButtonText, isOutOfStock && styles.disabledText]}>
                                {hasMultipleVariants ? 'Options' : 'ADD'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderVariantItem = ({ item: variant }) => {
        const priceInfo = computeVariantPrice(variant, selectedProductForVariant);
        const isOutOfStock = variant?.stock === 0;
        const cartQuantity = getCartQuantity(getProductId(selectedProductForVariant), variant._id || variant.id);

        return (
            <View style={[styles.variantCard, isOutOfStock && styles.disabledVariant]}>
                <View style={styles.variantInfo}>
                    <Text style={styles.variantName}>
                        {Array.isArray(variant?.attributes) && variant.attributes.length
                            ? variant.attributes.map(a => a?.value || a?.name || '').filter(Boolean).join(' / ')
                            : (variant?.name || variant?.sku || 'Variant')}
                    </Text>
                    <Text style={styles.variantPrice}>₹{priceInfo.final}</Text>
                    <Text style={styles.variantStock}>
                        {isOutOfStock ? 'Out of Stock' : `Stock: ${variant?.stock ?? 'Available'}`}
                    </Text>
                </View>

                {cartQuantity > 0 ? (
                    <View style={styles.variantQuantityControl}>
                        <TouchableOpacity
                            style={styles.variantQuantityButton}
                            onPress={() => handleUpdateQuantity(getProductId(selectedProductForVariant), variant._id || variant.id, cartQuantity - 1)}
                        >
                            <Text style={styles.variantQuantityText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.variantQuantity}>{cartQuantity}</Text>
                        <TouchableOpacity
                            style={styles.variantQuantityButton}
                            onPress={() => handleUpdateQuantity(getProductId(selectedProductForVariant), variant._id || variant.id, cartQuantity + 1)}
                            disabled={isOutOfStock}
                        >
                            <Text style={[styles.variantQuantityText, isOutOfStock && styles.disabledText]}>+</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.variantAddButton, isOutOfStock && styles.disabledButton]}
                        onPress={() => handleAddToCart(selectedProductForVariant, variant)}
                        disabled={isOutOfStock}
                    >
                        <Text style={[styles.variantAddText, isOutOfStock && styles.disabledText]}>
                            ADD
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Two Column Layout */}
            <View style={styles.twoColumnLayout}>
                {/* Left Column - Categories */}
                <View style={styles.leftColumn}>
                    <ScrollView
                        style={styles.categoriesList}
                        showsVerticalScrollIndicator={false}
                    >
                        {categories.map((category) => {
                            const url = category?.image || category?.icon;
                            const imageSource = url ? {uri: `${API_BASE_URL}${url}`} : require("../../assets/images/gifts.png");

                            return (
                                <TouchableOpacity
                                    key={category._id || category.id}
                                    style={[
                                        styles.categoryItem,
                                        activeCategory?._id === category._id && styles.activeCategoryItem
                                    ]}
                                    onPress={() => setActiveCategory(category)}
                                >
                                    <View style={styles.categoryContent}>
                                        <Image
                                            source={imageSource}
                                            style={styles.categoryImage}
                                            resizeMode="cover"
                                        />
                                        <Text
                                            style={[
                                                styles.categoryName,
                                                activeCategory?._id === category._id && styles.activeCategoryName
                                            ]}
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
                <View style={styles.rightColumn}>
                    <View style={styles.resultsInfo}>
                        <Text style={styles.resultsText}>
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
                            {activeCategory && ` in ${activeCategory.name}`}
                            {searchQuery && ` for "${searchQuery}"`}
                        </Text>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Loading products…</Text>
                        </View>
                    ) : filteredProducts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No products found</Text>
                            <Text style={styles.emptySubtext}>
                                {activeCategory || searchQuery
                                    ? 'Try changing your filters or search term'
                                    : 'No products available at the moment'}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredProducts}
                            renderItem={renderProductItem}
                            keyExtractor={(item) => getProductId(item)}
                            numColumns={2}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.productsGrid}
                        />
                    )}
                </View>
            </View>

            {/* Variant Selection Modal */}
            <Modal
                visible={showVariantModal}
                animationType="slide"
                transparent={true}
                onRequestClose={closeVariantModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <SafeAreaView style={styles.modalContent}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    Select Variant
                                </Text>
                                <TouchableOpacity onPress={closeVariantModal} style={styles.closeButton}>
                                    <Image
                                        source={require("../../assets/icons/deleteIcon.png")}
                                        style={styles.closeIcon}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Product Info */}
                            {selectedProductForVariant && (
                                <View style={styles.productHeader}>
                                    <Image
                                        source={selectedProductForVariant?.thumbnail ?
                                            { uri: `${API_BASE_URL}${selectedProductForVariant.thumbnail}` } :
                                            require("../../assets/icons/fruit.png")}
                                        style={styles.productHeaderImage}
                                    />
                                    <View style={styles.productHeaderInfo}>
                                        <Text style={styles.productHeaderName} numberOfLines={2}>
                                            {selectedProductForVariant?.title || selectedProductForVariant?.name}
                                        </Text>
                                        <Text style={styles.productHeaderPrice}>
                                            Starts from ₹{computeProductPrice(selectedProductForVariant).final}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Variants List */}
                            <FlatList
                                data={selectedProductForVariant?.variants || []}
                                renderItem={renderVariantItem}
                                keyExtractor={(variant) => variant._id || variant.id || Math.random().toString()}
                                style={styles.variantsList}
                                contentContainerStyle={styles.variantsContent}
                            />
                        </SafeAreaView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    twoColumnLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    // Left Column Styles
    leftColumn: {
        width: '30%',
        backgroundColor: '#F8F9FA',
        borderRightWidth: 1,
        borderRightColor: '#E8E8E8',
    },
    categoriesList: {
        flex: 1,
    },
    categoryItem: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8E8',
        backgroundColor: '#FFFFFF',
    },
    activeCategoryItem: {
        backgroundColor: '#FFF5F5',
        borderLeftWidth: 4,
        borderLeftColor: '#EC0505',
    },
    categoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginBottom: 8,
        backgroundColor: '#F5F5F5',
    },
    categoryName: {
        fontSize: 11,
        color: '#666',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        lineHeight: 14,
    },
    activeCategoryName: {
        color: '#EC0505',
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    // Right Column Styles
    rightColumn: {
        flex: 1,
        padding: 16,
    },
    resultsInfo: {
        marginBottom: 16,
    },
    resultsText: {
        fontFamily: 'Poppins',
        fontSize: 14,
        color: '#838383',
    },
    productsGrid: {
        paddingBottom: 20,
    },
    productCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        margin: 6,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    imageContainer: {
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    content: {
        marginBottom: 12,
    },
    name: {
        fontFamily: 'Poppins',
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: 4,
        lineHeight: 18,
    },
    variantText: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Poppins',
        marginBottom: 6,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    oldPrice: {
        fontSize: 12,
        color: '#838383',
        textDecorationLine: 'line-through',
        fontFamily: 'Poppins',
    },
    newPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1B1B1B',
        fontFamily: 'Poppins-Bold',
    },
    discountPercent: {
        fontSize: 12,
        color: '#EC0505',
        backgroundColor: '#FFE8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontFamily: 'Poppins-SemiBold',
    },
    stockText: {
        fontSize: 11,
        color: '#666',
        fontFamily: 'Poppins',
    },
    actionContainer: {
        marginTop: 'auto',
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    quantityButton: {
        padding: 4,
    },
    quantityMinus: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
        width: 20,
        textAlign: 'center',
    },
    quantityPlus: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: 'bold',
        width: 20,
        textAlign: 'center',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: 12,
        minWidth: 20,
        textAlign: 'center',
    },
    addButton: {
        backgroundColor: '#EC0505',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    variantButton: {
        backgroundColor: '#FFA500',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    disabledButton: {
        backgroundColor: '#CCCCCC',
    },
    disabledText: {
        color: '#999999',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        height: height * 0.8,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    modalContent: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000',
        fontFamily: 'Poppins-Bold',
    },
    closeButton: {
        padding: 8,
    },
    closeIcon: {
        width: 20,
        height: 20,
        tintColor: '#000000',
    },
    productHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    productHeaderImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    productHeaderInfo: {
        flex: 1,
    },
    productHeaderName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 4,
    },
    productHeaderPrice: {
        fontSize: 14,
        color: '#EC0505',
        fontFamily: 'Poppins-SemiBold',
    },
    variantsList: {
        flex: 1,
    },
    variantsContent: {
        padding: 16,
    },
    variantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    disabledVariant: {
        opacity: 0.6,
    },
    variantInfo: {
        flex: 1,
    },
    variantName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 4,
    },
    variantPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EC0505',
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    variantStock: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Poppins',
    },
    variantQuantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    variantQuantityButton: {
        padding: 4,
    },
    variantQuantityText: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
        width: 20,
        textAlign: 'center',
    },
    variantQuantity: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: 12,
        minWidth: 20,
        textAlign: 'center',
    },
    variantAddButton: {
        backgroundColor: '#EC0505',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    variantAddText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
});
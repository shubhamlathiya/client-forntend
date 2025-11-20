import AsyncStorage from '@react-native-async-storage/async-storage';
import {useLocalSearchParams, useRouter} from "expo-router";
import {useEffect, useState} from "react";
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
import {addCartItem, getCart, removeCartItem, updateCartItem} from '../../api/cartApi';
import {getProducts, getCategories} from '../../api/catalogApi';
import {API_BASE_URL} from '../../config/apiConfig';

const {width, height} = Dimensions.get("window");

export default function ProductsScreen() {
    const router = useRouter();
    const {selectedCategory, searchQuery} = useLocalSearchParams();
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
            try {
                setLoading(true);

                // Ensure selectedCategory is a clean ID
                const categoryId =
                    typeof selectedCategory === "string"
                        ? selectedCategory
                        : selectedCategory?._id ||
                        selectedCategory?.id ||
                        null;

                const requests = [
                    getProducts({categoryId}),
                    getCategories(),
                    loadCartItems()
                ];

                const [productsRes, categoriesRes, cartRes] = await Promise.all(requests);
                let items = [];

                if (productsRes?.success) {
                    if (productsRes.data?.data?.items) {
                        items = productsRes.data.data.items;
                    } else if (productsRes.data?.items) {
                        items = productsRes.data.items;
                    } else if (Array.isArray(productsRes.data)) {
                        items = productsRes.data;
                    }
                } else if (Array.isArray(productsRes)) {
                    items = productsRes;
                }

                let categoriesList = [];

                if (categoriesRes?.success) {
                    if (categoriesRes.data?.data) {
                        categoriesList = categoriesRes.data.data;
                    } else if (Array.isArray(categoriesRes.data)) {
                        categoriesList = categoriesRes.data;
                    } else if (categoriesRes.data?.items) {
                        categoriesList = categoriesRes.data.items;
                    }
                } else if (Array.isArray(categoriesRes)) {
                    categoriesList = categoriesRes;
                }

                if (mounted) {
                    setProducts(items);
                    setFilteredProducts(items);
                    setCategories(categoriesList);

                    if (categoriesList.length > 0) {
                        setActiveCategory(categoriesList[0]);
                    }
                }
            } catch (e) {
                if (mounted) {
                    setProducts([]);
                    setFilteredProducts([]);
                    setCategories([]);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            mounted = false;
        };
    }, [selectedCategory]);

    // Filter products when category or search query changes
    useEffect(() => {
        let filtered = [...products];

        // Filter by active category
        if (activeCategory) {
            filtered = filtered.filter(product => {
                const matchesCategory =
                    product.categoryIds?.includes(activeCategory._id) ||
                    product.categoryId === activeCategory._id ||
                    product.category?._id === activeCategory._id ||
                    (Array.isArray(product.categoryIds) &&
                        product.categoryIds.some(cat =>
                            cat?._id === activeCategory._id || cat === activeCategory._id
                        ));

                return matchesCategory;
            });
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
            return cartData;
        } catch (error) {
            setCartItems([]);
        }
    };

    // Load login type
    useEffect(() => {
        (async () => {
            try {
                const lt = await AsyncStorage.getItem('loginType');
                if (lt) {
                    setLoginType(lt);
                }
            } catch (error) {
                console.log('❌ Error loading login type:', error);
            }
        })();
    }, []);

    function handleProductClick(id) {
        router.replace({pathname: "/screens/ProductDetailScreen", params: {id: String(id)}});
    }

    function getProductId(item) {
        const id = item?.id || item?._id || item?.productId;
        return id;
    }

    // Get cart item ID for update/remove operations
    const getCartItemId = (productId, variantId = null) => {
        const cartItem = cartItems.find(item =>
            item.productId === String(productId) &&
            item.variantId === (variantId ? String(variantId) : null)
        );
        return cartItem?._id || cartItem?.id;
    };

    function computeProductPrice(item) {
        // Check if product has variants with pricing
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        const firstVariant = variants[0];

        let base = 0;
        let final = 0;
        let hasDiscount = false;
        let discountPercent = 0;

        // Priority: Variant pricing -> Product pricing
        if (firstVariant) {
            base = Number(firstVariant?.basePrice ?? firstVariant?.price ?? 0);
            final = Number(firstVariant?.finalPrice ?? firstVariant?.price ?? base);
        } else {
            base = Number(item?.basePrice ?? item?.price ?? 0);
            final = Number(item?.finalPrice ?? item?.price ?? base);
        }

        // Calculate discount if applicable
        if (item?.discount?.type === 'percent' && item.discount.value > 0) {
            discountPercent = Number(item.discount.value);
            final = base - (base * discountPercent / 100);
            hasDiscount = true;
        } else if (base > final) {
            discountPercent = Math.round(((base - final) / base) * 100);
            hasDiscount = discountPercent > 0;
        }

        return {base, final, hasDiscount, discountPercent};
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
        } else {
            // Fallback to regular pricing
            const priceInfo = computeProductPrice(item);
            mainText = `₹${priceInfo.final.toFixed(2)}`;
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

        return {mainText, tierText};
    }

    function computeVariantPrice(variant, product) {
        let base = Number(variant?.basePrice ?? variant?.price ?? 0);
        let final = Number(variant?.finalPrice ?? variant?.price ?? base);
        let hasDiscount = false;

        // Apply product-level discount to variant if no variant-specific pricing
        if (product?.discount?.type === 'percent' && product.discount.value > 0 &&
            (!variant?.finalPrice && !variant?.basePrice)) {
            const discountPercent = Number(product.discount.value);
            final = base - (base * discountPercent / 100);
            hasDiscount = true;
        } else if (base > final) {
            hasDiscount = true;
        }

        return {base: Number(base), final: Number(final), hasDiscount};
    }

    const getCartQuantity = (productId, variantId = null) => {
        const item = cartItems.find(cartItem =>
            cartItem.productId === String(productId) &&
            cartItem.variantId === (variantId ? String(variantId) : null)
        );
        const quantity = item ? item.quantity : 0;
        return quantity;
    };

    async function handleAddToCart(item, variant = null) {
        try {
            const productId = getProductId(item);
            const variants = Array.isArray(item?.variants) ? item.variants : [];
            const selectedVariantId = variant ? String(variant._id || variant.id) : selectedVariants[String(productId)];
            const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
            const effectiveVariantId = selectedVariantId || (defaultVariant ? String(defaultVariant?._id || defaultVariant?.id || defaultVariant?.variantId) : null);

            const payload = {
                productId: String(productId),
                quantity: 1,
                variantId: effectiveVariantId ? String(effectiveVariantId) : null,
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
            Alert.alert('Error', 'Failed to add item to cart');
        }
    }

    async function handleUpdateQuantity(productId, variantId, newQuantity) {
        try {
            const itemId = getCartItemId(productId, variantId);

            if (!itemId) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            if (newQuantity === 0) {
                await removeCartItem(itemId);
                await loadCartItems();
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Removed from cart', ToastAndroid.SHORT);
                }
            } else {
                await updateCartItem(itemId, newQuantity);
                await loadCartItems();
            }
        } catch (error) {
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

    const renderProductItem = ({item}) => {
        const productId = getProductId(item);
        const productPrice = computeProductPrice(item);
        const variants = Array.isArray(item?.variants) ? item.variants : [];
        const showDiscount = productPrice.hasDiscount;
        const defaultVariant = variants.find(v => (v?.stock ?? 1) > 0) || variants[0] || null;
        const selectedVariantId = selectedVariants[String(productId)];
        const selectedVariantObj = variants.find(v => String(v?._id || v?.id) === String(selectedVariantId)) || defaultVariant;

        // Use variant price if available, otherwise use product price
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
                            source={item?.thumbnail ? {uri: `${API_BASE_URL}${item.thumbnail}`} : require("../../assets/icons/fruit.png")}
                            defaultSource={require("../../assets/icons/fruit.png")}
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
                                        <Text
                                            style={styles.newPrice}>₹{Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                    )}
                                </>
                            ) : (
                                <>
                                    {showDiscount ? (
                                        <Text style={styles.priceContainer}>
                                            <Text style={styles.oldPrice}>₹{Number(productPrice.base).toFixed(2)}</Text>
                                            {'\n'}
                                            <Text style={styles.newPrice}>₹{Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                            {'\n'}
                                            <Text style={styles.discountPercent}>{productPrice.discountPercent}% OFF</Text>
                                        </Text>
                                    ) : (
                                        <Text style={styles.newPrice}>₹{Number(displayFinalPrice || 0).toFixed(2)}</Text>
                                    )}
                                </>
                            )}
                        </View>

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

    const renderVariantItem = ({item: variant}) => {
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
                    <Text style={styles.variantPrice}>₹{priceInfo.final.toFixed(2)}</Text>
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
            {/* Top Bar - Selected Category */}
            <View style={styles.topBar}>
                <Text style={styles.topBarTitle}>
                    {activeCategory ? activeCategory.name : 'All Categories'}
                </Text>
            </View>

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
                                            defaultSource={require("../../assets/images/gifts.png")}
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
                                            {uri: `${API_BASE_URL}${selectedProductForVariant.thumbnail}`} :
                                            require("../../assets/icons/fruit.png")}
                                        style={styles.productHeaderImage}
                                        defaultSource={require("../../assets/icons/fruit.png")}
                                    />
                                    <View style={styles.productHeaderInfo}>
                                        <Text style={styles.productHeaderName} numberOfLines={2}>
                                            {selectedProductForVariant?.title || selectedProductForVariant?.name}
                                        </Text>
                                        <Text style={styles.productHeaderPrice}>
                                            Starts from
                                            ₹{computeProductPrice(selectedProductForVariant).final.toFixed(2)}
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
        marginTop: 20,
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    topBar: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8E8',
    },
    topBarTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1B1B1B',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
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
        borderBottomColor: '#4CAD73',
        backgroundColor: '#FFFFFF',
    },
    activeCategoryItem: {
        backgroundColor: '#FFF5F5',
        borderRightWidth: 5,
        borderRightColor: '#4CAD73',
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
    rightColumn: {
        flex: 1,
    },
    productsGrid: {
        paddingBottom: 20,
    },
    productCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        margin: 4,
        padding: 4,
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
        color: '#171717',
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
        backgroundColor: '#4CAD73',
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
        color: '#4CAD73',
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
        color: '#4CAD73',
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
        backgroundColor: '#4CAD73',
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
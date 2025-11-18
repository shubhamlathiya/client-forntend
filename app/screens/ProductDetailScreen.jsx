import {useLocalSearchParams, useRouter} from "expo-router";
import {useEffect, useState} from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {addCartItem, getOrCreateSessionId} from '../../api/cartApi';
import {getProductById, getVariants, getProducts} from '../../api/catalogApi';
import {API_BASE_URL} from '../../config/apiConfig';

export default function ProductDetailScreen() {
    const router = useRouter();
    const {id, product: productParam} = useLocalSearchParams();
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [product, setProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [related, setRelated] = useState([]);


    const handleBack = () => {
        // Check if there’s a previous route in history
        if (router.canGoBack()) {
            router.back();
        } else {
            // Alternative action - go to home or do nothing
            router.replace('/Home');
        }
    };
    useEffect(() => {
        let mounted = true;

        async function load() {
            setLoading(true);
            try {
                let p = null;
                if (productParam) {
                    try {
                        const parsed = typeof productParam === 'string' ? JSON.parse(productParam) : productParam;
                        p = parsed;
                        console.log('Received product data (route params):', p);
                    } catch (err) {
                        console.warn('Failed to parse product from params', err);
                    }
                }
                if (!p && id) {
                    const pr = await getProductById(String(id));
                    p = pr?.data || pr?.product || pr || null;
                }
                // console.log('Loaded product:', p);
                if (mounted) setProduct(p);

                let vItems = [];
                if (p?.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                    vItems = p.variants;
                } else if (p?._id || id) {
                    const vr = await getVariants({productId: String(p?._id || id), page: 1, limit: 20});
                    vItems = vr?.data?.items || vr?.items || [];
                }
                if (mounted) setVariants(vItems);
                if (vItems && vItems.length > 0) {
                    const firstAvailable = vItems.find(v => (v?.stock ?? 1) > 0) || vItems[0];
                    setSelectedVariantId(firstAvailable?.id || firstAvailable?._id || firstAvailable?.variantId);
                }
            } catch (e) {
                console.warn('Product load error:', e);
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [id, productParam]);

    useEffect(() => {
        // Fetch related products based on primary category
        (async () => {
            try {
                const primaryCategoryId = Array.isArray(product?.categoryIds) && product.categoryIds.length > 0
                    ? (product.categoryIds[0]?.id || product.categoryIds[0]?._id || product.categoryIds[0])
                    : (product?.categoryId || product?.primaryCategoryId);
                if (!primaryCategoryId) return;
                const res = await getProducts({page: 1, limit: 4, categoryId: String(primaryCategoryId)});
                const payload = res?.data ?? res;
                const items = Array.isArray(payload) ? payload : (payload?.items || []);
                // console.log('Related products fetched:', items?.length);
                setRelated(items);
            } catch (e) {
                console.warn('Related products fetch failed:', e?.response?.data || e?.message || e);
            }
        })();
    }, [product]);

    const increaseQuantity = () => {
        setQuantity(quantity + 1);
    };

    const decreaseQuantity = () => {
        if (quantity > 1) {
            setQuantity(quantity - 1);
        }
    };

    async function handleAddToCart() {
        try {
            const productId = product?.id || product?._id || product?.productId || id;
            const variantId = variants?.length > 0 ? selectedVariantId : null;
            const sessionId = await getOrCreateSessionId();
            const debugPayload = {
                productId: String(productId),
                variantId: variantId ? String(variantId) : null,
                quantity: Number(quantity),
                sessionId: sessionId || null,
            };
            const res = await addCartItem({
                productId: String(productId),
                variantId: variantId ? String(variantId) : null,
                quantity: Number(quantity),
            });
            console.log('Add to Cart Response:', res);
            router.push("/Cart")
        } catch (e) {
            console.warn('Add to Cart Error:', e);
        }
    }

    const selectedVariant = variants.find(v => (v?.id || v?._id || v?.variantId) === selectedVariantId);
    const basePriceMin = product?.priceRange?.min ?? product?.price ?? 0;
    const displayPrice = product?.type === 'variant' ? (selectedVariant?.price ?? basePriceMin) : (product?.price ?? basePriceMin);
    const isOutOfStock = product?.type === 'variant' ? (selectedVariant?.stock === 0) : (product?.stock === 0);

    return (<View style={styles.container}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
            {/* Back Icon positioned absolutely at top left */}
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Image
                    source={require("../../assets/icons/back_icon.png")}
                    style={styles.backIcon}
                />
            </TouchableOpacity>

            {/* Image Scroll View */}
            {Array.isArray(product?.images) && product.images.length > 0 ? (
                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.imageScrollView}
                >
                    {product.images.map((img, i) => {
                        const src = typeof img === 'string' ? img : (img?.url || img?.path || null);
                        const source = src ? {uri: `${API_BASE_URL}${src}`} : require("../../assets/sample-product.png");
                        return (
                            <Image
                                key={`pd-img-${i}`}
                                source={source}
                                style={styles.productImage}
                                resizeMode="cover"
                            />
                        );
                    })}
                </ScrollView>
            ) : (
                <Image
                    source={product?.images?.[0]?.url
                        ? {uri: `${API_BASE_URL}${product.images[0].url}`}
                        : require("../../assets/sample-product.png")}
                    style={styles.productImage}
                    resizeMode="cover"
                />
            )}

            {/* Image Indicators */}
            <View style={styles.indicatorContainer}>
                <View style={[styles.dot, styles.dotActive]}/>
                <View style={styles.dot}/>
                <View style={styles.dot}/>
            </View>
        </View>
        {/* Content Section */}
        <View style={styles.content}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Product Header */}
                <View style={styles.productHeader}>
                    <Text style={styles.productName}>{product?.title || 'Product'}</Text>

                    {/* Brand Row */}
                    {product?.brandId?.name || product?.brandId?.logo ? (
                        <View style={styles.brandRow}>
                            {product?.brandId?.logo ? (
                                <Image
                                    source={{uri: `${API_BASE_URL}${product.brandId.logo}`}}
                                    style={styles.brandLogo}
                                />
                            ) : null}
                            <Text style={styles.brandName}>{product?.brandId?.name || 'Brand'}</Text>
                        </View>
                    ) : null}

                    {/* Rating Row */}
                    <View style={styles.ratingRow}>
                        <View style={styles.starsContainer}>
                            {/* Star icons - you can replace with actual star images */}
                            <Text style={styles.star}>★</Text>
                            <Text style={styles.star}>★</Text>
                            <Text style={styles.star}>★</Text>
                            <Text style={styles.star}>★</Text>
                            <Text style={styles.star}>★</Text>
                        </View>
                        <Text style={styles.ratingValue}>4.5</Text>
                        <Text style={styles.reviewsText}>(89 reviews)</Text>
                    </View>

                    {/* Price Row */}
                    <View style={styles.priceRow}>
                        {product?.mrp ? (
                            <Text style={styles.oldPrice}>${Number(product.mrp).toFixed(2)}</Text>
                        ) : null}
                        <Text style={styles.price}>₹{Number(displayPrice).toFixed(2)}</Text>
                        {product?.type === 'variant' && (selectedVariant?.stock !== undefined) ? (
                            <Text style={styles.reviewsText}>Stock: {selectedVariant?.stock}</Text>
                        ) : null}
                    </View>
                </View>

                {/* Description */}
                <Text style={styles.description}>
                    {product?.description || 'No description available.'}
                </Text>

                {/* Categories Chips */}
                {Array.isArray(product?.categoryIds) && product.categoryIds.length > 0 ? (
                    <View style={styles.chipsContainer}>
                        {product.categoryIds.map((cat, idx) => (
                            <View key={`cat-${idx}`} style={styles.chip}>
                                <Text style={styles.chipText}>{cat?.name || cat}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* Variant Selection */}
                {product?.type === 'variant' && variants.length > 0 ? (
                    <View style={styles.variantSection}>
                        <Text style={styles.relatedTitle}>Select Variant</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{flexDirection: 'row', gap: 8}}>
                                {variants.map((v, idx) => {
                                    const idVal = v?.id || v?._id || v?.variantId;
                                    const isSelected = idVal === selectedVariantId;
                                    const label = Array.isArray(v?.attributes) && v.attributes.length
                                        ? v.attributes.map(a => a?.value || a?.name || '').filter(Boolean).join(' / ')
                                        : (v?.sku || `Variant ${idx + 1}`);
                                    return (
                                        <TouchableOpacity
                                            key={`var-${idVal || idx}`}
                                            style={[styles.variantChip, isSelected && styles.variantChipSelected]}
                                            onPress={() => {
                                                setSelectedVariantId(idVal);
                                                console.log('Variant selected:', {
                                                    id: idVal,
                                                    label,
                                                    price: v?.price,
                                                    stock: v?.stock
                                                });
                                            }}
                                        >
                                            <Text
                                                style={[styles.variantChipText, isSelected && styles.variantChipTextSelected]}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                ) : null}

                {/* Features Grid */}
                <View style={styles.featuresContainer}>
                    {/* Row 1 */}
                    <View style={styles.featuresRow}>
                        <View style={styles.featureCard}>
                            <View style={styles.featureContent}>
                                <View style={styles.featureIcon}>
                                    {/* Lotus icon placeholder */}
                                    <Text style={styles.iconPlaceholder}>🌱</Text>
                                </View>
                                <View style={styles.featureText}>
                                    <Text style={styles.featureValue}>100%</Text>
                                    <Text style={styles.featureLabel}>Organic</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.featureCard}>
                            <View style={styles.featureContent}>
                                <View style={styles.featureIcon}>
                                    {/* Calendar icon placeholder */}
                                    <Text style={styles.iconPlaceholder}>📅</Text>
                                </View>
                                <View style={styles.featureText}>
                                    <Text style={styles.featureValue}>1 Year</Text>
                                    <Text style={styles.featureLabel}>Expiration</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Row 2 */}
                    <View style={styles.featuresRow}>
                        <View style={styles.featureCard}>
                            <View style={styles.featureContent}>
                                <View style={styles.featureIcon}>
                                    {/* Heart icon placeholder */}
                                    <Text style={styles.iconPlaceholder}>❤️</Text>
                                </View>
                                <View style={styles.featureText}>
                                    <Text style={styles.featureValue}>4.8 (256)</Text>
                                    <Text style={styles.featureLabel}>Reviews</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.featureCard}>
                            <View style={styles.featureContent}>
                                <View style={styles.featureIcon}>
                                    {/* Fire icon placeholder */}
                                    <Text style={styles.iconPlaceholder}>🔥</Text>
                                </View>
                                <View style={styles.featureText}>
                                    <Text style={styles.featureValue}>80 kcal</Text>
                                    <Text style={styles.featureLabel}>100 Gram</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
            <View style={styles.quantitySection}>
                <Text style={styles.quantityLabel}>Quantity</Text>
                <View style={styles.quantityControl}>
                    <TouchableOpacity style={styles.quantityButton} onPress={decreaseQuantity}>
                        <View style={styles.minusButton}>
                            <Image
                                source={require("../../assets/icons/minus.png")}
                            />
                            {/*<Text style={styles.buttonText}>-</Text>*/}
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.quantityValue}>{quantity}</Text>
                    <TouchableOpacity style={styles.quantityButton} onPress={increaseQuantity}>
                        <View style={styles.plusButton}>
                            <Image
                                source={require("../../assets/icons/plus.png")}
                            />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={[styles.addToCartButton, isOutOfStock && {backgroundColor: '#AFAFAF'}]}
                              onPress={handleAddToCart} disabled={!!isOutOfStock}>
                <Text style={styles.addToCartText}>{isOutOfStock ? 'Out of stock' : 'Add to Cart'}</Text>
            </TouchableOpacity>
        </View>
    </View>);
}

const styles = StyleSheet.create({
    container: {
        flex: 1, backgroundColor: "#F5F6FA",
    },
    imageContainer: {
        width: "100%",
        height: 320,
        backgroundColor: "#F2F2F2",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: 'relative', // Important for absolute positioning of children
    },
    backButton: {
        position: 'absolute',
        top: 32,
        left: 16,
        zIndex: 10,
        width: 40,
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    imageScrollView: {
        width: '100%',
        height: '100%',
    },
    productImage: {
        width: 400,
        height: 330,
        borderRadius: 12,
        resizeMode: "contain",
    },
    indicatorContainer: {
        position: "absolute", bottom: 20, alignSelf: "center", flexDirection: "row", gap: 6,
    }, dot: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: "#C4C4C4",
    }, dotActive: {
        backgroundColor: "#4CAD73",
    }, content: {
        position: "absolute",
        top: 300,
        left: 0,
        right: 0,
        bottom: 106,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
    }, scrollContent: {
        padding: 24, gap: 20,
    }, productHeader: {
        gap: 8,
    }, productName: {
        fontSize: 24, fontFamily: "Poppins", fontWeight: "500", color: "#000000", lineHeight: 36,
    }, brandRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    }, brandLogo: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#EEE',
    }, brandName: {
        fontSize: 12, color: '#666',
    }, ratingRow: {
        flexDirection: "row", alignItems: "center", gap: 3,
    }, starsContainer: {
        flexDirection: "row",
    }, star: {
        color: "#FFC107", fontSize: 14, marginRight: 2,
    }, ratingValue: {
        fontSize: 12, fontFamily: "Poppins", fontWeight: "400", color: "#838383", lineHeight: 18, marginLeft: 4,
    }, reviewsText: {
        fontSize: 12, fontFamily: "Poppins", fontWeight: "400", color: "#868889", lineHeight: 18,
    }, priceRow: {
        flexDirection: "row", alignItems: "flex-end", gap: 8,
    }, price: {
        fontSize: 20, fontFamily: "Poppins", fontWeight: "500", color: "#4CAD73", lineHeight: 30,
    }, oldPrice: {
        fontSize: 16,
        fontFamily: "Poppins",
        fontWeight: "400",
        color: "#838383",
        lineHeight: 24,
        textDecorationLine: "line-through",
    }, description: {
        fontSize: 14, fontFamily: "Poppins", fontWeight: "400", color: "#838383", lineHeight: 21,
    }, chipsContainer: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
    }, chip: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F2F2F2',
    }, chipText: {
        fontSize: 12, color: '#555',
    }, variantSection: {
        marginTop: 8,
    }, variantChip: {
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#E6E6E6',
        backgroundColor: '#FFFFFF',
    }, variantChipSelected: {
        borderColor: '#4CAD73', backgroundColor: 'rgba(76, 173, 115, 0.12)',
    }, variantChipText: {
        fontSize: 12, color: '#333',
    }, variantChipTextSelected: {
        color: '#2E7D5B', fontWeight: '600',
    }, featuresContainer: {
        gap: 16,
    }, featuresRow: {
        flexDirection: "row", gap: 16,
    }, featureCard: {
        flex: 1, borderWidth: 1, borderColor: "#E6E6E6", borderRadius: 16, padding: 12,
    }, featureContent: {
        flexDirection: "row", alignItems: "center", gap: 16,
    }, featureIcon: {
        width: 35, height: 35, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF",
    }, iconPlaceholder: {
        fontSize: 20,
    }, featureText: {
        gap: 4,
    }, featureValue: {
        fontSize: 14, fontFamily: "Poppins", fontWeight: "500", color: "#23AA49", lineHeight: 21,
    }, featureLabel: {
        fontSize: 12, fontFamily: "Poppins", fontWeight: "400", color: "#979899", lineHeight: 18,
    }, relatedSection: {
        gap: 20,
    }, relatedHeader: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    }, relatedTitle: {
        fontSize: 16, fontFamily: "Poppins", fontWeight: "500", color: "#333333", lineHeight: 24,
    }, showAll: {
        fontSize: 12, fontFamily: "Poppins", fontWeight: "400", color: "#4CAD73", lineHeight: 18,
    }, relatedProducts: {
        flexDirection: "row", gap: 20,
    }, relatedProductCard: {
        width: 224,
        height: 104,
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 20,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#F5F5F5",
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    }, productImageContainer: {
        width: 80, height: 80, backgroundColor: "rgba(101, 145, 20, 0.1)", borderRadius: 12,
    }, productThumbnail: {
        width: "100%", height: "100%", borderRadius: 12,
    }, productInfo: {
        gap: 4,
    }, productTitle: {
        fontSize: 14, fontFamily: "Poppins", fontWeight: "500", color: "#000000", lineHeight: 21,
    }, discount: {
        fontSize: 12, fontFamily: "Poppins", fontWeight: "500", color: "#F34E4E", lineHeight: 18,
    }, productPrice: {
        flexDirection: "row", alignItems: "center", gap: 8,
    }, currentPrice: {
        fontSize: 14, fontFamily: "Poppins", fontWeight: "500", color: "#4CAD73", lineHeight: 21,
    }, originalPrice: {
        fontSize: 12, fontFamily: "Poppins", fontWeight: "400", color: "#ABABAB", lineHeight: 18,
    }, bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 106,
        flexDirection: "row",
        alignItems: "center",
        padding: 15,
        gap: 40,
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: -10},
        shadowOpacity: 0.07,
        shadowRadius: 70,
        elevation: 10,
    }, quantitySection: {
        gap: 8,
    }, quantityLabel: {
        fontSize: 14, fontFamily: "Poppins", fontWeight: "500", color: "#838383", marginLeft: 10
    }, quantityControl: {
        flexDirection: "row", alignItems: "center", gap: 10, width: 115, height: 32,
    }, quantityButton: {
        padding: 8,
    }, minusButton: {
        width: 32,
        height: 32,
        borderWidth: 1,
        borderColor: "#4CAD73",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    }, plusButton: {
        width: 32,
        height: 32,
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    }, buttonText: {
        color: "#FFFFFF", fontSize: 16, fontWeight: "bold", font: "#4CAD73",
    }, quantityValue: {
        fontSize: 20,
        fontFamily: "Poppins",
        fontWeight: "500",
        color: "#000000",
        textAlign: "center",
    }, addToCartButton: {
        flex: 1,
        height: 48,
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    }, addToCartText: {
        fontSize: 14, fontFamily: "Poppins", fontWeight: "500", color: "#FFFFFF", lineHeight: 21, textAlign: "center",
    },
});

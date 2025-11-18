import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { getProducts } from "../../api/catalogApi";
import { API_BASE_URL } from "../../config/apiConfig";
import { addCartItem } from "../../api/cartApi";


export default function RelatedProducts({ categoryId = null, title = "Bestsellers", limit = 10 }) {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedVariants, setSelectedVariants] = useState({}); // { [productId]: variantId }
    const [addingToCart, setAddingToCart] = useState({});

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const params = { page: 1, limit: Number(limit) || 10 };
                if (categoryId) params.categoryId = String(categoryId);
                const res = await getProducts(params);
                const payload = res?.data ?? res;
                const items = Array.isArray(payload) ? payload : (payload?.items || res?.data?.items || res?.items || []);
                if (mounted) setProducts(items);
            } catch (e) {
                console.warn("RelatedProducts fetch error:", e?.response?.data || e?.message || e);
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [categoryId, limit]);

    // Calculate product price with discount
    const calculateProductPrice = (product) => {

        // Check if product has variants with finalPrice
        if (product?.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            const variant = product.variants[0]; // Get first variant
            const finalPrice = variant?.finalPrice;
            const basePrice = product?.basePrice || finalPrice || product?.price || 0;

            // Check for discount in product or variant
            const discount = product?.discount || variant?.discount;

            if (discount && discount.type === 'percent' && discount.value > 0) {
                const discountAmount = (basePrice * discount.value) / 100;
                const calculatedFinalPrice = finalPrice || (basePrice - discountAmount);

                return {
                    basePrice: Math.round(basePrice),
                    finalPrice: Math.round(calculatedFinalPrice),
                    hasDiscount: true,
                    discountPercent: discount.value
                };
            }

            // If no discount but has finalPrice in variant
            if (finalPrice && finalPrice !== basePrice) {
                return {
                    basePrice: Math.round(basePrice),
                    finalPrice: Math.round(finalPrice),
                    hasDiscount: true,
                    discountPercent: Math.round(((basePrice - finalPrice) / basePrice) * 100)
                };
            }

            // Default case - no discount
            return {
                basePrice: Math.round(basePrice),
                finalPrice: Math.round(finalPrice || basePrice),
                hasDiscount: false,
                discountPercent: 0
            };
        }

        // For products without variants
        const basePrice = product?.basePrice || product?.price || 0;
        const discount = product?.discount;

        if (discount && discount.type === 'percent' && discount.value > 0) {
            const discountAmount = (basePrice * discount.value) / 100;
            const finalPrice = basePrice - discountAmount;

            return {
                basePrice: Math.round(basePrice),
                finalPrice: Math.round(finalPrice),
                hasDiscount: true,
                discountPercent: discount.value
            };
        }

        return {
            basePrice: Math.round(basePrice),
            finalPrice: Math.round(basePrice),
            hasDiscount: false,
            discountPercent: 0
        };
    };

    function getProductId(item) {
        return item?.id || item?._id || item?.productId;
    }

    function getVariantId(v, i) {
        return String(v?._id || v?.id || v?.variantId || i);
    }

    function getVariantLabel(v, i) {
        const names = Array.isArray(v?.attributes) ? v.attributes.map(a => a?.name || a?.label || "").filter(Boolean) : [];
        const combined = names.length ? names.join(" / ") : (v?.sku ? String(v.sku) : `Variant ${i + 1}`);
        return combined;
    }

    function selectVariant(product, variant, index) {
        const pid = String(getProductId(product));
        const vid = getVariantId(variant, index);
        const label = getVariantLabel(variant, index);
        const price = variant?.price;
        const stock = variant?.stock;
        setSelectedVariants(prev => ({ ...prev, [pid]: vid }));
    }

    function handleProductClick(item) {
        const id = getProductId(item);
        router.replace({ pathname: "/screens/ProductDetailScreen", params: { id: String(id) } });
    }

    const handleAddToCart = async (product) => {
        try {
            const productId = getProductId(product);
            setAddingToCart(prev => ({...prev, [productId]: true}));

            const variants = Array.isArray(product?.variants) ? product.variants : [];
            const selectedVariantId = selectedVariants[String(productId)] || null;
            const selectedVariant = variants.find((v, i) => String(getVariantId(v, i)) === String(selectedVariantId)) || variants[0];

            const cartItem = {
                productId: productId,
                quantity: 1,
                variantId: selectedVariant?._id || selectedVariant?.id || null
            };

            await addCartItem(cartItem);

        } catch (error) {
            console.error('Add to cart error:', error);
            console.error('Error response:', error.response?.data);
        } finally {
            const productId = getProductId(product);
            setAddingToCart(prev => ({...prev, [productId]: false}));
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <Text style={styles.title}>{title}</Text>

            {/* Product Grid */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsContainer}>
                {(loading ? [] : products).map((item, index) => {
                    const productId = getProductId(item);
                    const variants = Array.isArray(item?.variants) ? item.variants : [];
                    const selectedVariantId = selectedVariants[String(productId)] || null;
                    const selectedVariantObj = variants.find((v, i) => String(getVariantId(v, i)) === String(selectedVariantId)) || null;
                    const thumb = item?.thumbnail || (Array.isArray(item?.images) ? (item.images[0]?.url || item.images[0]) : null);
                    const source = thumb ? { uri: `${API_BASE_URL}${thumb}` } : require("../../assets/sample-product.png");

                    const priceInfo = calculateProductPrice(item);

                    return (
                        <View key={String(productId) || index} style={styles.productCard}>
                            {/* Product Image */}
                            <TouchableOpacity onPress={() => handleProductClick(item)}>
                                <Image source={source} style={styles.productImage} resizeMode="cover" />
                            </TouchableOpacity>

                            {/* Add to Cart Button */}
                            <TouchableOpacity
                                style={[
                                    styles.addButton,
                                    addingToCart[productId] && styles.addButtonDisabled
                                ]}
                                onPress={() => handleAddToCart(item)}
                                disabled={addingToCart[productId]}
                            >
                                <Text style={styles.addButtonText}>
                                    {addingToCart[productId] ? 'ADDING...' : 'ADD'}
                                </Text>
                            </TouchableOpacity>

                            {/* Product Details */}
                            <View style={styles.productDetails}>
                                <Text style={styles.productName} numberOfLines={2}>
                                    {item?.title || item?.name || "Product"}
                                </Text>

                                {/* Price Container */}
                                <View style={styles.priceContainer}>
                                    <Text style={styles.productPrice}>
                                        ₹{priceInfo.finalPrice}
                                    </Text>
                                    {priceInfo.hasDiscount && (
                                        <>
                                            <Text style={styles.productOriginalPrice}>
                                                ₹{priceInfo.basePrice}
                                            </Text>
                                            <Text style={styles.productDiscount}>
                                                {priceInfo.discountPercent}% OFF
                                            </Text>
                                        </>
                                    )}
                                </View>

                                {/* Delivery Time */}
                                <View style={styles.deliveryInfo}>
                                    <Image
                                        source={require("../../assets/icons/timer.jpg")}
                                        style={styles.timerIcon}
                                    />
                                    <Text style={styles.deliveryTime}>16 MINS</Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        left: 15,
        right:15,
        width: "100%",
    },
    title: {
        width: 85,
        height: 24,
        fontFamily: "Poppins_600SemiBold",
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
        letterSpacing: -0.3,
        color: "#000000",
        marginBottom: 12,
    },
    productsContainer: {
        flexDirection: "row",
    },
    productCard: {
        marginRight: 11,
        alignItems: "center",
        width: 96,
    },
    productImage: {
        width: 96,
        height: 108,
        borderRadius: 5,
        backgroundColor: "#C4C4C4",
    },
    addButton: {
        position: "absolute",
        width: 30,
        height: 18,
        top: 94, // Positioned at bottom of image
        right: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#27AF34",
        borderRadius: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    addButtonDisabled: {
        opacity: 0.6,
        borderColor: "#999",
    },
    addButtonText: {
        width: 12,
        height: 9,
        fontFamily: "Poppins_400Regular",
        fontSize: 6,
        lineHeight: 9,
        textAlign: "center",
        letterSpacing: -0.3,
        color: "#27AF34",
    },
    productDetails: {
        marginTop: 8,
        alignItems: "center",
        width: "100%",
    },
    productName: {
        fontFamily: "Poppins_400Regular",
        fontSize: 8,
        lineHeight: 12,
        textAlign: "center",
        letterSpacing: -0.3,
        color: "#000000",
        marginBottom: 4,
        height: 24,
    },
    priceContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
        flexWrap: "wrap",
    },
    productPrice: {
        fontSize: 14,
        fontWeight: "700",
        color: "#1B1B1B",
        fontFamily: "Poppins_700Bold",
        marginRight: 4,
    },
    productOriginalPrice: {
        fontSize: 10,
        color: "#999",
        textDecorationLine: "line-through",
        marginRight: 4,
        fontFamily: "Poppins_400Regular",
    },
    productDiscount: {
        fontSize: 8,
        color: "#EC0505",
        fontWeight: "500",
        fontFamily: "Poppins_500Medium",
    },
    deliveryInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    timerIcon: {
        width: 12,
        height: 12,
        marginRight: 4,
    },
    deliveryTime: {
        fontFamily: "Poppins_400Regular",
        fontSize: 10,
        lineHeight: 15,
        textAlign: "center",
        letterSpacing: -0.3,
        color: "#9C9C9C",
    },
    ratingContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    starIcon: {
        width: 12,
        height: 12,
        marginRight: 4,
    },
    rating: {
        fontFamily: "Poppins_700Bold",
        fontSize: 12,
        lineHeight: 18,
        textAlign: "center",
        letterSpacing: -0.3,
        color: "#000000",
    },
});
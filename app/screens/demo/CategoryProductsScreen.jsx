import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    Pressable,
    Dimensions,
    SafeAreaView,
    StatusBar,
    Alert,
    FlatList
} from 'react-native';
import {useRouter, useLocalSearchParams} from "expo-router";
import {getCategories, getProductsByCategory} from "../../../api/catalogApi";
import {addToCart} from "../../../api/cartApi";
import {API_BASE_URL} from "../../../config/apiConfig";

const {width, height} = Dimensions.get('window');

export default function CategoryProductsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [addingToCart, setAddingToCart] = useState({});

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const res = await getCategories();
            const categoriesData = res?.data?.data || res?.data || [];
            setCategories(categoriesData);

            // Set first category as selected by default
            if (categoriesData.length > 0) {
                const firstCategory = categoriesData[0];
                setSelectedCategory(firstCategory);
                loadProducts(firstCategory._id);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async (categoryId) => {
        try {
            setLoading(true);
            const res = await getProductsByCategory(categoryId);
            const productsData = res?.data?.data || res?.data || [];
            setProducts(productsData);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        loadProducts(category._id);
    };

    const handleAddToCart = async (product) => {
        try {
            setAddingToCart(prev => ({...prev, [product.id]: true}));

            const cartItem = {
                productId: product._id || product.id,
                quantity: 1
            };

            const result = await addToCart(cartItem);

            if (result.success) {
                Alert.alert('Success', 'Product added to cart!');
            } else {
                Alert.alert('Error', result.error || 'Failed to add product to cart');
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            Alert.alert('Error', 'Failed to add product to cart');
        } finally {
            setAddingToCart(prev => ({...prev, [product.id]: false}));
        }
    };

    const handleProductPress = (product) => {
        router.push(`/screens/ProductDetailScreen?id=${product._id || product.id}`);
    };

    const handleClose = () => {
        router.back();
    };

    const handleViewCart = () => {
        router.push('/screens/CartScreen');
    };

    // Calculate total items in cart (you might want to get this from global state)
    const cartItemCount = 0; // Replace with actual cart count

    const renderProduct = ({item, index}) => (
        <Pressable
            style={[
                styles.productCard,
                index % 2 === 0 ? styles.leftCard : styles.rightCard
            ]}
            onPress={() => handleProductPress(item)}
        >
            <Image
                source={item.thumbnail ? {uri: `${API_BASE_URL}${item.thumbnail}`} : require("../../../assets/Rectangle 24904.png")}
                style={styles.productImage}
                resizeMode="cover"
            />
            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                    {item.title || item.name}
                </Text>
                <Text style={styles.productPrice}>
                    ₹{item.basePrice || item.price}
                </Text>
                {item.discount && (
                    <Text style={styles.productDiscount}>
                        {item.discount.value}% OFF
                    </Text>
                )}
            </View>
            <Pressable
                style={[
                    styles.addButton,
                    addingToCart[item.id] && styles.addButtonDisabled
                ]}
                onPress={() => handleAddToCart(item)}
                disabled={addingToCart[item.id]}
            >
                <Text style={styles.addButtonText}>
                    {addingToCart[item.id] ? 'ADDING...' : 'ADD'}
                </Text>
            </Pressable>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

            {/* Header with Close Button */}
            <View style={styles.header}>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                    <Image
                        source={require("../../../assets/icons/deleteIcon.png")}
                        style={styles.closeIcon}
                    />
                </Pressable>
                <Text style={styles.headerTitle}>
                    {selectedCategory?.name || 'Categories'}
                </Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <View style={styles.content}>
                {/* Left Side - Categories */}
                <ScrollView style={styles.categoriesList}>
                    {categories.map((category) => (
                        <Pressable
                            key={category._id}
                            style={[
                                styles.categoryItem,
                                selectedCategory?._id === category._id && styles.selectedCategoryItem
                            ]}
                            onPress={() => handleCategorySelect(category)}
                        >
                            <Text style={[
                                styles.categoryName,
                                selectedCategory?._id === category._id && styles.selectedCategoryName
                            ]}>
                                {category.name}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Right Side - Products Grid */}
                <View style={styles.productsContainer}>
                    <FlatList
                        data={products}
                        renderItem={renderProduct}
                        keyExtractor={(item) => item._id || item.id}
                        numColumns={2}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.productsGrid}
                    />
                </View>
            </View>

            {/* View Cart Button */}
            {cartItemCount > 0 && (
                <View style={styles.cartButtonContainer}>
                    <Pressable style={styles.cartButton} onPress={handleViewCart}>
                        <View style={styles.cartBadge}>
                            <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                        </View>
                        <Text style={styles.cartButtonText}>View Cart</Text>
                        <Text style={styles.cartPrice}>₹{/* Total price */}</Text>
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    closeButton: {
        padding: 8,
    },
    closeIcon: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    headerPlaceholder: {
        width: 40,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    categoriesList: {
        width: 120,
        backgroundColor: '#F8F9FA',
        borderRightWidth: 1,
        borderRightColor: '#F0F0F0',
    },
    categoryItem: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    selectedCategoryItem: {
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 3,
        borderLeftColor: '#EC0505',
    },
    categoryName: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    selectedCategoryName: {
        color: '#EC0505',
        fontWeight: '600',
    },
    productsContainer: {
        flex: 1,
    },
    productsGrid: {
        padding: 8,
    },
    productCard: {
        flex: 1,
        margin: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        maxWidth: (width - 120 - 32) / 2,
    },
    leftCard: {
        marginRight: 4,
    },
    rightCard: {
        marginLeft: 4,
    },
    productImage: {
        width: '100%',
        height: 100,
        borderRadius: 8,
        marginBottom: 8,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#1B1B1B',
        marginBottom: 4,
        lineHeight: 16,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B1B1B',
        marginBottom: 2,
    },
    productDiscount: {
        fontSize: 10,
        color: '#EC0505',
        fontWeight: '500',
    },
    addButton: {
        backgroundColor: '#EC0505',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginTop: 8,
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    cartButtonContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
    cartButton: {
        backgroundColor: '#EC0505',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    cartBadge: {
        backgroundColor: '#FFFFFF',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartBadgeText: {
        color: '#EC0505',
        fontSize: 12,
        fontWeight: '700',
    },
    cartButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    cartPrice: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
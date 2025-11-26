import React, {useState, useEffect, useCallback} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    FlatList,
    TouchableOpacity,
    Image,
    TextInput,
    Modal,
    StatusBar,
    RefreshControl,
    ActivityIndicator,
    Dimensions, Alert,
} from 'react-native';
import {useRouter, useLocalSearchParams} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCategories, getProducts} from "../../api/catalogApi";
import {addCartItem, getCart, removeCartItem, updateCartItem} from "../../api/cartApi";
import {API_BASE_URL} from "../../config/apiConfig";
import {SafeAreaView} from "react-native-safe-area-context";

const {width} = Dimensions.get('window');

export default function AllProductsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(params.selectedCategory || 'all');
    const [sortBy, setSortBy] = useState('popular');
    const [priceRange, setPriceRange] = useState([0, 10000]);
    const [showFilters, setShowFilters] = useState(false);
    const [cartItems, setCartItems] = useState([]);
    const [addingToCart, setAddingToCart] = useState({});
    const [isBusinessUser, setIsBusinessUser] = useState(false);
    const [tierPricing, setTierPricing] = useState({});

    // Load initial data
    useEffect(() => {
        loadInitialData();
        checkUserType();
    }, []);

    // Filter products when criteria change
    useEffect(() => {
        filterProducts();
    }, [products, searchQuery, selectedCategory, sortBy, priceRange]);

    const loadInitialData = async () => {
        await Promise.all([
            loadProducts(),
            loadCategories(),
            loadCartItems()
        ]);
    };

    const checkUserType = async () => {
        try {
            const loginType = await AsyncStorage.getItem('loginType');
            setIsBusinessUser(loginType === 'business');

            if (loginType === 'business') {
                await loadTierPricing();
            }
        } catch (error) {
            console.error('Error checking user type:', error);
        }
    };

    const loadTierPricing = async () => {
        try {
            console.log('Loading tier pricing for business user...');
            // Add your tier pricing loading logic here
        } catch (error) {
            console.error('Error loading tier pricing:', error);
        }
    };

    const loadProducts = async () => {
        try {
            setLoading(true);
            const res = await getProducts({page: 1, limit: 100});
            const productsData = extractProductsFromResponse(res);
            setProducts(productsData);
        } catch (error) {
            console.error('Error loading products:', error);
            Alert.alert('Error', 'Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const res = await getCategories();
            const categoriesData = extractCategoriesFromResponse(res);
            setCategories([{_id: 'all', name: 'All Categories'}, ...categoriesData]);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const loadCartItems = async () => {
        try {
            const cartData = await getCart();
            const items = extractCartItems(cartData);
            setCartItems(items);
        } catch (error) {
            console.error('Error loading cart items:', error);
            setCartItems([]);
        }
    };

    const extractProductsFromResponse = (response) => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.items)) return response.items;
        if (Array.isArray(response.data?.items)) return response.data.items;
        if (response.success && Array.isArray(response.data?.data)) return response.data.data;
        return [];
    };

    const extractCategoriesFromResponse = (response) => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.data?.data)) return response.data.data;
        return [];
    };

    const extractCartItems = (cartData) => {
        if (cartData?.success) {
            if (cartData.data?.items) return cartData.data.items;
            if (Array.isArray(cartData.data)) return cartData.data;
        }
        if (Array.isArray(cartData)) return cartData;
        return [];
    };

    const filterProducts = () => {
        let filtered = [...products];

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(product => {
                const title = product?.title?.toLowerCase() || '';
                const name = product?.name?.toLowerCase() || '';
                const description = product?.description?.toLowerCase() || '';
                const query = searchQuery.toLowerCase();

                return title.includes(query) || name.includes(query) || description.includes(query);
            });
        }

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(product =>
                product.category === selectedCategory ||
                product.categoryId === selectedCategory ||
                product.category?._id === selectedCategory
            );
        }

        // Filter by price range
        filtered = filtered.filter(product => {
            const price = calculateProductPrice(product).finalPrice;
            return price >= priceRange[0] && price <= priceRange[1];
        });

        // Sort products
        switch (sortBy) {
            case 'price-low':
                filtered.sort((a, b) => calculateProductPrice(a).finalPrice - calculateProductPrice(b).finalPrice);
                break;
            case 'price-high':
                filtered.sort((a, b) => calculateProductPrice(b).finalPrice - calculateProductPrice(a).finalPrice);
                break;
            case 'name':
                filtered.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
                break;
            case 'popular':
            default:
                // Keep original order or add popularity logic
                break;
        }

        setFilteredProducts(filtered);
    };

    // Updated price calculation function from home screen
    const calculateProductPrice = (product, quantity = 1) => {
        const normalize = (val) => val !== undefined && val !== null ? Number(val) : null;

        const buildResponse = (base, final, discount, discountPercentOverride, minQty = 1) => {
            base = normalize(base);
            final = normalize(final);

            if (!base) base = 0;
            if (!final) final = base;

            let discountPercent = 0;

            if (discountPercentOverride > 0) {
                discountPercent = discountPercentOverride;
            } else if (discount?.type === "percent" && discount.value > 0) {
                discountPercent = Number(discount.value);
            } else if (final < base) {
                discountPercent = Math.round(((base - final) / base) * 100);
            }

            return {
                basePrice: Math.round(base),
                finalPrice: Math.round(final),
                hasDiscount: discountPercent > 0,
                discountPercent,
                minQty
            };
        };

        if (isBusinessUser && product.tierPricing) {
            const applicableTier = product.tierPricing.find(tier =>
                quantity >= tier.minQty && quantity <= tier.maxQty
            );

            if (applicableTier) {
                return buildResponse(
                    applicableTier.price,
                    applicableTier.price,
                    null,
                    0,
                    applicableTier.minQty
                );
            }
        }

        if (Array.isArray(product?.variants) && product.variants.length > 0) {
            const v = product.variants[0];
            return buildResponse(
                v.basePrice ?? product.basePrice,
                v.finalPrice ?? product.finalPrice ?? product.price,
                v.discount ?? product.discount,
                v.discountPercent ?? product.discountPercent
            );
        }

        return buildResponse(
            product.basePrice ?? product.price,
            product.finalPrice ?? product.price,
            product.discount,
            product.discountPercent
        );
    };

    const getCartQuantity = (productId, variantId = null) => {
        const item = cartItems.find(cartItem =>
            cartItem.productId === String(productId) &&
            cartItem.variantId === (variantId ? String(variantId) : null)
        );
        return item ? item.quantity : 0;
    };

    const getCartItemId = (productId, variantId = null) => {
        const cartItem = cartItems.find(item =>
            item.productId === String(productId) &&
            item.variantId === (variantId ? String(variantId) : null)
        );
        return cartItem?._id || cartItem?.id;
    };

    const handleAddToCart = async (product) => {
        try {
            const productId = product._id || product.id;

            // Check minimum quantity for business users
            if (isBusinessUser && product.minQty && product.minQty > 1) {
                Alert.alert(
                    'Minimum Quantity Required',
                    `Minimum order quantity for this product is ${product.minQty} units for business customers.`,
                    [{text: 'OK'}]
                );
                return;
            }

            setAddingToCart(prev => ({...prev, [productId]: true}));
            const cartItem = {
                productId: productId,
                quantity: product.minQty || 1,
                variantId: product.variants[0]._id || productId
            };

            await addCartItem(cartItem);
            await loadCartItems();

        } catch (error) {
            console.error('Add to cart error:', error);

            if (error.response?.data?.message?.includes('Minimum quantity')) {
                Alert.alert('Minimum Quantity', error.response.data.message);
            } else {
                Alert.alert('Error', 'Failed to add product to cart. Please try again.');
            }
        } finally {
            const productId = product._id || product.id;
            setAddingToCart(prev => ({...prev, [productId]: false}));
        }
    };

    const handleUpdateQuantity = async (productId, variantId, newQuantity) => {
        try {
            const itemId = getCartItemId(productId, variantId);

            if (!itemId) {
                Alert.alert('Error', 'Cart item not found');
                return;
            }

            if (newQuantity === 0) {
                await removeCartItem(productId, variantId);
            } else {
                await updateCartItem(itemId, newQuantity);
            }

            await loadCartItems();
        } catch (error) {
            console.error('Error updating quantity:', error);
            Alert.alert('Error', 'Failed to update quantity');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadInitialData();
        setRefreshing(false);
    }, []);

    const renderProductItem = ({item}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = item._id || item.id;
        const cartQuantity = getCartQuantity(productId, item.variantId);
        const imageSource = item.thumbnail
            ? {uri: `${API_BASE_URL}${item.thumbnail}`}
            : require('../../assets/Rectangle 24904.png');

        return (
            <TouchableOpacity
                style={styles.productCard}
                onPress={() => router.push(`/screens/ProductDetailScreen?id=${productId}`)}
            >
                {/* Business User Badge */}
                {isBusinessUser && priceInfo.minQty > 1 && (
                    <View style={styles.minQtyBadge}>
                        <Text style={styles.minQtyText}>Min: {priceInfo.minQty}</Text>
                    </View>
                )}

                <Image
                    source={imageSource}
                    style={styles.productImage}
                    resizeMode="cover"
                />

                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {item.title || item.name}
                    </Text>

                    <View style={styles.priceContainer}>
                        <Text style={styles.productPrice}>₹{priceInfo.finalPrice}</Text>
                        {priceInfo.hasDiscount && (
                            <View style={styles.discountContainer}>
                                <Text style={styles.originalPrice}>₹{priceInfo.basePrice}</Text>
                                <Text style={styles.discountBadge}>{priceInfo.discountPercent}% OFF</Text>
                            </View>
                        )}

                        {isBusinessUser && priceInfo.minQty > 1 && (
                            <Text style={styles.businessMinQty}>
                                Min. {priceInfo.minQty} units
                            </Text>
                        )}
                    </View>

                    <View style={styles.quantityContainer}>
                        {cartQuantity > 0 ? (
                            <View style={styles.quantityControl}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(productId, item.variantId, cartQuantity - 1)}
                                >
                                    <Text style={styles.quantityButtonText}>-</Text>
                                </TouchableOpacity>
                                <Text style={styles.quantityText}>{cartQuantity}</Text>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(productId, item.variantId, cartQuantity + 1)}
                                >
                                    <Text style={styles.quantityButtonText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.addButton, addingToCart[productId] && styles.addButtonDisabled]}
                                disabled={addingToCart[productId]}
                                onPress={() => handleAddToCart(item)}
                            >
                                <Text style={styles.addButtonText}>
                                    {addingToCart[productId] ? '...' : 'ADD'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderCategoryItem = ({item}) => (
        <TouchableOpacity
            style={[
                styles.categoryItem,
                selectedCategory === item._id && styles.selectedCategoryItem
            ]}
            onPress={() => setSelectedCategory(item._id)}
        >
            <Text style={[
                styles.categoryText,
                selectedCategory === item._id && styles.selectedCategoryText
            ]}>
                {item.name}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{flex: 1}}>
            <View style={styles.container}>

                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                            source={require('../../assets/icons/back_icon.png')}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>All Products</Text>
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => setShowFilters(true)}
                    >
                        <Image
                            source={require('../../assets/icons/filter.png')}
                            style={styles.filterIcon}
                        />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Image
                        source={require('../../assets/icons/search.png')}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                </View>

                {/* Categories Horizontal Scroll */}
                <View style={styles.categoriesContainer}>
                    <FlatList
                        horizontal
                        data={categories}
                        renderItem={renderCategoryItem}
                        keyExtractor={(item) => item._id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesList}
                    />
                </View>

                {/* Products Grid */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4CAD73"/>
                        <Text style={styles.loadingText}>Loading products...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredProducts}
                        renderItem={renderProductItem}
                        keyExtractor={(item) => item._id || item.id}
                        numColumns={2}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={['#4CAD73']}
                            />
                        }
                        contentContainerStyle={styles.productsGrid}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Image
                                    source={require('../../assets/icons/empty-box.png')}
                                    style={styles.emptyIcon}
                                />
                                <Text style={styles.emptyText}>No products found</Text>
                                <Text style={styles.emptySubtext}>Try changing your filters</Text>
                            </View>
                        }
                    />
                )}

                {/* Filters Modal */}
                <Modal
                    visible={showFilters}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowFilters(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Filters</Text>
                                <TouchableOpacity onPress={() => setShowFilters(false)}>
                                    <Image
                                        source={require('../../assets/icons/deleteIcon.png')}
                                        style={styles.closeIcon}
                                    />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.filterContent}>
                                {/* Sort By */}
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterSectionTitle}>Sort By</Text>
                                    {['popular', 'price-low', 'price-high', 'name'].map((sort) => (
                                        <TouchableOpacity
                                            key={sort}
                                            style={styles.filterOption}
                                            onPress={() => setSortBy(sort)}
                                        >
                                            <View style={styles.radioButton}>
                                                {sortBy === sort && <View style={styles.radioSelected}/>}
                                            </View>
                                            <Text style={styles.filterOptionText}>
                                                {sort === 'popular' && 'Most Popular'}
                                                {sort === 'price-low' && 'Price: Low to High'}
                                                {sort === 'price-high' && 'Price: High to Low'}
                                                {sort === 'name' && 'Name: A to Z'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Price Range */}
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterSectionTitle}>Price Range</Text>
                                    <Text style={styles.priceRangeText}>
                                        ₹{priceRange[0]} - ₹{priceRange[1]}
                                    </Text>
                                    {/* You can add a Slider component here for better UX */}
                                </View>
                            </ScrollView>

                            <View style={styles.filterActions}>
                                <TouchableOpacity
                                    style={styles.resetButton}
                                    onPress={() => {
                                        setSortBy('popular');
                                        setPriceRange([0, 10000]);
                                    }}
                                >
                                    <Text style={styles.resetButtonText}>Reset</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.applyButton}
                                    onPress={() => setShowFilters(false)}
                                >
                                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </View>
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
        backgroundColor: '#4CAD73',
    },
    backButton: {
        padding: 8,
    },
    backIcon: {
        width: 24,
        height: 24,
        tintColor: '#FFFFFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
    },
    filterButton: {
        padding: 8,
    },
    filterIcon: {
        width: 20,
        height: 20,
        tintColor: '#FFFFFF',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        margin: 16,
        paddingHorizontal: 12,
        borderRadius: 10,
        height: 44,
    },
    searchIcon: {
        width: 18,
        height: 18,
        marginRight: 8,
        tintColor: '#666',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        fontFamily: 'Poppins-Regular',
    },
    categoriesContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    categoriesList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    categoryItem: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        marginRight: 8,
    },
    selectedCategoryItem: {
        backgroundColor: '#4CAD73',
    },
    categoryText: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    selectedCategoryText: {
        color: '#FFFFFF',
    },
    productsGrid: {
        padding: 8,
        paddingBottom: 100,
    },
    productCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        margin: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        maxWidth: (width - 48) / 2,
    },
    productImage: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        color: '#1B1B1B',
        marginBottom: 8,
        lineHeight: 18,
        minHeight: 36,
    },
    priceContainer: {
        marginBottom: 8,
    },
    productPrice: {
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
    },
    discountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    originalPrice: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#999',
        textDecorationLine: 'line-through',
        marginRight: 6,
    },
    discountBadge: {
        fontSize: 10,
        fontFamily: 'Poppins-SemiBold',
        color: '#EC0505',
        backgroundColor: '#FFE8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    quantityContainer: {
        marginTop: 'auto',
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    quantityButton: {
        padding: 4,
    },
    quantityButtonText: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1B1B1B',
        marginHorizontal: 12,
    },
    addButton: {
        borderWidth: 1,
        borderColor: '#27AF34',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    addButtonText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#27AF34',
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#666',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#999',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
        color: '#1B1B1B',
    },
    closeIcon: {
        width: 20,
        height: 20,
        tintColor: '#666',
    },
    filterContent: {
        padding: 20,
    },
    filterSection: {
        marginBottom: 24,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#1B1B1B',
        marginBottom: 12,
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#DDD',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioSelected: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4CAD73',
    },
    filterOptionText: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#333',
    },
    priceRangeText: {
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        color: '#666',
        textAlign: 'center',
        marginVertical: 8,
    },
    filterActions: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    resetButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 12,
    },
    resetButtonText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#666',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#4CAD73',
        borderRadius: 8,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    // New styles for business user features
    minQtyBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FF6B35',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    },
    minQtyText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'Poppins-Bold',
    },
    businessMinQty: {
        fontSize: 10,
        fontFamily: 'Poppins-Regular',
        color: '#FF6B35',
        marginTop: 2,
    },
});
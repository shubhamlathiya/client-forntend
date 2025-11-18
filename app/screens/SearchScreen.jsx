import React, {useState, useEffect} from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TextInput, TouchableOpacity, ActivityIndicator, FlatList, StatusBar,
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {getProducts, searchProducts} from '../../api/catalogApi';
import {API_BASE_URL} from '../../config/apiConfig';

export default function SearchScreen() {
    const router = useRouter();
    const {searchQuery} = useLocalSearchParams();

    const [query, setQuery] = useState(searchQuery || '');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    // Load all products on component mount
    useEffect(() => {
        loadAllProducts();
    }, []);

    // Filter products when query changes
    useEffect(() => {
        if (query.trim() === '') {
            setFilteredProducts(products);
        } else {
            filterProducts(query);
        }
    }, [query, products]);

    const loadAllProducts = async () => {
        try {
            setLoading(true);
            const res = await getProducts({page: 1, limit: 50});
            const productsData = extractProductsFromResponse(res);
            setProducts(productsData);
            setFilteredProducts(productsData);
        } catch (error) {
            console.error('Error loading products for search:', error);
        } finally {
            setLoading(false);
        }
    };

    const extractProductsFromResponse = (response) => {
        if (!response) return [];

        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.items)) return response.items;
        if (Array.isArray(response.data?.items)) return response.data.items;
        if (Array.isArray(response.data?.data)) return response.data.data;

        return [];
    };

    const filterProducts = (searchText) => {
        const filtered = products.filter(product => {
            const title = product?.title?.toLowerCase() || '';
            const name = product?.name?.toLowerCase() || '';
            const category = product?.category?.toLowerCase() || '';
            const description = product?.description?.toLowerCase() || '';

            const searchTerm = searchText.toLowerCase();

            return title.includes(searchTerm) || name.includes(searchTerm) || category.includes(searchTerm) || description.includes(searchTerm);
        });
        setFilteredProducts(filtered);
    };

    const handleSearch = async (searchText) => {
        setQuery(searchText);

        if (searchText.trim() === '') {
            setFilteredProducts(products);
            return;
        }

        try {
            setSearchLoading(true);
            // You can use a dedicated search API if available
            // const searchResults = await searchProducts(searchText);
            // setFilteredProducts(extractProductsFromResponse(searchResults));

            // For now, using client-side filtering
            filterProducts(searchText);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleProductPress = (product) => {
        const productId = product._id || product.id;
        router.push(`/screens/ProductDetailScreen?id=${productId}`);
    };

    const calculateProductPrice = (product) => {
        const normalize = (val) => val !== undefined && val !== null ? Number(val) : null;

        const buildResponse = (base, final, discount, discountPercentOverride) => {
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
                discountPercent
            };
        };

        if (Array.isArray(product?.variants) && product.variants.length > 0) {
            const v = product.variants[0];
            return buildResponse(v.basePrice ?? product.basePrice, v.finalPrice ?? product.finalPrice ?? product.price, v.discount ?? product.discount, v.discountPercent ?? product.discountPercent);
        }

        return buildResponse(product.basePrice ?? product.price, product.finalPrice ?? product.price, product.discount, product.discountPercent);
    };

    const renderProductItem = ({item}) => {
        const priceInfo = calculateProductPrice(item);
        const productId = item._id || item.id;
        const imageSource = item?.thumbnail ? {uri: `${API_BASE_URL}${item.thumbnail}`} : require('../../assets/Rectangle 24904.png');

        return (<TouchableOpacity
                style={styles.productCard}
                onPress={() => handleProductPress(item)}
            >
                <Image
                    source={imageSource}
                    style={styles.productImage}
                    resizeMode="cover"
                />

                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {item?.title || item?.name || 'Unnamed Product'}
                    </Text>

                    <View style={styles.priceContainer}>
                        <Text style={styles.currentPrice}>₹{priceInfo.finalPrice}</Text>
                        {priceInfo.hasDiscount && (<View style={styles.discountContainer}>
                                <Text style={styles.originalPrice}>₹{priceInfo.basePrice}</Text>
                                <Text style={styles.discountText}>{priceInfo.discountPercent}% OFF</Text>
                            </View>)}
                    </View>

                    <Text style={styles.deliveryTime}>Delivery in 16 mins</Text>
                </View>
            </TouchableOpacity>);
    };

    const popularSearches = ['Milk', 'Bread', 'Eggs', 'Rice', 'Apple', 'Banana', 'Potato', 'Onion', 'Tomato', 'Biscuits'];

    return (<View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>
            {/* Top Bar with Back and Search */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Image
                        source={require('../../assets/icons/back_icon.png')}
                        style={styles.backIcon}
                    />
                </TouchableOpacity>

                <View style={styles.searchBox}>
                    <Image
                        source={require('../../assets/icons/search.png')}
                        style={styles.searchIcon}
                        resizeMode="contain"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Search for products..."
                        placeholderTextColor="#838383"
                        value={query}
                        onChangeText={handleSearch}
                        autoFocus={true}
                        returnKeyType="search"
                    />
                    {(searchLoading || loading) && (
                        <ActivityIndicator size="small" color="#EC0505" style={styles.loadingIndicator}/>)}
                </View>
            </View>

            {/* Search Results */}
            {query ? (<View style={styles.resultsContainer}>
                    <Text style={styles.resultsTitle}>
                        {filteredProducts.length > 0 ? `Search Results for "${query}" (${filteredProducts.length})` : `No results found for "${query}"`}
                    </Text>

                    {loading ? (<View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#EC0505"/>
                            <Text style={styles.loadingText}>Loading products...</Text>
                        </View>) : (<FlatList
                            data={filteredProducts}
                            renderItem={renderProductItem}
                            keyExtractor={(item) => item._id || item.id || Math.random().toString()}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.productsList}
                            ListEmptyComponent={!loading && (<View style={styles.emptyContainer}>
                                    <Image
                                        source={require('../../assets/icons/search.png')}
                                        style={styles.emptyIcon}
                                    />
                                    <Text style={styles.emptyTitle}>No products found</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Try searching with different keywords
                                    </Text>
                                </View>)}
                        />)}
                </View>) : (/* Popular Searches when no query */
                <ScrollView
                    style={styles.popularContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.popularTitle}>Popular Searches</Text>

                    <View style={styles.popularTags}>
                        {popularSearches.map((searchTerm, index) => (<TouchableOpacity
                                key={index}
                                style={styles.tag}
                                onPress={() => setQuery(searchTerm)}
                            >
                                <Text style={styles.tagText}>{searchTerm}</Text>
                            </TouchableOpacity>))}
                    </View>

                    {/* Recent Searches Section (you can implement this later) */}
                    {/* <Text style={styles.sectionTitle}>Recent Searches</Text>
                    <View style={styles.recentSearches}>
                        {/* Map through recent searches * /}
                    </View> */}
                </ScrollView>)}
        </View>);
}

const styles = StyleSheet.create({
    container: {
        flex: 1, backgroundColor: '#FFFFFF', paddingTop: 40,
    }, topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    }, backIcon: {
        width: 32, height: 32, tintColor: '#000', marginRight: 12,
    }, searchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    }, searchIcon: {
        width: 20, height: 20, tintColor: '#838383', marginRight: 8,
    }, input: {
        flex: 1, fontFamily: 'Poppins', fontSize: 16, color: '#000',
    }, loadingIndicator: {
        marginLeft: 8,
    }, resultsContainer: {
        flex: 1, paddingHorizontal: 16,
    }, resultsTitle: {
        fontFamily: 'Poppins', fontSize: 16, fontWeight: '600', color: '#000', marginVertical: 16,
    }, popularContainer: {
        flex: 1, paddingHorizontal: 16,
    }, popularTitle: {
        fontFamily: 'Poppins', fontSize: 18, fontWeight: '600', color: '#000', marginVertical: 16,
    }, popularTags: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24,
    }, tag: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    }, tagText: {
        fontFamily: 'Poppins', fontSize: 14, color: '#333', fontWeight: '500',
    }, productsList: {
        paddingBottom: 20,
    }, productCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    }, productImage: {
        width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#F8F9FA',
    }, productInfo: {
        flex: 1, justifyContent: 'space-between',
    }, productName: {
        fontFamily: 'Poppins', fontSize: 14, fontWeight: '600', color: '#1B1B1B', marginBottom: 6, lineHeight: 18,
    }, priceContainer: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 4,
    }, currentPrice: {
        fontFamily: 'Poppins', fontSize: 16, fontWeight: '700', color: '#1B1B1B', marginRight: 8,
    }, discountContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
    }, originalPrice: {
        fontFamily: 'Poppins', fontSize: 12, color: '#999', textDecorationLine: 'line-through',
    }, discountText: {
        fontFamily: 'Poppins',
        fontSize: 12,
        fontWeight: '600',
        color: '#EC0505',
        backgroundColor: '#FFE8E8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    }, deliveryTime: {
        fontFamily: 'Poppins', fontSize: 12, color: '#27AF34', fontWeight: '500',
    }, loadingContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40,
    }, loadingText: {
        marginTop: 12, fontSize: 14, color: '#666', fontFamily: 'Poppins',
    }, emptyContainer: {
        alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40,
    }, emptyIcon: {
        width: 80, height: 80, marginBottom: 16, opacity: 0.5, tintColor: '#666',
    }, emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1B1B1B',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 8,
        textAlign: 'center',
    }, emptySubtitle: {
        fontSize: 14, color: '#666', textAlign: 'center', fontFamily: 'Poppins-Regular', lineHeight: 20,
    },
});
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    FlatList,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    StatusBar,
    SafeAreaView,
    RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../../config/apiConfig';
import { getWishlist, toggleWishlist } from "../../api/catalogApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive size calculator
const responsiveSize = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    return Math.round(size * scale);
};

// Responsive percentage width
const responsiveWidth = (percentage) => {
    return (screenWidth * percentage) / 100;
};

// Responsive percentage height
const responsiveHeight = (percentage) => {
    return (screenHeight * percentage) / 100;
};

// Check if device is tablet
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;

export default function WishlistScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [wishlistUpdating, setWishlistUpdating] = useState({});

    // Calculate columns based on screen size
    const getColumns = () => {
        if (screenWidth >= 1024) return 2; // Large tablets/desktop
        if (screenWidth >= 768) return 2;  // Tablets
        return 1; // Phones
    };

    const columns = getColumns();

    // Fetch wishlist data
    const fetchWishlist = async () => {
        try {
            setLoading(true);
            const raw = await AsyncStorage.getItem('userData');
            const user = raw ? JSON.parse(raw) : null;
            const parseUserId = (u) => u?._id || u?.id || u?.userId || null;
            const uid = parseUserId(user);

            if (!uid) {
                setWishlistItems([]);
                return;
            }

            const response = await getWishlist(uid);

            // Handle different response formats
            let items = [];
            if (response?.success) {
                if (response.data?.data) {
                    items = response.data.data;
                } else if (response.data?.items) {
                    items = response.data.items;
                } else if (Array.isArray(response.data)) {
                    items = response.data;
                }
            } else if (response?.data) {
                items = response.data;
            } else if (Array.isArray(response)) {
                items = response;
            } else if (response?.items) {
                items = response.items;
            }

            // Ensure items have product data
            const formattedItems = items.map(item => {
                // If item has productId as an object, use it as product
                if (item.productId && typeof item.productId === 'object') {
                    return {
                        ...item,
                        product: item.productId
                    };
                }
                // If item is the product itself
                if (item.title || item.name) {
                    return {
                        _id: item._id || item.id,
                        product: item
                    };
                }
                return item;
            });

            setWishlistItems(formattedItems.filter(Boolean));
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            Alert.alert('Error', 'Failed to load wishlist');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchWishlist();
    }, []);

    // Toggle wishlist item (remove from wishlist)
    const toggleWishlistForProduct = async (productId) => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            const user = userData ? JSON.parse(userData) : null;
            const userId = user?._id || user?.id || user?.userId || null;

            if (!userId) {
                router.push('/screens/LoginScreen');
                return;
            }

            // Set updating state
            setWishlistUpdating(prev => ({ ...prev, [productId]: true }));

            // Call API to remove from wishlist
            const res = await toggleWishlist(userId, String(productId));

            // Check if successful
            const success = res?.success || res?.data?.success ||
                (res?.inWishlist === false) ||
                (res?.data?.inWishlist === false);

            if (success) {
                // Remove item from local state
                setWishlistItems(prev =>
                    prev.filter(item => {
                        const itemProductId = item.product?._id || item.product?.id || item._id;
                        return itemProductId !== productId;
                    })
                );

            } else {
                Alert.alert('Error', 'Failed to remove from wishlist');
            }
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            Alert.alert('Error', 'Failed to update wishlist');
        } finally {
            // Clear updating state
            setWishlistUpdating(prev => ({ ...prev, [productId]: false }));
        }
    };

    const handleProductPress = (product) => {
        const productid = product._id || product.id;
        router.push(`/screens/ProductDetailScreen?id=${productid}`);
    }


    // Render wishlist item in grid view
    const renderGridItem = ({ item }) => {
        const product = item.product || item;
        const productImage = product.images?.[0]?.url || product.thumbnail || product.image;
        const productName = product.title || product.name || 'Product';
        const brandName = product.brandId?.name || product.brand || '';
        const isOutOfStock = product.stock === 0;
        const productId = product._id || product.id;
        const isUpdating = wishlistUpdating[productId] || false;

        const cardWidth = (screenWidth - responsiveSize(48)) / columns;
        const imageHeight = responsiveHeight(columns === 2 ? 15 : 20);

        return (
            <View style={[
                styles.gridItem,
                { width: cardWidth }
            ]}>
                {/* Product Image with Remove Button */}
                <View style={[
                    styles.imageContainer,
                    { height: imageHeight }
                ]}>
                    <Pressable
                        onPress={() => handleProductPress(product)}
                        activeOpacity={0.8}
                        disabled={isUpdating}
                    >
                        <Image
                            source={
                                productImage
                                    ? { uri: `${API_BASE_URL}${productImage}` }
                                    : require('../../assets/icons/fruit.png')
                            }
                            style={styles.productImage}
                            resizeMode="cover"
                        />
                    </Pressable>

                    {/* Remove Button - Heart Icon */}
                    <Pressable
                        style={[
                            styles.heartButton,
                            {
                                width: responsiveSize(32),
                                height: responsiveSize(32),
                                borderRadius: responsiveSize(16),
                            }
                        ]}
                        onPress={() => toggleWishlistForProduct(productId)}
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <ActivityIndicator
                                size="small"
                                color="#FF6B6B"
                            />
                        ) : (
                            <Image
                                source={require('../../assets/icons/heart_filled.png')}
                                style={[
                                    styles.heartIcon,
                                    {
                                        width: responsiveSize(16),
                                        height: responsiveSize(16),
                                    }
                                ]}
                                resizeMode="contain"
                            />
                        )}
                    </Pressable>
                </View>

                {/* Product Details */}
                <Pressable
                    onPress={() => handleProductPress(product)}
                    style={styles.productDetails}
                    activeOpacity={0.7}
                    disabled={isUpdating}
                >
                    <Text style={[
                        styles.productName,
                        { fontSize: responsiveSize(isTablet ? 14 : 13) }
                    ]} numberOfLines={2}>
                        {productName}
                    </Text>

                    {brandName ? (
                        <Text style={[
                            styles.brandName,
                            { fontSize: responsiveSize(12) }
                        ]} numberOfLines={1}>
                            {brandName}
                        </Text>
                    ) : null}

                    {/* Price Removed as per requirement */}

                    {isOutOfStock && (
                        <Text style={[
                            styles.outOfStock,
                            { fontSize: responsiveSize(11) }
                        ]}>
                            Out of Stock
                        </Text>
                    )}

                    {/* "Move to Cart" button removed as per requirement */}
                </Pressable>
            </View>
        );
    };

    // Render wishlist item in list view (for single column)
    const renderListItem = ({ item }) => {
        const product = item.product || item;
        const productImage = product.images?.[0]?.url || product.thumbnail || product.image;
        const productName = product.title || product.name || 'Product';
        const brandName = product.brandId?.name || product.brand || '';
        const isOutOfStock = product.stock === 0;
        const productId = product._id || product.id;
        const isUpdating = wishlistUpdating[productId] || false;

        return (
            <View style={styles.listItem}>
                <Pressable
                    style={styles.listItemContent}
                    onPress={() => handleProductPress(product)}
                    activeOpacity={0.7}
                    disabled={isUpdating}
                >
                    {/* Product Image */}
                    <Image
                        source={
                            productImage
                                ? { uri: `${API_BASE_URL}${productImage}` }
                                : require('../../assets/icons/fruit.png')
                        }
                        style={[
                            styles.listItemImage,
                            {
                                width: responsiveSize(100),
                                height: responsiveSize(100),
                            }
                        ]}
                        resizeMode="cover"
                    />

                    {/* Product Details */}
                    <View style={styles.listItemDetails}>
                        <Text style={[
                            styles.listProductName,
                            { fontSize: responsiveSize(15) }
                        ]} numberOfLines={2}>
                            {productName}
                        </Text>

                        {brandName ? (
                            <Text style={[
                                styles.listBrandName,
                                { fontSize: responsiveSize(13) }
                            ]} numberOfLines={1}>
                                {brandName}
                            </Text>
                        ) : null}

                        {/* Price Removed as per requirement */}

                        {isOutOfStock && (
                            <Text style={[
                                styles.listOutOfStock,
                                { fontSize: responsiveSize(12) }
                            ]}>
                                Out of Stock
                            </Text>
                        )}
                    </View>
                </Pressable>

                {/* Action Button - Heart for removal */}
                <Pressable
                    style={[
                        styles.listHeartButton,
                        {
                            width: responsiveSize(40),
                            height: responsiveSize(40),
                            borderRadius: responsiveSize(20),
                        }
                    ]}
                    onPress={() => toggleWishlistForProduct(productId)}
                    disabled={isUpdating}
                >
                    {isUpdating ? (
                        <ActivityIndicator
                            size="small"
                            color="#FF6B6B"
                        />
                    ) : (
                        <Image
                            source={require('../../assets/icons/heart_filled.png')}
                            style={[
                                styles.listHeartIcon,
                                {
                                    width: responsiveSize(18),
                                    height: responsiveSize(18),
                                }
                            ]}
                            resizeMode="contain"
                        />
                    )}
                </Pressable>
            </View>
        );
    };

    // Empty state
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Image
                source={require('../../assets/icons/heart_empty.png')}
                style={[
                    styles.emptyStateIcon,
                    {
                        width: responsiveWidth(30),
                        height: responsiveWidth(30),
                    }
                ]}
                resizeMode="contain"
            />
            <Text style={[
                styles.emptyStateTitle,
                { fontSize: responsiveSize(isTablet ? 22 : 20) }
            ]}>
                Your wishlist is empty
            </Text>
            <Text style={[
                styles.emptyStateText,
                {
                    fontSize: responsiveSize(isTablet ? 16 : 14),
                    marginHorizontal: responsiveSize(40),
                }
            ]}>
                Save your favorite items here to easily find them later
            </Text>
            <Pressable
                style={[
                    styles.shopButton,
                    {
                        paddingVertical: responsiveSize(12),
                        paddingHorizontal: responsiveSize(32),
                        borderRadius: responsiveSize(8),
                        marginTop: responsiveSize(20),
                    }
                ]}
                onPress={() => router.push('/Home')}
            >
                <Text style={[
                    styles.shopButtonText,
                    { fontSize: responsiveSize(16) }
                ]}>
                    Start Shopping
                </Text>
            </Pressable>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content" />
                <View style={styles.loaderContainer}>
                    <ActivityIndicator
                        size={responsiveSize(40)}
                        color="#4CAD73"
                    />
                    <Text style={[
                        styles.loaderText,
                        {
                            fontSize: responsiveSize(16),
                            marginTop: responsiveSize(20),
                        }
                    ]}>
                        Loading your wishlist...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#4CAD73" barStyle="light-content" />

            {/* Header */}
            <View style={[
                styles.header,
                {
                    height: responsiveSize(60) + insets.top,
                    paddingTop: insets.top,
                    paddingHorizontal: responsiveSize(16),
                }
            ]}>
                <Pressable
                    style={[
                        styles.backButton,
                        {
                            width: responsiveSize(40),
                            height: responsiveSize(40),
                        }
                    ]}
                    onPress={() => router.back()}
                >
                    <Image
                        source={require('../../assets/icons/back_icon.png')}
                        style={[
                            styles.backIcon,
                            {
                                width: responsiveSize(24),
                                height: responsiveSize(24),
                            }
                        ]}
                        resizeMode="contain"
                    />
                </Pressable>
                <Text style={[
                    styles.headerTitle,
                    { fontSize: responsiveSize(isTablet ? 20 : 18) }
                ]}>
                    Your Wishlist
                </Text>
                <View style={[
                    styles.headerRight,
                    { width: responsiveSize(40) }
                ]} />
            </View>

            {/* Wishlist Content */}
            <FlatList
                data={wishlistItems}
                renderItem={columns === 1 ? renderListItem : renderGridItem}
                keyExtractor={(item) => item._id || item.product?._id || Math.random().toString()}
                contentContainerStyle={[
                    styles.listContainer,
                    {
                        padding: responsiveSize(columns === 1 ? 16 : 12),
                        paddingBottom: responsiveHeight(5),
                    }
                ]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={fetchWishlist}
                        colors={["#4CAD73"]}
                        tintColor="#4CAD73"
                    />
                }
                numColumns={columns}
                key={columns}
                columnWrapperStyle={columns > 1 ? styles.columnWrapper : null}
                removeClippedSubviews={true}
                initialNumToRender={6}
                maxToRenderPerBatch={10}
                windowSize={5}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
    },
    loaderText: {
        color: '#666',
        fontFamily: 'Poppins-Medium',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#4CAD73',
        width: '100%',
    },
    backButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        tintColor: '#FFFFFF',
    },
    headerTitle: {
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        flex: 1,
    },
    headerRight: {
        opacity: 0,
    },
    itemsCountContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8E8',
    },
    itemsCountText: {
        fontFamily: 'Poppins-Medium',
        color: '#666',
    },
    listContainer: {
        flexGrow: 1,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: responsiveSize(12),
    },
    // Grid View Styles
    gridItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: responsiveSize(12),
        marginBottom: responsiveSize(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    imageContainer: {
        position: 'relative',
        backgroundColor: '#F8F9FA',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    heartButton: {
        position: 'absolute',
        top: responsiveSize(8),
        right: responsiveSize(8),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    heartIcon: {
        tintColor: '#FF6B6B',
    },
    productDetails: {
        padding: responsiveSize(12),
    },
    productName: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: responsiveSize(4),
        lineHeight: responsiveSize(18),
    },
    brandName: {
        fontFamily: 'Poppins',
        color: '#666',
        marginBottom: responsiveSize(6),
    },
    outOfStock: {
        fontFamily: 'Poppins-Medium',
        color: '#FF4444',
        marginTop: responsiveSize(4),
    },
    // List View Styles
    listItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: responsiveSize(12),
        padding: responsiveSize(12),
        marginBottom: responsiveSize(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    listItemContent: {
        flex: 1,
        flexDirection: 'row',
    },
    listItemImage: {
        borderRadius: responsiveSize(8),
        marginRight: responsiveSize(12),
        backgroundColor: '#F8F9FA',
    },
    listItemDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    listProductName: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        color: '#1B1B1B',
        marginBottom: responsiveSize(4),
        lineHeight: responsiveSize(20),
    },
    listBrandName: {
        fontFamily: 'Poppins',
        color: '#666',
        marginBottom: responsiveSize(6),
    },
    listOutOfStock: {
        fontFamily: 'Poppins-Medium',
        color: '#FF4444',
        marginTop: responsiveSize(4),
    },
    listHeartButton: {
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    listHeartIcon: {
        tintColor: '#FF6B6B',
    },
    // Empty State Styles
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: responsiveSize(80),
    },
    emptyStateIcon: {
        marginBottom: responsiveSize(24),
        tintColor: '#CCCCCC',
    },
    emptyStateTitle: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700',
        color: '#333',
        marginBottom: responsiveSize(8),
        textAlign: 'center',
    },
    emptyStateText: {
        fontFamily: 'Poppins',
        color: '#666',
        textAlign: 'center',
        lineHeight: responsiveSize(20),
        marginBottom: responsiveSize(32),
    },
    shopButton: {
        backgroundColor: '#4CAD73',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    shopButtonText: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useRouter } from 'expo-router';

import { API_BASE_URL } from '../../config/apiConfig';
import {getWishlist, removeFromWishlist} from "../../api/catalogApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function WishlistScreen() {
    const router = useRouter();
    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch wishlist data
    const fetchWishlist = async () => {
        try {
            setLoading(true);
            const raw = await AsyncStorage.getItem('userData');
            const user = raw ? JSON.parse(raw) : null;
            const parseUserId = (u) => u?._id || u?.id || u?.userId || null;
            const uid = parseUserId(user);
            if (!uid) { setWishlistItems([]); return; }
            const response = await getWishlist(uid);
            const items = response?.data || response?.items || response || [];
            setWishlistItems(Array.isArray(items) ? items : []);
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

    // Remove item from wishlist
    const handleRemoveItem = async (itemId) => {
        try {
            await removeFromWishlist(itemId);
            // Remove item from local state
            setWishlistItems(prev => prev.filter(item => item._id !== itemId));
            Alert.alert('Success', 'Item removed from wishlist');
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            Alert.alert('Error', 'Failed to remove item from wishlist');
        }
    };

    // Navigate to product detail
    const handleProductPress = (product) => {
        router.push({
            pathname: '/ProductDetailScreen',
            params: {
                id: product._id || product.id,
                product: JSON.stringify(product)
            }
        });
    };

    // Move item to cart
    const handleMoveToCart = async (product) => {
        try {
            // First remove from wishlist
            await handleRemoveItem(product._id || product.id);
            // Then navigate to cart or add to cart directly
            // You might want to implement addToCart functionality here
            Alert.alert('Success', 'Item moved to cart');
        } catch (error) {
            console.error('Error moving to cart:', error);
            Alert.alert('Error', 'Failed to move item to cart');
        }
    };

    // Render wishlist item
    const renderWishlistItem = ({ item }) => {
        const product = item.productId || item;
        const productImage = product.images?.[0]?.url || product.thumbnail;
        const productPrice = product.finalPrice || product.basePrice || product.price || 0;
        const productName = product.title || product.name || 'Product';
        const brandName = product.brandId?.name || '';

        return (
            <View style={styles.wishlistItem}>
                <TouchableOpacity
                    style={styles.productInfo}
                    onPress={() => handleProductPress(product)}
                >
                    <Image
                        source={
                            productImage
                                ? { uri: `${API_BASE_URL}${productImage}` }
                                : require('../../assets/sample-product.png')
                        }
                        style={styles.productImage}
                        resizeMode="cover"
                    />
                    <View style={styles.productDetails}>
                        <Text style={styles.productName} numberOfLines={2}>
                            {productName}
                        </Text>
                        {brandName ? (
                            <Text style={styles.brandName}>{brandName}</Text>
                        ) : null}
                        {product.stock === 0 && (
                            <Text style={styles.outOfStock}>Out of Stock</Text>
                        )}
                    </View>
                </TouchableOpacity>

                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.removeButton]}
                        onPress={() => handleRemoveItem(item._id || item.id)}
                    >
                        <Image
                            source={require('../../assets/icons/deleteIcon.png')}
                            style={styles.deleteIcon}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Empty state
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Image
                source={require('../../assets/icons/heart_empty.png')}
                style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptyStateText}>
                Save your favorite items here to easily find them later
            </Text>
            <TouchableOpacity
                style={styles.shopButton}
                onPress={() => router.push('/Home')}
            >
                <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#4CAD73" />
                <Text style={styles.loaderText}>Loading your wishlist...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Image
                        source={require('../../assets/icons/back_icon.png')}
                        style={styles.backIcon}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Wishlist</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Wishlist Content */}
            <FlatList
                data={wishlistItems}
                renderItem={renderWishlistItem}
                keyExtractor={(item) => item._id || item.id || Math.random().toString()}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmptyState}
                refreshing={refreshing}
                onRefresh={fetchWishlist}
            />
        </View>
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
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontFamily: 'Poppins',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E6E6E6',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins',
        fontWeight: '600',
        color: '#000000',
    },
    headerRight: {
        width: 40,
    },
    listContainer: {
        flexGrow: 1,
        padding: 16,
    },
    wishlistItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    productInfo: {
        flex: 1,
        flexDirection: 'row',
        marginRight: 12,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 12,
    },
    productDetails: {
        flex: 1,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 16,
        fontFamily: 'Poppins',
        fontWeight: '500',
        color: '#000000',
        marginBottom: 4,
        lineHeight: 20,
    },
    brandName: {
        fontSize: 14,
        fontFamily: 'Poppins',
        color: '#666',
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 16,
        fontFamily: 'Poppins',
        fontWeight: '600',
        color: '#4CAD73',
    },
    outOfStock: {
        fontSize: 12,
        fontFamily: 'Poppins',
        color: '#FF4444',
        marginTop: 4,
    },
    actionButtons: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    moveToCartButton: {
        backgroundColor: '#4CAD73',
    },
    removeButton: {
        backgroundColor: 'transparent',
        padding: 4,
        minWidth: 'auto',
    },
    actionButtonText: {
        fontSize: 12,
        fontFamily: 'Poppins',
        fontWeight: '500',
        color: '#FFFFFF',
    },
    disabledButtonText: {
        color: '#AFAFAF',
    },
    deleteIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: '#FF4444',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyStateIcon: {
        width: 80,
        height: 80,
        resizeMode: 'contain',
        marginBottom: 24,
        tintColor: '#CCCCCC',
    },
    emptyStateTitle: {
        fontSize: 20,
        fontFamily: 'Poppins',
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        fontFamily: 'Poppins',
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    shopButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    shopButtonText: {
        fontSize: 16,
        fontFamily: 'Poppins',
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
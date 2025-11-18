import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions} from 'react-native';
import PromoCard from "../../components/screens/PromoCard";
import CategoriesSection from "../../components/screens/CategoriesSection";
import SearchBar from "../../components/screens/SearchBar";
import RelatedProducts from "../../components/screens/RelatedProducts";
import {useRouter} from "expo-router";
import ProductsScreen from "./ProductsScreen";
import AsyncStorage from '@react-native-async-storage/async-storage';

const {width} = Dimensions.get('window');

export default function HomeScreen() {
    const router = useRouter();
    const [userAddress, setUserAddress] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('');

    useEffect(() => {
        loadUserAddress();
    }, []);

    const loadUserAddress = async () => {
        try {
            // Try to get saved address from AsyncStorage
            const savedAddress = await AsyncStorage.getItem('userAddress');
            if (savedAddress) {
                setUserAddress(savedAddress);
            } else {
                // Set default address
                const defaultAddress = '123 Main Street, Downtown City';
                setUserAddress(defaultAddress);
                await AsyncStorage.setItem('userAddress', defaultAddress);
            }

            // Set random delivery time between 20-45 minutes
            const randomTime = Math.floor(Math.random() * 26) + 20;
            setDeliveryTime(`${randomTime}-${randomTime + 5} min`);
        } catch (error) {
            console.log('Error loading address:', error);
            setUserAddress('Set your delivery address');
        }
    };

    function handleNotification() {
        router.replace("/screens/NotificationScreen");
    }

    function handleAddressPress() {
        router.push("/screens/AddressScreen");
    }


    // Function to truncate long addresses
    const truncateAddress = (address, maxLength = 28) => {
        if (address.length > maxLength) {
            return address.substring(0, maxLength) + '...';
        }
        return address;
    };

    // Featured products data
    const featuredProducts = [
        {
            id: 1,
            name: 'Organic Potting Mix',
            price: '₹299',
            originalPrice: '₹399',
            discount: '25% OFF',
            image: require('../../assets/Rectangle 24904.png'),
            rating: 4.5,
            deliveryTime: '10 min'
        },
        {
            id: 2,
            name: 'Gardening Tool Set',
            price: '₹599',
            originalPrice: '₹799',
            discount: '30% OFF',
            image: require('../../assets/Rectangle 24904.png'),
            rating: 4.8,
            deliveryTime: '15 min'
        },
        {
            id: 3,
            name: 'Watering Can',
            price: '₹199',
            originalPrice: '₹249',
            discount: '20% OFF',
            image: require('../../assets/Rectangle 24904.png'),
            rating: 4.3,
            deliveryTime: '8 min'
        },
        {
            id: 4,
            name: 'Plant Fertilizer',
            price: '₹149',
            originalPrice: '₹199',
            discount: '25% OFF',
            image: require('../../assets/Rectangle 24904.png'),
            rating: 4.6,
            deliveryTime: '12 min'
        },
        {
            id: 5,
            name: 'Gardening Gloves',
            price: '₹99',
            originalPrice: '₹149',
            discount: '33% OFF',
            image: require('../../assets/Rectangle 24904.png'),
            rating: 4.4,
            deliveryTime: '5 min'
        }
    ];

    const renderFeaturedCard = (item) => (
        <TouchableOpacity key={item.id} style={styles.featuredCard}>
            <View style={styles.featuredImageContainer}>
                <Image
                    source={item.image}
                    style={styles.featuredImage}
                    resizeMode="cover"
                />
                <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{item.discount}</Text>
                </View>
                <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>{item.rating} ★</Text>
                </View>
            </View>
            <View style={styles.featuredContent}>
                <Text style={styles.featuredName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.priceContainer}>
                    <Text style={styles.currentPrice}>{item.price}</Text>
                    <Text style={styles.originalPrice}>{item.originalPrice}</Text>
                </View>
                <View style={styles.deliveryInfo}>
                    <Image
                        source={require("../../assets/icons/info.png")}
                        style={styles.smallClockIcon}
                    />
                    <Text style={styles.deliveryInfoText}>{item.deliveryTime}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Top Bar - Blinkit Style */}
            <View style={styles.topBar}>


                {/* Center: Address Section */}
                <TouchableOpacity onPress={handleAddressPress} style={styles.addressSection}>
                    <View style={styles.addressTopRow}>
                        <Text style={styles.deliveryText}>Delivery</Text>
                        <Image
                            source={require("../../assets/icons/down_arrow.png")}
                            style={styles.downArrow}
                        />
                    </View>
                    <View style={styles.addressBottomRow}>
                        <Text style={styles.addressText} numberOfLines={1}>
                            {truncateAddress(userAddress)}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Right: Notification Bell */}
                <TouchableOpacity onPress={handleNotification} style={styles.notificationButton}>
                    <View style={styles.bellContainer}>
                        <Image
                            source={require("../../assets/icons/notification.png")}
                            style={styles.bellIcon}
                        />
                        <View style={styles.notificationDot}/>
                    </View>
                </TouchableOpacity>


                {/* Delivery Time & Offers Strip */}
                <View style={styles.infoStrip}>
                    <View style={styles.deliveryTime}>
                        <Text style={styles.deliveryTimeText}>{deliveryTime}</Text>
                    </View>
                    <View style={styles.offersBadge}>
                        <Text style={styles.offersText}>OFFERS</Text>
                    </View>
                </View>
            </View>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    <SearchBar/>
                    <PromoCard/>

                    {/* Featured This Week Section */}
                    <View style={styles.featuredSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Featured this week</Text>
                            <TouchableOpacity>
                                <Text style={styles.seeAllText}>See all</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.featuredScrollContent}
                        >
                            {featuredProducts.map(renderFeaturedCard)}
                        </ScrollView>
                    </View>

                    <CategoriesSection/>
                    <ProductsScreen/>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    menuButton: {
        padding: 8,
    },
    menuIcon: {
        width: 24,
        height: 24,
        tintColor: '#FF7E8B',
    },
    addressSection: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    addressTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    deliveryText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FF7E8B',
        marginRight: 4,
    },
    downArrow: {
        width: 12,
        height: 12,
        tintColor: '#FF7E8B',
    },
    addressBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        textAlign: 'center',
        maxWidth: width * 0.5,
    },
    notificationButton: {
        padding: 8,
    },
    bellContainer: {
        position: 'relative',
    },
    bellIcon: {
        width: 24,
        height: 24,
        tintColor: '#FF7E8B',
    },
    notificationDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        backgroundColor: '#FF4757',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    infoStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#FFF9FA',
        borderBottomWidth: 1,
        borderBottomColor: '#FFE6E9',
    },
    deliveryTime: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deliveryTimeText: {
        fontSize: 12,
        color: '#666666',
        fontWeight: '500',
    },
    offersBadge: {
        backgroundColor: '#FF7E8B',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    offersText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    content: {
        padding: 16,
    },

    // Featured Section Styles
    featuredSection: {
        marginTop: 24,
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1B1B1B',
    },
    seeAllText: {
        fontSize: 14,
        color: '#4CAD73',
        fontWeight: '500',
    },
    featuredScrollContent: {
        paddingRight: 16,
    },
    featuredCard: {
        width: 140, // Smaller width
        height: 240, // Taller height
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginRight: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    featuredImageContainer: {
        height: 140,
        position: 'relative',
        backgroundColor: '#F8F8F8',
    },
    featuredImage: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#FF4757',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    discountBadgeText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    ratingContainer: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    ratingText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    featuredContent: {
        padding: 12,
        flex: 1,
        justifyContent: 'space-between',
    },
    featuredName: {
        fontSize: 13,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 6,
        lineHeight: 16,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    currentPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B1B1B',
        marginRight: 6,
    },
    originalPrice: {
        fontSize: 12,
        color: '#999999',
        textDecorationLine: 'line-through',
    },
    deliveryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    smallClockIcon: {
        width: 12,
        height: 12,
        tintColor: '#666666',
        marginRight: 4,
    },
    deliveryInfoText: {
        fontSize: 11,
        color: '#666666',
    },

    // Keep your existing styles for other components
    heading: {
        fontSize: 24,
        fontWeight: '500',
        color: '#1B1B1B',
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    bellIconOld: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    bellDotOuter: {
        position: 'absolute',
        width: 7,
        height: 7,
        left: 18,
        top: 3,
        backgroundColor: '#FFC4C4',
        borderRadius: 4,
    },
    bellDotInner: {
        width: 5,
        height: 5,
        backgroundColor: '#DC1010',
        borderRadius: 3,
        alignSelf: 'center',
    },
    sliderBox: {
        marginTop: 30,
        height: 160,
        borderRadius: 14,
        backgroundColor: '#4CAD73',
        overflow: 'hidden',
        position: 'relative',
    },
    sliderCircle: {
        position: 'absolute',
        width: 200,
        height: 200,
        backgroundColor: '#FFE082',
        borderRadius: 100,
        top: -40,
        right: -40,
    },
    sliderImage: {
        width: 250,
        height: 150,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    sliderTextBox: {
        position: 'absolute',
        left: 18,
        top: 30,
    },
    discountText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    percentText: {
        fontSize: 42,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    subText: {
        fontSize: 11,
        color: '#FFFFFF',
        marginTop: 4,
    },
    detailButton: {
        backgroundColor: '#FFE082',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 100,
        marginTop: 8,
    },
    detailText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#333',
    },
    categoriesSection: {
        marginTop: 30,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1B1B1B',
    },
    showAll: {
        fontSize: 12,
        color: '#4CAD73',
    },
    categoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    categoryCardGreen: {
        width: 180,
        height: 150,
        backgroundColor: '#EDF8E7',
        borderRadius: 12,
        justifyContent: 'flex-start',
        padding: 16,
    },
    categoryNameGreen: {
        color: '#477230',
        fontWeight: '500',
        fontSize: 16,
    },
    categoryCardOrange: {
        width: 180,
        height: 150,
        backgroundColor: '#FFF3E5',
        borderRadius: 12,
        justifyContent: 'flex-start',
        padding: 16,
    },
    categoryNameOrange: {
        color: '#875214',
        fontWeight: '500',
        fontSize: 16,
    },
    categoryCardBlue: {
        width: 180,
        height: 150,
        backgroundColor: '#E4F6F6',
        borderRadius: 12,
        justifyContent: 'flex-start',
        padding: 16,
    },
    categoryNameBlue: {
        color: '#3C5E5E',
        fontWeight: '500',
        fontSize: 16,
    },
    categoryCardYellow: {
        width: 180,
        height: 150,
        backgroundColor: '#FEF7E5',
        borderRadius: 12,
        justifyContent: 'flex-start',
        padding: 16,
    },
    categoryNameYellow: {
        color: '#705615',
        fontWeight: '500',
        fontSize: 16,
    },
});
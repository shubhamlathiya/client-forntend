import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    Image,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Platform,
    ActivityIndicator,
} from 'react-native';
import {useRouter} from 'expo-router';
import {getCategories} from "../../api/catalogApi";
import {API_BASE_URL} from "../../config/apiConfig";

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

// Check if device has notch (iPhone X and above)
const hasNotch = Platform.OS === 'ios' && (screenHeight >= 812 || screenWidth >= 812);

// Safe area insets for different devices
const getSafeAreaInsets = () => {
    if (Platform.OS === 'ios') {
        if (hasNotch) {
            return {
                top: 44, // Status bar + notch area
                bottom: 34 // Home indicator area
            };
        }
        return {
            top: 20, // Regular status bar
            bottom: 0
        };
    }
    // Android
    return {
        top: StatusBar.currentHeight || 25,
        bottom: 0
    };
};

const safeAreaInsets = getSafeAreaInsets();

// Responsive size calculator with constraints
const RF = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    const normalizedSize = size * Math.min(scale, 1.5); // Max 1.5x scaling for tablets
    return Math.round(normalizedSize);
};

// Check if device is tablet
const isTablet = screenWidth >= 768;

export default function AllCategoriesScreen() {
    const router = useRouter();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const res = await getCategories();

            const data = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);

            if (!Array.isArray(data) || !data.length) {
                setCategories([]);
                return;
            }

            // Separate parents and subcategories
            const parents = data.filter(item => item.parentId === null);
            const children = data.filter(item => item.parentId !== null);

            const finalList = parents.map(parent => {
                const subcats = children.filter(c => c.parentId === parent._id);

                // Add parent as a subcategory entry
                const parentAsSub = {
                    _id: parent._id,
                    name: parent.name,
                    image: parent.image || null,
                    parentId: null
                };

                // If child subcategories exist → include parent + children
                const finalSubcategories =
                    subcats.length > 0
                        ? [
                            parentAsSub,
                            ...subcats.map(s => ({
                                _id: s._id,
                                name: s.name,
                                image: s.image || null,
                                parentId: s.parentId
                            }))
                        ]
                        : [parentAsSub];

                return {
                    ...parent,
                    subcategories: finalSubcategories
                };
            });

            setCategories(finalList);

        } catch (err) {
            console.error("Category fetch error:", err);
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryPress = (item) => {
        router.push({
            pathname: '/screens/ProductsScreen',
            params: {
                selectedCategory: item._id,
                categoryName: item.name
            }
        });
    };

    // Calculate number of columns based on screen width
    const getColumnsCount = () => {
        if (screenWidth >= 1024) return 6; // Large tablets/desktop
        if (screenWidth >= 768) return 5;  // Tablets
        if (screenWidth >= 414) return 4;  // Large phones
        if (screenWidth >= 375) return 4;  // Medium phones
        return 3; // Small phones
    };

    const columnsCount = getColumnsCount();

    const renderSubCategoryItem = ({ item }) => {
        const imageSource = item?.image
            ? { uri: `${API_BASE_URL}${item.image}` }
            : require('../../assets/Rectangle 24904.png');

        // Calculate dynamic card width with proper spacing
        const totalHorizontalPadding = RF(10) * 2; // Container padding
        const totalGapSpacing = RF(5) * (columnsCount - 1); // Gaps between cards
        const availableWidth = screenWidth - totalHorizontalPadding - totalGapSpacing;
        const cardWidth = availableWidth / columnsCount;

        const imageSize = RF(isTablet ? 70 : 50);
        const imageContainerSize = RF(isTablet ? 90 : 78);

        return (
            <Pressable
                style={[
                    styles.categoryCard,
                    {
                        width: cardWidth,
                        marginBottom: RF(15),
                    }
                ]}
                onPress={() => handleCategoryPress(item)}
                activeOpacity={0.7}
            >
                <View style={[
                    styles.categoryImageContainer,
                    {
                        width: imageContainerSize,
                        height: imageContainerSize,
                        borderRadius: RF(10),
                        marginBottom: RF(6),
                    }
                ]}>
                    <Image
                        source={imageSource}
                        style={{
                            width: imageSize,
                            height: imageSize,
                        }}
                        resizeMode="contain"
                    />
                </View>

                <Text
                    style={[
                        styles.categoryName,
                        {
                            fontSize: RF(10),
                            lineHeight: RF(14),
                        }
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                >
                    {item.name}
                </Text>
            </Pressable>
        );
    };

    const getSubcategoryList = (parent) => {
        if (Array.isArray(parent.subcategories) && parent.subcategories.length > 0) {
            return parent.subcategories;
        }

        // If no subcategories → use parent as one subcategory tile
        return [{
            _id: parent._id,
            name: parent.name,
            image: parent.image || null
        }];
    };

    // Loading state
    if (loading) {
        return (
            <View style={styles.safeContainer}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4CAD73" />
                        <Text style={styles.loadingText}>Loading categories...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // Empty state
    if (!categories.length) {
        return (
            <View style={styles.safeContainer}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>
                <SafeAreaView style={styles.container}>
                    <View style={styles.headerPlaceholder} />
                    <View style={styles.emptyContainer}>
                        <Image
                            source={require('../../assets/icons/empty-box.png')}
                            style={styles.emptyIcon}
                        />
                        <Text style={styles.emptyText}>No categories found</Text>
                        <Pressable
                            style={styles.retryButton}
                            onPress={fetchCategories}
                        >
                            <Text style={styles.retryText}>Try Again</Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.safeContainer}>
            <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>

            {/* Header with Safe Area */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={[
                    styles.header,
                    {
                        height: RF(60) + safeAreaInsets.top,
                        paddingTop: safeAreaInsets.top,
                    }
                ]}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                        <Image
                            source={require('../../assets/icons/back_icon.png')}
                            style={[
                                styles.backIcon,
                                {
                                    width: RF(24),
                                    height: RF(24),
                                }
                            ]}
                        />
                    </Pressable>

                    <Text style={[
                        styles.headerTitle,
                        {
                            fontSize: RF(18),
                        }
                    ]}>All Categories</Text>

                    {/* Placeholder to balance the layout */}
                    <View style={[
                        styles.headerPlaceholder,
                        {width: RF(40)}
                    ]}/>
                </View>
            </SafeAreaView>

            {/* Main Content with bottom safe area */}
            <SafeAreaView style={styles.contentSafeArea}>
                <View style={styles.mainContent}>
                    <FlatList
                        data={categories}
                        keyExtractor={(item) => item._id}
                        renderItem={({item}) => {
                            const subList = getSubcategoryList(item);

                            return (
                                <View style={[
                                    styles.categorySection,
                                    {
                                        marginBottom: RF(20),
                                    }
                                ]}>
                                    <View style={[
                                        styles.sectionTitleContainer,
                                        {
                                            paddingHorizontal: RF(10),
                                            paddingTop: RF(10),
                                            paddingBottom: RF(10),
                                        }
                                    ]}>
                                        <Text style={[
                                            styles.sectionTitle,
                                            {
                                                fontSize: RF(14),
                                                lineHeight: RF(21),
                                            }
                                        ]}>{item.name}</Text>
                                    </View>

                                    <FlatList
                                        data={subList}
                                        numColumns={columnsCount}
                                        keyExtractor={(sub) => sub._id}
                                        renderItem={renderSubCategoryItem}
                                        contentContainerStyle={[
                                            styles.categoriesGrid,
                                            {
                                                paddingHorizontal: RF(5),
                                            }
                                        ]}
                                        scrollEnabled={false}
                                        columnWrapperStyle={styles.columnWrapper}
                                    />
                                </View>
                            );
                        }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.mainListContent,
                            {
                                paddingTop: RF(10),
                                paddingBottom: safeAreaInsets.bottom + RF(20), // Add bottom safe area
                            }
                        ]}
                        ListFooterComponent={<View style={{height: RF(20)}} />}
                    />
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#4CAD73', // Header color
    },
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    headerSafeArea: {
        backgroundColor: '#4CAD73',
    },
    contentSafeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(16),
    },
    backButton: {
        padding: RF(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        tintColor: '#FFFFFF'
    },
    headerTitle: {
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        flex: 1,
    },
    headerPlaceholder: {
        opacity: 0,
    },
    mainContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    sectionTitleContainer: {
        backgroundColor: '#FFFFFF',
    },
    sectionTitle: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700',
        color: '#000',
        letterSpacing: -0.3,
    },
    categoriesGrid: {
        justifyContent: 'space-between',
    },
    columnWrapper: {
        justifyContent: 'space-between',
        paddingHorizontal: RF(5),
    },
    categoryCard: {
        alignItems: 'center',
    },
    categoryImageContainer: {
        backgroundColor: '#D9EBEB',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    categoryName: {
        fontFamily: 'Poppins-Regular',
        fontWeight: '400',
        textAlign: 'center',
        color: '#000000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        fontSize: RF(16),
        fontFamily: 'Poppins-Medium',
        color: '#666',
        marginTop: RF(10),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingBottom: RF(100), // Adjust for bottom navigation if needed
    },
    emptyIcon: {
        width: RF(100),
        height: RF(100),
        marginBottom: RF(20),
        opacity: 0.5,
    },
    emptyText: {
        fontSize: RF(16),
        fontFamily: 'Poppins-Medium',
        color: '#666',
        marginBottom: RF(20),
    },
    retryButton: {
        backgroundColor: '#4CAD73',
        paddingHorizontal: RF(20),
        paddingVertical: RF(10),
        borderRadius: RF(8),
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: RF(14),
        fontFamily: 'Poppins-Medium',
    },
    mainListContent: {
        flexGrow: 1,
    },
});
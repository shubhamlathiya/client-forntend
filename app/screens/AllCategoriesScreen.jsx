import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Platform,
} from 'react-native';
import {useRouter} from 'expo-router';
import {getCategories} from "../../api/catalogApi";
import {API_BASE_URL} from "../../config/apiConfig";

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

// Responsive size calculator
const responsiveSize = (size) => {
    const scale = screenWidth / 375; // 375 is standard iPhone width
    return Math.round(size * scale);
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
            pathname: '/screens/AllProductsScreen',
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
        if (screenWidth >= 375) return 3;  // Medium phones
        return 3; // Small phones
    };

    const columnsCount = getColumnsCount();

    const renderSubCategoryItem = ({ item }) => {
        const imageSource = item?.image
            ? { uri: `${API_BASE_URL}${item.image}` }
            : require('../../assets/Rectangle 24904.png');

        const cardWidth = (screenWidth - responsiveSize(40)) / columnsCount;
        const imageSize = responsiveSize(isTablet ? 70 : 50);
        const imageContainerSize = responsiveSize(isTablet ? 90 : 78);

        return (
            <TouchableOpacity
                style={[
                    styles.categoryCard,
                    {
                        width: cardWidth,
                        marginHorizontal: responsiveSize(4.5),
                    }
                ]}
                onPress={() => handleCategoryPress(item)}
            >
                <View style={[
                    styles.categoryImageContainer,
                    {
                        width: imageContainerSize,
                        height: imageContainerSize,
                        borderRadius: responsiveSize(10),
                        marginBottom: responsiveSize(6),
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
                            fontSize: responsiveSize(10),
                            width: cardWidth - responsiveSize(4),
                        }
                    ]}
                    numberOfLines={2}
                >
                    {item.name}
                </Text>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading categories...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!categories.length) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar backgroundColor="#4CAD73" barStyle="light-content"/>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Categories not found</Text>
                </View>
            </SafeAreaView>
        );
    }

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

    return (
        <SafeAreaView style={{flex: 1}}>
            <View style={styles.container}>

                {/* HEADER */}
                <View style={[
                    styles.header,
                    {
                        height: responsiveSize(60),
                        paddingHorizontal: responsiveSize(16),
                        paddingVertical: responsiveSize(12),
                    }
                ]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                            source={require('../../assets/icons/back_icon.png')}
                            style={[
                                styles.backIcon,
                                {
                                    width: responsiveSize(24),
                                    height: responsiveSize(24),
                                }
                            ]}
                        />
                    </TouchableOpacity>

                    <Text style={[
                        styles.headerTitle,
                        {
                            fontSize: responsiveSize(18),
                        }
                    ]}>All Categories</Text>
                    <View style={[
                        styles.headerPlaceholder,
                        {width: responsiveSize(40)}
                    ]}/>
                </View>

                {/* MAIN CONTENT */}
                <View style={[
                    styles.mainContent,
                    {
                        padding: responsiveSize(10),
                    }
                ]}>
                    {/* LIST PARENT + CHILDREN */}
                    <FlatList
                        data={categories}
                        keyExtractor={(item) => item._id}
                        renderItem={({item}) => {
                            const subList = getSubcategoryList(item);

                            return (
                                <View style={[
                                    styles.categorySection,
                                    {
                                        marginBottom: responsiveSize(20),
                                    }
                                ]}>
                                    <View style={[
                                        styles.sectionTitleContainer,
                                        {
                                            paddingHorizontal: responsiveSize(5),
                                            paddingTop: responsiveSize(10),
                                            paddingBottom: responsiveSize(10),
                                        }
                                    ]}>
                                        <Text style={[
                                            styles.sectionTitle,
                                            {
                                                fontSize: responsiveSize(14),
                                                lineHeight: responsiveSize(21),
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
                                                paddingHorizontal: responsiveSize(5),
                                            }
                                        ]}
                                        scrollEnabled={false}
                                    />
                                </View>
                            );
                        }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.mainListContent,
                            {
                                paddingBottom: responsiveSize(20),
                            }
                        ]}
                    />
                </View>
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
        backgroundColor: '#4CAD73',
    },
    backButton: {
        padding: responsiveSize(8)
    },
    backIcon: {
        tintColor: '#FFFFFF'
    },
    headerTitle: {
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
    },
    mainContent: {
        flex: 1,
    },
    sectionTitle: {
        fontFamily: 'Poppins',
        fontWeight: '700',
        color: '#000',
        letterSpacing: -0.3,
    },
    categoryCard: {
        alignItems: 'center',
        marginBottom: responsiveSize(15),
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
        fontFamily: 'Poppins',
        fontWeight: '400',
        textAlign: 'center',
        letterSpacing: -0.3,
        color: '#000000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        fontSize: responsiveSize(16),
        fontFamily: 'Poppins-Medium',
        color: '#666'
    }
});
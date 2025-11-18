import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import SearchBar from "../../components/screens/SearchBar";
import Categories from "../../components/screens/Categories";
import ProductsScreen from "./ProductsScreen";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function CategoriesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedCategory, setSelectedCategory] = useState(params.categoryId || '');
    const [searchQuery, setSearchQuery] = useState('');

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Home');
        }
    };

    const handleCategorySelect = (categoryId) => {
        setSelectedCategory(categoryId);
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        setSelectedCategory(''); // Clear category filter when searching
    };

    const clearFilters = () => {
        setSelectedCategory('');
        setSearchQuery('');
    };

    return (
        <View style={styles.container}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.iconBox}
                    />
                </TouchableOpacity>
                <Text style={styles.heading}>Categories</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <View style={{ padding: 20 }}>
                    <SearchBar onSearch={handleSearch} />

                    <Categories
                        onCategorySelect={handleCategorySelect}
                        selectedCategory={selectedCategory}
                    />

                    <ProductsScreen
                        selectedCategory={selectedCategory}
                        searchQuery={searchQuery}
                    />
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
        padding: 20,
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    heading: {
        fontSize: 24,
        fontWeight: '500',
        color: '#1B1B1B',
        alignItems: 'center',
        marginLeft: 20
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    activeFilters: {
        marginTop: 16,
        marginBottom: 8,
    },
    filtersTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1B1B1B',
        marginBottom: 8,
    },
    filterChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F8F0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    filterChipText: {
        fontSize: 12,
        color: '#4CAD73',
        fontWeight: '500',
    },
    filterRemove: {
        fontSize: 16,
        color: '#4CAD73',
        fontWeight: 'bold',
    },
    clearAll: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    clearAllText: {
        fontSize: 12,
        color: '#FF6B6B',
        fontWeight: '500',
    },
});
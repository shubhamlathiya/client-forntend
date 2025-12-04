import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { getCategories } from "../../api/catalogApi";
import { API_BASE_URL } from "../../config/apiConfig";

const palette = [
    { bgColor: "rgba(234, 238, 226, 0.5)" },
    { bgColor: "rgba(247, 226, 211, 0.5)" },
    { bgColor: "rgba(247, 211, 234, 0.5)" },
    { bgColor: "rgba(211, 247, 223, 0.5)" },
    { bgColor: "rgba(247, 228, 211, 0.5)" },
];

const cleanUrl = (u) => (typeof u === "string" ? u.replace(/[`"']/g, "").trim() : "");

const Categories = ({ onCategorySelect, selectedCategory }) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchCategories = async () => {
            try {
                setLoading(true);
                const res = await getCategories();
                if (res?.success && Array.isArray(res.data)) {
                    if (mounted) setCategories(res.data);
                } else {
                    console.error("Categories API returned unexpected shape", res);
                }
            } catch (err) {
                console.error("Error fetching categories", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchCategories();
        return () => { mounted = false; };
    }, []);

    const handleCategoryPress = (categoryId) => {
        if (onCategorySelect) {
            // Toggle category selection - if same category clicked again, deselect it
            const newCategoryId = selectedCategory === categoryId ? '' : categoryId;
            onCategorySelect(newCategoryId);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Categories</Text>
                <Pressable onPress={() => onCategorySelect && onCategorySelect('')}>
                    <Text style={styles.showAll}>Show All</Text>
                </Pressable>
            </View>

            {/* Category List */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#4CAD73" style={{ marginTop: 16 }} />
                ) : (
                    categories.map((cat, index) => {
                        const { bgColor } = palette[index % palette.length];
                        const isSelected = selectedCategory === cat?._id;
                        const borderColor = isSelected ? "#4CAD73" : "transparent";
                        const url = cleanUrl(cat?.image || cat?.icon);
                        const imageSource = url ? { uri: `${API_BASE_URL}${url}` } : require("../../assets/icons/fruit.png");

                        return (
                            <Pressable
                                key={cat?._id || index}
                                style={styles.categoryItem}
                                onPress={() => handleCategoryPress(cat?._id)}
                            >
                                <View
                                    style={[
                                        styles.imageContainer,
                                        {
                                            backgroundColor: bgColor,
                                            borderColor,
                                            borderWidth: isSelected ? 2 : 0,
                                        },
                                    ]}
                                >
                                    <Image source={imageSource} style={styles.image} resizeMode="contain" />
                                </View>
                                <Text style={[
                                    styles.categoryName,
                                    isSelected && styles.selectedCategoryName
                                ]}>
                                    {cat?.name || "Category"}
                                </Text>
                                {isSelected && <View style={styles.activeDot} />}
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 388,
        alignSelf: "center",
        flexDirection: "column",
        marginTop: 30,
        padding: 20
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1B1B1B',
    },
    showAll: {
        fontFamily: "Poppins_400Regular",
        fontSize: 12,
        color: "#4CAD73",
    },
    listContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    categoryItem: {
        alignItems: "center",
        width: 69,
        height: 82,
        marginRight: 16,
        marginTop: 16,
        position: 'relative',
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: 15,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#E2E2E2",
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 2,
    },
    image: {
        width: 44,
        height: 36,
    },
    categoryName: {
        marginTop: 4,
        fontFamily: "Poppins-Medium",
        fontSize: 12,
        color: "#1B1B1B",
        textAlign: "center",
    },
    selectedCategoryName: {
        color: "#4CAD73",
        fontWeight: "600",
    },
    activeDot: {
        position: 'absolute',
        top: -2,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAD73',
    },
});

export default Categories;
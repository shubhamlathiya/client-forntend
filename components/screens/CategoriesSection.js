import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

import {useRouter} from "expo-router";
import { getCategories } from "../../api/catalogApi";
import {API_BASE_URL} from "../../config/apiConfig";


export default function CategoriesSection() {
    const router = useRouter();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    const palette = [
        { bgColor: "#EDF8E7", textColor: "#477230" },
        { bgColor: "#FFF3E5", textColor: "#875214" },
        { bgColor: "#E4F6F6", textColor: "#3C5E5E" },
        { bgColor: "#FEF7E5", textColor: "#705615" },
    ];

    const cleanUrl = (u) => (typeof u === "string" ? u.replace(/[`"']/g, "").trim() : "");

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

    function handleCategoriesShowAll() {

        router.replace("/screens/CategoriesScreen");
    }
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Categories</Text>
                <TouchableOpacity>
                    <Text style={styles.showAll} onPress={handleCategoriesShowAll}>Show All</Text>
                </TouchableOpacity>
            </View>

            {/* Categories Grid */}
            <View style={styles.grid}>
                {loading ? (
                    <ActivityIndicator size="small" color="#4CAD73" style={{ marginTop: 16 }} />
                ) : (
                    (categories.slice(0, 4)).map((cat, index) => {
                        const { bgColor, textColor } = palette[index % palette.length];
                        const url = cleanUrl(cat?.image || cat?.icon);

                        const imageSource = url ? { uri: `${API_BASE_URL}${url}` } : require("../../assets/icons/fruit.png");
                        return (
                            <View key={cat?._id || index} style={[styles.card, { backgroundColor: bgColor }]}>
                                <Text style={[styles.cardTitle, { color: textColor }]}>{cat?.name || "Category"}</Text>
                                <Image source={imageSource} style={styles.image} resizeMode="contain" />
                            </View>
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 30,
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
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: {
        width: "48%",
        height: 150,
        borderRadius: 12,
        padding: 16,
        position: "relative",
        overflow: "hidden",
        marginTop: 16,
    },
    cardTitle: {
        fontFamily: "Poppins_500Medium",
        fontSize: 16,
        fontWeight : "bold"
    },
    image: {
        width: 120,
        height: 100,
        position: "absolute",
        bottom: 0,
        right: 0,
    },
});

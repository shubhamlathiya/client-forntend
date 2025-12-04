import React from "react";
import {View, Text, Image, StyleSheet, Pressable} from "react-native";
import {LinearGradient} from "expo-linear-gradient";

export default function PromoCard() {
    return (
        <View style={styles.container}>
            {/* Gradient background */}
            <LinearGradient
                colors={["#60DEB1", "#4CAD73"]}
                start={{x: 0, y: 0}}
                end={{x: 0, y: 1}}
                style={styles.card}
            >
                {/* Yellow circle */}
                <View style={styles.circle}/>

                {/* Text section */}
                <View style={styles.textContainer}>
                    <Text style={styles.discountShadow}>Discount</Text>
                    <Text style={styles.discount}>Discount</Text>

                    <Text style={styles.percentShadow}>25%</Text>
                    <Text style={styles.percent}>25%</Text>

                    <Text style={styles.subtitle}>All Vegetables & Fruits</Text>

                    <Pressable style={styles.detailBtn}>
                        <Text style={styles.detailText}>See Detail</Text>
                    </Pressable>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 60,
    },
    card: {
        width: 307,
        height: 163,
        borderRadius: 14,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "flex-start",
        elevation: 10,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: {width: 0, height: 10},
    },
    circle: {
        position: "absolute",
        width: 198,
        height: 198,
        left: 180,
        top: -18,
        backgroundColor: "#FFE082",
        borderRadius: 99,
    },
    fruitImage: {
        position: "absolute",
        width: 258,
        height: 162,
        left: 140,
        top: 0,
    },
    textContainer: {
        position: "absolute",
        left: 18,
        top: 28,
        width: 124,
        height: 113,
    },
    discountShadow: {
        position: "absolute",
        left: 2,
        top: 0,
        fontFamily: "Poppins",
        fontWeight: "600",
        fontSize: 18,
        lineHeight: 10,
        color: "#FFE082",
    },
    discount: {
        position: "absolute",
        left: 0,
        top: 0,
        fontFamily: "Poppins",
        fontWeight: "600",
        fontSize: 18,
        lineHeight: 10,
        color: "#FFFFFF",
    },
    percentShadow: {
        position: "absolute",
        left: 3,
        top: 18,
        fontFamily: "Poppins",
        fontWeight: "600",
        fontSize: 42,
        lineHeight: 40,
        color: "#FFE082",
    },
    percent: {
        position: "absolute",
        left: 0,
        top: 18,
        fontFamily: "Poppins",
        fontWeight: "600",
        fontSize: 42,
        lineHeight: 40,
        color: "#FFFFFF",
    },
    subtitle: {
        position: "absolute",
        top: 70,
        width: 124,
        textAlign: "center",
        fontFamily: "Poppins",
        fontWeight: "500",
        fontSize: 11,
        lineHeight: 16,
        color: "#FFFFFF",
    },
    detailBtn: {
        position: "absolute",
        top: 95,
        alignSelf: "center",
        backgroundColor: "#FFE082",
        borderRadius: 210,
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    detailText: {
        fontFamily: "Poppins",
        fontWeight: "500",
        fontSize: 10,
        color: "#333333",
        textAlign: "center",
    },
});

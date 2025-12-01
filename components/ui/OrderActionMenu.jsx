import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    StyleSheet,
    Animated,
    Dimensions,
    Platform,
    StatusBar,
} from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Notch + Safe Area Handling
const hasNotch = Platform.OS === "ios" && (screenHeight >= 812 || screenWidth >= 812);

const safeAreaInsets = {
    top:
        Platform.OS === "ios"
            ? hasNotch
                ? 44
                : 20
            : StatusBar.currentHeight || 25,
    bottom: Platform.OS === "ios" && hasNotch ? 34 : 0,
};

// Responsive values
const RF = (size) => {
    const scale = screenWidth / 375;
    return Math.round(size * Math.min(scale, 1.4));
};

export default function OrderActionMenu({
                                            visible,
                                            onClose,
                                            onSelect,
                                            order,
                                            isEligibleForReturn,
                                        }) {
    const [slideAnim] = useState(new Animated.Value(300));

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: visible ? 0 : 300,
            duration: 260,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    const getMenuOptions = () => {
        const list = [];

        list.push({
            id: "details",
            label: "View Details",
            color: "#1B1B1B",
        });

        if (isEligibleForReturn) {
            list.push({
                id: "return",
                label: "Return / Replacement",
                color: "#E53935",
            });
        }

        if (order?.status?.toLowerCase() === "shipped") {
            list.push({
                id: "track",
                label: "Track Order",
                color: "#4CAD73",
            });
        }

        return list;
    };

    const menu = getMenuOptions();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            paddingBottom: safeAreaInsets.bottom + RF(20),
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <View style={styles.dragHandle} />

                    <Text style={styles.menuTitle}>Order Actions</Text>

                    <View style={styles.listWrapper}>
                        {menu.map((item) => (
                            <Pressable
                                key={item.id}
                                onPress={() => onSelect(item.id)}
                                style={({ pressed }) => [
                                    styles.listItem,
                                    pressed && styles.listItemPressed,
                                ]}
                            >
                                <Text style={[styles.listLabel, { color: item.color }]}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable
                        onPress={onClose}
                        style={({ pressed }) => [
                            styles.cancelButton,
                            pressed && styles.cancelPressed,
                        ]}
                    >
                        <Text style={styles.cancelText}>Close</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    backdrop: {
        flex: 1,
    },
    sheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingHorizontal: 20,
        paddingTop: 12,
        elevation: 14,
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: "#D0D0D0",
        borderRadius: 3,
        alignSelf: "center",
        marginBottom: 14,
    },
    menuTitle: {
        fontSize: RF(16),
        fontWeight: "600",
        color: "#1B1B1B",
        marginBottom: 16,
        textAlign: "center",
    },

    listWrapper: {
        backgroundColor: "#F7F7F7",
        borderRadius: 12,
        paddingVertical: 4,
        marginBottom: 18,
    },

    listItem: {
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    listItemPressed: {
        backgroundColor: "#EDEDED",
    },
    listLabel: {
        fontSize: RF(15),
        fontWeight: "500",
    },

    cancelButton: {
        alignSelf: "center",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    cancelPressed: {
        backgroundColor: "#F1F1F1",
    },
    cancelText: {
        color: "#4CAD73",
        fontSize: RF(15),
        fontWeight: "600",
    },
});

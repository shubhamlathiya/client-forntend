import AsyncStorage from "@react-native-async-storage/async-storage";
import {useFocusEffect, useRouter} from "expo-router";
import React, {useCallback, useState} from "react";
import {
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
    Share,
    Dimensions,
    ScrollView,
    SafeAreaView
} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {logoutUser} from "../../api/authApi";

const {width, height} = Dimensions.get('window');

// Responsive calculations
const RF = (size) => {
    const scale = width / 375; // 375 is standard iPhone width
    return Math.ceil(size * scale);
};

const RH = (size) => {
    const scale = height / 812; // 812 is standard iPhone height
    return Math.ceil(size * scale);
};

export default function AccountScreen() {
    const router = useRouter();

    const [hideSensitive, setHideSensitive] = useState(false);
    const [user, setUser] = useState(null);
    const [loggingOut, setLoggingOut] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const loadUser = async () => {
                try {
                    const stored = await AsyncStorage.getItem("userData");
                    console.log("Stored User →", stored);

                    if (stored) {
                        setUser(JSON.parse(stored));
                    } else {
                        setUser({
                            name: "Lathiya Shubham",
                            phone: "7041138931",
                            dob: "18 Mar 2004",
                        });
                    }
                } catch (err) {
                    console.log("Failed to read AsyncStorage:", err);
                    setUser({
                        name: "Lathiya Shubham",
                        phone: "7041138931",
                        dob: "18 Mar 2004",
                    });
                }
            };

            loadUser();
        }, [])
    );

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);

        try {
            await logoutUser();
            router.replace("/screens/LoginScreen");
            setLoggingOut(false);

        } catch (e) {
            console.error("Logout failed", e);
        } finally {
            setLoggingOut(false);
        }
    };

    const handleShareApp = async () => {
        try {
            await Share.share({
                message: "Check out this app! Download now.",
            });
        } catch (error) {
            console.log("Share error:", error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFE59A"/>

            {/* Fixed Header */}
            <LinearGradient colors={["#FFE59A", "#FFD56C"]} style={styles.header}>
                {/* Top Row with Back Button and Profile Text */}
                <View style={styles.topHeaderRow}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>

                    <Text style={styles.profileText}>
                        Profile
                    </Text>

                    <View style={styles.placeholder} />
                </View>

                {/* Avatar */}
                <View style={styles.avatarWrapper}>
                    <Image
                        source={require("../../assets/icons/user-avatar.png")}
                        style={styles.avatar}
                    />
                </View>

                {/* User Name */}
                <Text
                    style={styles.userName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    {user?.name || "Guest User"}
                </Text>

                {/* Info Row */}
                <View style={styles.infoRow}>
                    <Text style={styles.infoText} numberOfLines={1}>
                        {user?.phone || "No phone"}
                    </Text>
                    <Text style={styles.infoText} numberOfLines={1}>
                        {user?.dob || "Not set"}
                    </Text>
                </View>

                {/* Top Buttons */}
                <View style={styles.topButtonRow}>
                    <TouchableOpacity
                        style={styles.topButton}
                        onPress={() => router.push("/screens/MyOrderScreen")}
                    >
                        <Image
                            source={require("../../assets/icons/empty-box.png")}
                            style={styles.topButtonIcon}
                        />
                        <Text style={styles.topButtonLabel} numberOfLines={2}>
                            Your orders
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.topButton} onPress={()=> router.push("/screens/NeedHelpScreen")}>
                        <Image
                            source={require("../../assets/icons/help.png")}
                            style={styles.topButtonIcon}
                        />
                        <Text style={styles.topButtonLabel} numberOfLines={2}>
                            Need help?
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
            >
                {/* APPEARANCE ROW */}
                <View style={styles.smallCard}>
                    <Text style={styles.smallCardLabel}>Appearance</Text>
                    <View style={styles.smallCardRight}>
                        <Text style={styles.smallValue}>LIGHT</Text>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.smallArrow}
                        />
                    </View>
                </View>

                {/* Your Information Card - Now scrollable within this card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Your information</Text>

                    {/* Scrollable menu items inside the card */}
                    <ScrollView
                        style={styles.menuScroll}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                    >
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => router.push("/screens/AddressListScreen")}
                        >
                            <View style={styles.leftRow}>
                                <Image
                                    source={require("../../assets/icons/address-book.png")}
                                    style={styles.menuIcon}
                                />
                                <Text style={styles.menuLabel}>Address book</Text>
                            </View>
                            <Image
                                source={require("../../assets/icons/right-arrow.png")}
                                style={styles.arrowIcon}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => router.push('/screens/WishlistScreen')}
                        >
                            <View style={styles.leftRow}>
                                <Image
                                    source={require("../../assets/icons/heart_empty.png")}
                                    style={styles.menuIcon}
                                />
                                <Text style={styles.menuLabel}>Your wishlist</Text>
                            </View>
                            <Image
                                source={require("../../assets/icons/right-arrow.png")}
                                style={styles.arrowIcon}
                            />
                        </TouchableOpacity>

                        {/* Add more menu items here that will be scrollable */}
                        {/*<TouchableOpacity*/}
                        {/*    style={styles.menuItem}*/}
                        {/*    onPress={() => console.log("Settings pressed")}*/}
                        {/*>*/}
                        {/*    <View style={styles.leftRow}>*/}
                        {/*        <Image*/}
                        {/*            source={require("../../assets/icons/settings.png")}*/}
                        {/*            style={styles.menuIcon}*/}
                        {/*        />*/}
                        {/*        <Text style={styles.menuLabel}>Settings</Text>*/}
                        {/*    </View>*/}
                        {/*    <Image*/}
                        {/*        source={require("../../assets/icons/right-arrow.png")}*/}
                        {/*        style={styles.arrowIcon}*/}
                        {/*    />*/}
                        {/*</TouchableOpacity>*/}

                        {/*<TouchableOpacity*/}
                        {/*    style={styles.menuItem}*/}
                        {/*    onPress={() => console.log("Privacy pressed")}*/}
                        {/*>*/}
                        {/*    <View style={styles.leftRow}>*/}
                        {/*        <Image*/}
                        {/*            source={require("../../assets/icons/privacy.png")}*/}
                        {/*            style={styles.menuIcon}*/}
                        {/*        />*/}
                        {/*        <Text style={styles.menuLabel}>Privacy & Security</Text>*/}
                        {/*    </View>*/}
                        {/*    <Image*/}
                        {/*        source={require("../../assets/icons/right-arrow.png")}*/}
                        {/*        style={styles.arrowIcon}*/}
                        {/*    />*/}
                        {/*</TouchableOpacity>*/}

                        {/*<TouchableOpacity*/}
                        {/*    style={styles.menuItem}*/}
                        {/*    onPress={() => console.log("About pressed")}*/}
                        {/*>*/}
                        {/*    <View style={styles.leftRow}>*/}
                        {/*        <Image*/}
                        {/*            source={require("../../assets/icons/info.png")}*/}
                        {/*            style={styles.menuIcon}*/}
                        {/*        />*/}
                        {/*        <Text style={styles.menuLabel}>About us</Text>*/}
                        {/*    </View>*/}
                        {/*    <Image*/}
                        {/*        source={require("../../assets/icons/right-arrow.png")}*/}
                        {/*        style={styles.arrowIcon}*/}
                        {/*    />*/}
                        {/*</TouchableOpacity>*/}
                    </ScrollView>
                </View>

                {/* Other Information Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Other Information</Text>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleShareApp}
                    >
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/share.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>Share the app</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={()=>{ router.push("/screens/NotificationScreen")}}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/bell.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>Notifications</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleLogout}
                        disabled={loggingOut}
                    >
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/logout.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={[styles.menuLabel, {color: "#E13333"}]}>
                                {loggingOut ? "Logging out..." : "Log out"}
                            </Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push("/screens/LoginTypeSelectionScreen")}
                    >
                        <View style={styles.leftRow}>
                            <Text style={[styles.menuLabel, { color: "#3A7AFE" }]}>
                                Switch provider
                            </Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>
                </View>

                {/* Bottom padding */}
                <View style={{height: RH(40)}}/>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7F7"
    },
    header: {
        width: "100%",
        paddingTop: Platform.OS === 'ios' ? RH(10) : RH(20),
        paddingBottom: RH(20),
        paddingHorizontal: RF(18),
        borderBottomLeftRadius: RF(24),
        borderBottomRightRadius: RF(24),
        shadowColor: "#FFD56C",
        shadowOffset: {width: 0, height: RF(8)},
        shadowOpacity: 0.25,
        shadowRadius: RF(18),
        elevation: 6,
    },
    topHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        height: RH(40),
        marginBottom: RH(10),
    },
    backIcon: {
        width: RF(22),
        height: RF(22),
        tintColor: "#000"
    },
    profileText: {
        fontSize: RF(18),
        fontWeight: "700",
        color: "#000",
        fontFamily: "Poppins-Bold",
    },
    placeholder: {
        width: RF(22),
    },
    avatarWrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: RH(5),
    },
    avatar: {
        width: RF(100),
        height: RF(100),
        borderRadius: RF(50),
        resizeMode: "cover",
        borderWidth: RF(3),
        borderColor: 'rgba(255,255,255,0.3)',
    },
    userName: {
        textAlign: "center",
        marginTop: RH(8),
        fontWeight: "700",
        color: "#111",
        fontSize: RF(20),
        fontFamily: "Poppins-Bold",
        maxWidth: '90%',
        alignSelf: 'center',
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: RH(6),
        alignItems: "center",
        flexWrap: 'wrap',
    },
    infoText: {
        fontSize: RF(14),
        color: "#555",
        marginHorizontal: RF(6),
        fontFamily: "Poppins-Regular",
        maxWidth: '45%',
    },
    topButtonRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: RH(20),
        gap: RF(10),
    },
    topButton: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        paddingVertical: RH(12),
        borderRadius: RF(12),
        alignItems: "center",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: RF(2)},
        shadowOpacity: 0.1,
        shadowRadius: RF(4),
        minHeight: RH(80),
    },
    topButtonIcon: {
        width: RF(30),
        height: RF(30),
        marginBottom: RH(6),
    },
    topButtonLabel: {
        fontSize: RF(12),
        fontWeight: "600",
        fontFamily: "Poppins-SemiBold",
        textAlign: 'center',
        paddingHorizontal: RF(4),
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: RF(12),
        paddingTop: RH(20),
        paddingBottom: RH(40),
        backgroundColor: "#F7F7F7",
    },
    smallCard: {
        backgroundColor: "#fff",
        borderRadius: RF(12),
        paddingHorizontal: RF(14),
        paddingVertical: RH(12),
        marginBottom: RH(14),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: RF(1)},
        shadowOpacity: 0.1,
        shadowRadius: RF(2),
    },
    smallCardLabel: {
        fontWeight: "600",
        fontSize: RF(15),
        fontFamily: "Poppins-SemiBold",
    },
    smallCardRight: {
        flexDirection: "row",
        alignItems: "center"
    },
    smallValue: {
        color: "#4D4D4D",
        fontWeight: "600",
        marginRight: RF(8),
        fontFamily: "Poppins-SemiBold",
        fontSize: RF(14),
    },
    smallArrow: {
        width: RF(14),
        height: RF(14),
        tintColor: "#777"
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: RF(14),
        paddingHorizontal: RF(14),
        paddingVertical: RH(12),
        marginBottom: RH(16),
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: RF(1)},
        shadowOpacity: 0.1,
        shadowRadius: RF(2),
    },
    menuScroll: {
        maxHeight: RH(300), // Set max height for scrollable area
    },
    cardTitle: {
        fontSize: RF(16),
        fontWeight: "700",
        marginBottom: RH(12),
        fontFamily: "Poppins-Bold",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: RH(12),
        minHeight: RH(50),
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
    },
    leftRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    menuIcon: {
        width: RF(22),
        height: RF(22),
        marginRight: RF(12),
        tintColor: "#555"
    },
    menuLabel: {
        fontSize: RF(15),
        color: "#333",
        fontWeight: "500",
        fontFamily: "Poppins-Medium",
        flexShrink: 1,
    },
    arrowIcon: {
        width: RF(16),
        height: RF(16),
        tintColor: "#777"
    },
});
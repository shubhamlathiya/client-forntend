import AsyncStorage from "@react-native-async-storage/async-storage";
import {useRouter} from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, {useEffect, useRef, useState} from "react";
import {
    Animated,
    Image,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {logoutUser} from "../../api/authApi";

const HEADER_MAX_HEIGHT = 380;
const HEADER_MIN_HEIGHT = 100;
const PROFILE_TEXT_OPACITY = 0;
const PROFILE_TEXT_OPACITY_VISIBLE = 1;

export default function AccountScreen() {
    const router = useRouter();
    const scrollY = useRef(new Animated.Value(0)).current;

    const [hideSensitive, setHideSensitive] = useState(false);
    const [user, setUser] = useState(null);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const userData = await AsyncStorage.getItem("userData");
                if (userData && mounted) setUser(JSON.parse(userData));
                else if (mounted)
                    setUser({
                        name: "Lathiya Shubham",
                        phone: "7041138931",
                        dob: "18 Mar 2004",
                    });
            } catch (e) {
                console.error("Failed to load user data", e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await logoutUser().catch(() => {
            });
        } catch (e) {
            console.error("Logout failed", e);
        } finally {
            try {
                await AsyncStorage.removeItem("userData");
                await AsyncStorage.removeItem("token");
                await SecureStore.deleteItemAsync("accessToken").catch(() => {
                });
                await SecureStore.deleteItemAsync("refreshToken").catch(() => {
                });
            } catch (e) {
            }
            router.replace("/screens/LoginScreen");
            setLoggingOut(false);
        }
    };

    // Header animations
    const headerHeight = scrollY.interpolate({
        inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
        outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
        extrapolate: "clamp",
    });

    const avatarScale = scrollY.interpolate({
        inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
        outputRange: [1, 0.6],
        extrapolate: "clamp",
    });

    const avatarOpacity = scrollY.interpolate({
        inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) * 0.5],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const userNameOpacity = scrollY.interpolate({
        inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) * 0.5],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const infoRowOpacity = scrollY.interpolate({
        inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) * 0.5],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const topButtonRowOpacity = scrollY.interpolate({
        inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) * 0.5],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const profileTextOpacity = scrollY.interpolate({
        inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) * 0.7],
        outputRange: [PROFILE_TEXT_OPACITY, PROFILE_TEXT_OPACITY_VISIBLE],
        extrapolate: "clamp",
    });

    const profileTextTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
        outputRange: [20, 0],
        extrapolate: "clamp",
    });

    // Fixed top bar opacity
    const fixedTopBarOpacity = scrollY.interpolate({
        inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT) * 0.7],
        outputRange: [0, 1],
        extrapolate: "clamp",
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFE59A"/>

            {/* Fixed Top Bar - Appears when scrolled */}
            <Animated.View style={[styles.fixedTopBar, { opacity: fixedTopBarOpacity }]}>
                <View style={styles.fixedTopBarContent}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={styles.fixedBackIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.fixedProfileText}>Profile</Text>
                    <View style={styles.placeholder} />
                </View>
            </Animated.View>

            {/* Animated Header */}
            <Animated.View style={[styles.animatedHeader, { height: headerHeight }]}>
                <LinearGradient colors={["#FFE59A", "#FFD56C"]} style={styles.topSection}>

                    {/* Top Row with Back Button and Profile Text */}
                    <View style={styles.topHeaderRow}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Image
                                source={require("../../assets/icons/back_icon.png")}
                                style={styles.backIcon}
                            />
                        </TouchableOpacity>

                        <Animated.Text
                            style={[
                                styles.profileText,
                                {
                                    opacity: profileTextOpacity,
                                    transform: [{ translateY: profileTextTranslateY }]
                                }
                            ]}
                        >
                            Profile
                        </Animated.Text>

                        <View style={styles.placeholder} />
                    </View>

                    {/* Animated Avatar */}
                    <Animated.View
                        style={[
                            styles.avatarWrapper,
                            {
                                transform: [{ scale: avatarScale }],
                                opacity: avatarOpacity
                            }
                        ]}
                    >
                        <Image
                            source={require("../../assets/icons/user-avatar.png")}
                            style={styles.avatar}
                        />
                    </Animated.View>

                    {/* Animated User Name */}
                    <Animated.Text
                        style={[
                            styles.userName,
                            { opacity: userNameOpacity }
                        ]}
                    >
                        {user?.name || "Guest User"}
                    </Animated.Text>

                    {/* Animated Info Row */}
                    <Animated.View
                        style={[
                            styles.infoRow,
                            { opacity: infoRowOpacity }
                        ]}
                    >
                        <Text style={styles.infoText}>{user?.phone || "No phone"}</Text>
                        <Text style={styles.infoText}>{user?.dob || "Not set"}</Text>
                    </Animated.View>

                    {/* Animated Top Buttons */}
                    <Animated.View
                        style={[
                            styles.topButtonRow,
                            { opacity: topButtonRowOpacity }
                        ]}
                    >
                        <TouchableOpacity style={styles.topButton} onPress={() => router.push("/screens/MyOrderScreen")}>
                            <Image
                                source={require("../../assets/icons/empty-box.png")}
                                style={styles.topButtonIcon}
                            />
                            <Text style={styles.topButtonLabel}>Your orders</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.topButton} onPress={()=> router.push("/screens/WalletScreen")}>
                            <Image
                                source={require("../../assets/icons/money.png")}
                                style={styles.topButtonIcon}
                            />
                            <Text style={styles.topButtonLabel}>Money</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.topButton}>
                            <Image
                                source={require("../../assets/icons/help.png")}
                                style={styles.topButtonIcon}
                            />
                            <Text style={styles.topButtonLabel}>Need help?</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </LinearGradient>
            </Animated.View>

            {/* Content - Scrolls behind header */}
            <Animated.ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{nativeEvent: {contentOffset: {y: scrollY}}}],
                    {useNativeDriver: false}
                )}
                scrollEventThrottle={16}
            >
                {/* Add padding to push content below the header */}
                <View style={{height: HEADER_MAX_HEIGHT - 50}} />

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

                {/* HIDE SENSITIVE CARD */}
                <View style={styles.sensitiveCard}>
                    <View style={styles.sensitiveLeft}>
                        <Image
                            source={require("../../assets/icons/hide.png")}
                            style={styles.sensitiveIcon}
                        />
                        <View>
                            <Text style={styles.sensitiveTitle}>Hide sensitive items</Text>
                            <Text style={styles.sensitiveSubtitle}>
                                Sexual wellness, nicotine products and other
                                sensitive items will be hidden
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={hideSensitive}
                        onValueChange={setHideSensitive}
                        trackColor={{ false: "#BEBEBE", true: "#4CD964" }}
                    />
                </View>

                {/* Your Information Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Your information</Text>

                    <TouchableOpacity style={styles.menuItem}>
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

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/heart.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>Your wishlist</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/gst.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>GST details</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/gift.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>E-gift cards</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>
                </View>

                {/* Other Information Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Other Information</Text>

                    <TouchableOpacity style={styles.menuItem}>
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

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/info.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>About us</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/privacy.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>Account privacy</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/bell.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>Notification preferences</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
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
                            {/*<Image*/}
                            {/*    source={require("../../assets/icons/switch-provider.png")}*/}
                            {/*    style={styles.menuIcon}*/}
                            {/*/>*/}
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

                <View style={{height: Platform.OS === "ios" ? 120 : 80}}/>
            </Animated.ScrollView>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7F7"
    },
    // Fixed Top Bar Styles
    fixedTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: Platform.OS === 'ios' ? 100 : 100,
        backgroundColor: "#FFE59A",
        zIndex: 2000,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    fixedTopBarContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: Platform.OS === 'ios' ? 50 : 42,
        paddingHorizontal: 18,
        height: '100%',
    },
    fixedBackIcon: {
        width: 22,
        height: 22,
        tintColor: "#000"
    },
    fixedProfileText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
        fontFamily: "Poppins-Bold",
    },
    animatedHeader: {
        width: "100%",
        overflow: "hidden",
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    topSection: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : 42,
        paddingBottom: 12,
        paddingHorizontal: 18,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: "#FFD56C",
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 6,
    },
    topHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        height: 40,
    },
    backIcon: {
        width: 22,
        height: 22,
        tintColor: "#000"
    },
    profileText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
        fontFamily: "Poppins-Bold",
    },
    placeholder: {
        width: 22,
    },
    avatarWrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        resizeMode: "cover",
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    userName: {
        textAlign: "center",
        marginTop: 8,
        fontWeight: "700",
        color: "#111",
        fontSize: 20,
        fontFamily: "Poppins-Bold",
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 6,
        alignItems: "center",
    },
    infoText: {
        fontSize: 14,
        color: "#555",
        marginHorizontal: 6,
        fontFamily: "Poppins-Regular",
    },
    topButtonRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
    },
    topButton: {
        width: "30%",
        backgroundColor: "#FFFFFF",
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    topButtonIcon: {
        width: 30,
        height: 30,
        marginBottom: 6,
    },
    topButtonLabel: {
        fontSize: 12,
        fontWeight: "600",
        fontFamily: "Poppins-SemiBold",
        textAlign: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 12,
        backgroundColor: "#F7F7F7",
    },
    smallCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    smallCardLabel: {
        fontWeight: "600",
        fontSize: 15,
        fontFamily: "Poppins-SemiBold",
    },
    smallCardRight: {
        flexDirection: "row",
        alignItems: "center"
    },
    smallValue: {
        color: "#4D4D4D",
        fontWeight: "600",
        marginRight: 8,
        fontFamily: "Poppins-SemiBold",
    },
    smallArrow: {
        width: 14,
        height: 14,
        tintColor: "#777"
    },
    sensitiveCard: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    sensitiveLeft: {
        flexDirection: "row",
        gap: 12,
        flex: 1,
    },
    sensitiveIcon: {
        width: 26,
        height: 26,
        tintColor: "#3EAF5B",
    },
    sensitiveTitle: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 2,
        fontFamily: "Poppins-SemiBold",
    },
    sensitiveSubtitle: {
        fontSize: 12,
        color: "#777",
        lineHeight: 18,
        fontFamily: "Poppins-Regular",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 12,
        fontFamily: "Poppins-Bold",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    leftRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    menuIcon: {
        width: 22,
        height: 22,
        marginRight: 12,
        tintColor: "#555"
    },
    menuLabel: {
        fontSize: 15,
        color: "#333",
        fontWeight: "500",
        fontFamily: "Poppins-Medium",
    },
    arrowIcon: {
        width: 16,
        height: 16,
        tintColor: "#777"
    },
});
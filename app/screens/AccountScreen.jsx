import AsyncStorage from "@react-native-async-storage/async-storage";
import {useFocusEffect, useRouter} from "expo-router";
import React, {useCallback, useState, useRef} from "react";
import {
    Image,
    StatusBar,
    StyleSheet,
    Text,
    Pressable,
    View,
    Platform,
    Share,
    Dimensions,
    ScrollView,
    SafeAreaView,
    Modal,
    Alert,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard
} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import * as ImagePicker from 'expo-image-picker';
import {uploadProfileImage, getUserProfile, logoutUser, updateUserPhone} from "../../api/authApi";
import {API_BASE_URL} from "../../config/apiConfig";

const {width, height} = Dimensions.get('window');

// Responsive calculations
const RF = (size) => {
    const scale = width / 375;
    return Math.ceil(size * scale);
};

const RH = (size) => {
    const scale = height / 812;
    return Math.ceil(size * scale);
};

export default function AccountScreen() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showImageOptions, setShowImageOptions] = useState(false);
    const [userProfileImage, setUserProfileImage] = useState(null);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [updatingPhone, setUpdatingPhone] = useState(false);
    const [isPhoneEditable, setIsPhoneEditable] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Helper function to format phone number with +91
    const formatPhoneNumber = (phone) => {
        if (!phone) return "";

        // Remove any non-digit characters
        const cleaned = phone.replace(/\D/g, '');

        // If phone starts with 91 and has more than 10 digits, it might already include country code
        if (cleaned.startsWith('91') && cleaned.length >= 12) {
            return `+${cleaned}`;
        }

        if (cleaned.length === 10) {
            return `+91 ${cleaned}`;
        }

        // Return as is for other cases
        return phone;
    };

    // Helper function to extract just the 10-digit number for editing
    const extractPhoneDigits = (phone) => {
        if (!phone) return "";

        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');

        // If starts with 91 and has more digits, remove country code
        if (cleaned.startsWith('91') && cleaned.length > 10) {
            return cleaned.substring(2, 12); // Take next 10 digits
        }

        // If exactly 10 digits, return as is
        if (cleaned.length === 10) {
            return cleaned;
        }

        // For other cases, try to get last 10 digits
        return cleaned.length >= 10 ? cleaned.substring(cleaned.length - 10) : cleaned;
    };

    const loadUserData = async () => {
        try {
            setLoadingProfile(true);
            const stored = await AsyncStorage.getItem("userData");

            if (stored) {
                const userData = JSON.parse(stored);
                const userId = userData.id || userData._id;
                setUser(userData);

                // Extract just the digits for editing field
                const phoneDigits = extractPhoneDigits(userData.phone || "");
                setPhoneNumber(phoneDigits);

                // Check if profile picture exists in local storage first
                if (userData.profile?.picture) {
                    setUserProfileImage(`${API_BASE_URL}${userData.profile.picture}`);
                }

                // Fetch latest user profile with image
                if (userId) {
                    try {
                        const profileData = await getUserProfile(userId);

                        // Handle different response structures
                        let fetchedUser = null;

                        if (profileData?.data?.user) {
                            // Structure: { data: { user: {...} } }
                            fetchedUser = profileData.data.user;
                        } else if (profileData?.user) {
                            // Structure: { user: {...} }
                            fetchedUser = profileData.user;
                        } else if (profileData?.data) {
                            // Structure: { data: {...} }
                            fetchedUser = profileData.data;
                        } else {
                            // Structure is already the user object
                            fetchedUser = profileData;
                        }


                        if (fetchedUser) {
                            // Update user state with fetched data
                            const updatedUser = {
                                ...userData,
                                ...fetchedUser,
                                profile: {
                                    ...userData.profile,
                                    ...fetchedUser.profile
                                }
                            };

                            setUser(updatedUser);

                            // Update AsyncStorage with merged data
                            await AsyncStorage.setItem("userData", JSON.stringify(updatedUser));

                            // Set profile image if available
                            if (fetchedUser.profile?.picture) {
                                const imageUrl = `${API_BASE_URL}${fetchedUser.profile.picture}`;
                                // console.log("Setting profile image URL:", imageUrl);
                                setUserProfileImage(imageUrl);
                            } else if (fetchedUser.profileImageUrl) {
                                setUserProfileImage(fetchedUser.profileImageUrl);
                            }
                        }
                    } catch (profileError) {
                        console.error("Error fetching profile:", profileError);
                        // Use local storage data if API call fails
                        if (userData.profile?.picture) {
                            setUserProfileImage(`${API_BASE_URL}${userData.profile.picture}`);
                        }
                    }
                } else {
                    // Use local data if no user ID
                    if (userData.profile?.picture) {
                        setUserProfileImage(`${API_BASE_URL}${userData.profile.picture}`);
                    }
                }
            } else {
                setUser({
                    name: "Guest User",
                    phone: "",
                });
            }
        } catch (err) {
            console.error("Failed to read AsyncStorage:", err);
            setUser({
                name: "Guest User",
                phone: "",
            });
        } finally {
            setLoadingProfile(false);
        }
    };

    useFocusEffect(useCallback(() => {
        loadUserData();
    }, []));

    const pickImage = async (sourceType) => {
        setShowImageOptions(false);

        let result;
        if (sourceType === 'camera') {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Camera Permission Is Required To Take Photos');
                return;
            }
            result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
        } else {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Gallery Permission Is Required To Select Photos');
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
        }

        if (!result.canceled && result.assets && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (imageUri) => {
        const stored = await AsyncStorage.getItem("userData");


        const userData = JSON.parse(stored);
        const userId = userData.id || userData._id;

        if (!userId) {
            Alert.alert('Error', 'User not found');
            return;
        }

        setUploading(true);

        try {
            // Convert image to blob
            const formData = new FormData();
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('profileImage', {
                uri: imageUri,
                name: filename,
                type: type,
            });

            // Upload to server
            const response = await uploadProfileImage(userId, formData);


            if (response.success) {
                let profileImageUrl = response.data?.profileImageUrl || response.data?.picture;

                if (!profileImageUrl && response.data?.user?.profile?.picture) {
                    profileImageUrl = response.data.user.profile.picture;
                }

                if (profileImageUrl) {
                    const fullImageUrl = profileImageUrl.startsWith('http')
                        ? profileImageUrl
                        : `${API_BASE_URL}${profileImageUrl}`;

                    setUserProfileImage(fullImageUrl);

                    // Update local storage
                    const storedUser = await AsyncStorage.getItem("userData");
                    if (storedUser) {
                        const userData = JSON.parse(storedUser);
                        userData.profile = userData.profile || {};
                        userData.profile.picture = profileImageUrl;
                        await AsyncStorage.setItem("userData", JSON.stringify(userData));
                    }

                    Alert.alert('Success', 'Profile Picture Updated Successfully');
                    loadUserData();
                } else {
                    Alert.alert('Error', 'Failed to get image URL from response');
                }
            } else {
                Alert.alert('Error', response.message || 'Failed to upload image');
            }
        } catch (error) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleUpdatePhone = async () => {
        // Extract just digits for validation
        const phoneDigits = phoneNumber.replace(/\D/g, '');

        if (!phoneDigits) {
            Alert.alert('Error', 'Please Enter A Valid Phone Number');
            return;
        }

        // Validate 10 digits
        if (phoneDigits.length === 10) {

            // Format phone number with +91
            const formattedPhone = `+91 ${phoneDigits}`;

            setUpdatingPhone(true);

            try {
                const stored = await AsyncStorage.getItem("userData");
                if (!stored) {
                    Alert.alert('Error', 'User not found');
                    return;
                }

                const userData = JSON.parse(stored);
                const userId = userData.id || userData._id;

                // Send the formatted phone number to API
                const response = await updateUserPhone(userId, formattedPhone);

                if (response.success) {
                    // Update local storage with formatted number
                    userData.phone = formattedPhone;
                    await AsyncStorage.setItem("userData", JSON.stringify(userData));

                    // Update state
                    setUser(prev => ({...prev, phone: formattedPhone}));

                    Alert.alert('Success', 'Phone Number Updated Successfully');
                    setIsPhoneEditable(false);
                    setShowPhoneModal(false);
                } else {
                    Alert.alert('Error', response.message || 'Failed to update phone number');
                }
            } catch (error) {
                console.error('Update phone error:', error);
                Alert.alert('Error', 'Failed to update phone number');
            } finally {
                setUpdatingPhone(false);
            }

        } else {
            Alert.alert('Error', 'Please Enter a Valid 10-digit Phone Number');
            return;
        }

    };

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);

        try {
            await logoutUser();
            router.replace("/screens/LoginScreen");
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

    if (loadingProfile) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAD73"/>
                <Text style={styles.loadingText}>Loading Profile...</Text>
            </View>
        );
    }

    return (<SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFE59A"/>

        {/* Image Upload Modal */}
        <Modal
            visible={showImageOptions}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowImageOptions(false)}
        >
            <Pressable
                style={styles.modalOverlay}
                onPress={() => setShowImageOptions(false)}
            >
                <View style={styles.imageOptionsContainer}>
                    <Pressable
                        style={styles.optionButton}
                        onPress={() => pickImage('camera')}
                    >
                        <Text style={styles.optionText}>Take Photo</Text>
                    </Pressable>
                    <Pressable
                        style={styles.optionButton}
                        onPress={() => pickImage('gallery')}
                    >
                        <Text style={styles.optionText}>Choose from Gallery</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.optionButton, styles.cancelButton]}
                        onPress={() => setShowImageOptions(false)}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>

        {/* Phone Update Modal */}
        <Modal
            visible={showPhoneModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
                setShowPhoneModal(false);
                setIsPhoneEditable(false);
                // Reset phone number to current user phone when modal closes
                setPhoneNumber(extractPhoneDigits(user?.phone || ""));
            }}
        >
            <TouchableWithoutFeedback onPress={() => {
                setShowPhoneModal(false);
                setIsPhoneEditable(false);
                setPhoneNumber(extractPhoneDigits(user?.phone || ""));
            }}>
                <View style={styles.phoneModalOverlay}>
                    <TouchableWithoutFeedback>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={styles.phoneModalContainer}
                        >
                            <Text style={styles.phoneModalTitle}>Update Phone Number</Text>

                            <View style={styles.phoneInputContainer}>
                                <View style={styles.countryCodeContainer}>
                                    <Text style={styles.countryCodeText}>+91</Text>
                                </View>
                                <TextInput
                                    style={styles.phoneInput}
                                    value={phoneNumber}
                                    onChangeText={(text) => {
                                        // Only allow digits
                                        const digits = text.replace(/\D/g, '');
                                        // Limit to 10 digits
                                        const limitedDigits = digits.substring(0, 10);
                                        setPhoneNumber(limitedDigits);
                                    }}
                                    placeholder="Enter 10-digit number"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    autoFocus
                                />
                            </View>

                            <Text style={styles.phoneFormatHint}>
                                Format: +91 XXXXXXXXXX
                            </Text>

                            <View style={styles.phoneModalButtons}>
                                <Pressable
                                    style={[styles.phoneModalButton, styles.cancelPhoneButton]}
                                    onPress={() => {
                                        setShowPhoneModal(false);
                                        setIsPhoneEditable(false);
                                        setPhoneNumber(extractPhoneDigits(user?.phone || ""));
                                    }}
                                >
                                    <Text style={styles.cancelPhoneText}>Cancel</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.phoneModalButton, styles.updatePhoneButton]}
                                    onPress={handleUpdatePhone}
                                    disabled={updatingPhone}
                                >
                                    {updatingPhone ? (<ActivityIndicator size="small" color="#fff"/>) : (
                                        <Text style={styles.updatePhoneText}>Update</Text>)}
                                </Pressable>
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>

        {/* Fixed Header */}
        <LinearGradient colors={["#FFE59A", "#FFD56C"]} style={styles.header}>
            {/* Top Row with Back Button and Profile Text */}
            <View style={styles.topHeaderRow}>
                <Pressable onPress={() => router.back()}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={styles.backIcon}
                    />
                </Pressable>

                <Text style={styles.profileText}>
                    Profile
                </Text>

                <View style={styles.placeholder}/>
            </View>

            {/* Avatar with Upload Option */}
            <Pressable
                style={styles.avatarWrapper}
                onPress={() => setShowImageOptions(true)}
                disabled={uploading}
            >
                {uploading ? (<View style={[styles.avatar, styles.uploadingAvatar]}>
                    <ActivityIndicator size="large" color="#FFD56C"/>
                </View>) : (<>
                    <Image
                        source={userProfileImage ? {uri: userProfileImage} : require("../../assets/icons/user-avatar.png")}
                        style={styles.avatar}
                    />
                    <View style={styles.cameraIconContainer}>
                        <Image
                            source={require("../../assets/icons/camera.png")}
                            style={styles.cameraIcon}
                        />
                    </View>
                </>)}
            </Pressable>

            {/* User Name */}
            <Text
                style={styles.userName}
                numberOfLines={1}
                adjustsFontSizeToFit
            >
                {user?.name || "Guest User"}
            </Text>

            {/* Phone Number Row with Edit Button */}
            <View style={styles.phoneRow}>
                <View style={styles.phoneDisplayContainer}>
                    <Text style={styles.phoneText} numberOfLines={1}>
                        {user?.phone ? formatPhoneNumber(user.phone) : "Phone not set"}
                    </Text>
                    <Pressable
                        style={styles.editPhoneButton}
                        onPress={() => {
                            setShowPhoneModal(true);
                            // Set current phone digits for editing
                            setPhoneNumber(extractPhoneDigits(user?.phone || ""));
                        }}
                    >
                        <Image
                            source={require("../../assets/icons/edit.png")}
                            style={styles.editIcon}
                        />
                    </Pressable>
                </View>
            </View>
        </LinearGradient>

        {/* Scrollable Content */}
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
        >
            {/* Your Information Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Your information</Text>

                <ScrollView
                    style={styles.menuScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                >
                    <Pressable
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
                    </Pressable>
                    <Pressable
                        style={styles.menuItem}
                        onPress={() => router.push("/screens/MyOrderScreen")}
                    >
                        <View style={styles.leftRow}>
                            <Image
                                source={require("../../assets/icons/orderDelivery.png")}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuLabel}>Your orders</Text>
                        </View>
                        <Image
                            source={require("../../assets/icons/right-arrow.png")}
                            style={styles.arrowIcon}
                        />
                    </Pressable>

                    <Pressable
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
                    </Pressable>
                </ScrollView>
            </View>

            {/* Other Information Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Other Information</Text>

                <Pressable
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
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => {
                    router.push("/screens/NotificationScreen")
                }}>
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
                </Pressable>

                <Pressable
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
                </Pressable>

                <Pressable
                    style={styles.menuItem}
                    onPress={() => router.push("/screens/LoginTypeSelectionScreen")}
                >
                    <View style={styles.leftRow}>
                        <Text style={[styles.menuLabel, {color: "#3A7AFE"}]}>
                            Switch provider
                        </Text>
                    </View>
                    <Image
                        source={require("../../assets/icons/right-arrow.png")}
                        style={styles.arrowIcon}
                    />
                </Pressable>
            </View>

            {/* Bottom padding */}
            <View style={{height: RH(40)}}/>
        </ScrollView>
    </SafeAreaView>);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7F7"
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F7F7F7',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
        fontFamily: 'Poppins-Regular',
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
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: RF(16),
        paddingVertical: RF(12),
    },
    backIcon: {
        padding: RF(4),
        width: RF(24),
        height: RF(24),
        tintColor: "#000"
    },
    profileText: {
        fontSize: RF(18),
        fontWeight: "600",
        color: "#1B1B1B",
        fontFamily: "Poppins-SemiBold",
        textAlign: "center",
        flex: 1,
        marginHorizontal: RF(8),
    },
    placeholder: {
        width: RF(22),
    },
    avatarWrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: RH(5),
        position: 'relative',
    },
    avatar: {
        width: RF(100),
        height: RF(100),
        borderRadius: RF(50),
        resizeMode: "cover",
        borderWidth: RF(3),
        borderColor: 'rgba(255,255,255,0.3)',
    },
    uploadingAvatar: {
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 0,
        left: RF(200),
        backgroundColor: '#fff',
        borderRadius: RF(15),
        padding: RF(6),
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    cameraIcon: {
        width: RF(18),
        height: RF(18),
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
    phoneRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: RH(8),
        alignItems: "center",
    },
    phoneDisplayContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: RF(20),
        paddingHorizontal: RF(12),
        paddingVertical: RH(6),
    },
    phoneText: {
        fontSize: RF(15),
        color: "#333",
        fontFamily: "Poppins-Medium",
        marginRight: RF(8),
    },
    editPhoneButton: {
        padding: RF(4),
    },
    editIcon: {
        width: RF(14),
        height: RF(14),
        tintColor: "#555",
    },
    phoneModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: RF(20),
    },
    phoneModalContainer: {
        backgroundColor: 'white',
        borderRadius: RF(16),
        padding: RF(20),
        width: '100%',
        maxWidth: RF(320),
    },
    phoneModalTitle: {
        fontSize: RF(18),
        fontWeight: "700",
        marginBottom: RH(16),
        fontFamily: "Poppins-Bold",
        textAlign: 'center',
        color: '#333',
    },
    phoneInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: RH(8),
    },
    countryCodeContainer: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: RF(12),
        paddingVertical: RH(12),
        borderTopLeftRadius: RF(8),
        borderBottomLeftRadius: RF(8),
        borderWidth: 1,
        borderColor: '#ddd',
        borderRightWidth: 0,
    },
    countryCodeText: {
        fontSize: RF(16),
        fontFamily: "Poppins-Medium",
        color: "#333",
    },
    phoneInput: {
        flex: 1,
        backgroundColor: '#f8f8f8',
        paddingHorizontal: RF(12),
        paddingVertical: RH(12),
        borderTopRightRadius: RF(8),
        borderBottomRightRadius: RF(8),
        fontSize: RF(16),
        fontFamily: "Poppins-Regular",
        color: "#333",
        borderWidth: 1,
        borderColor: '#ddd',
        borderLeftWidth: 0,
    },
    phoneFormatHint: {
        fontSize: RF(12),
        color: '#666',
        fontFamily: "Poppins-Regular",
        marginBottom: RH(20),
        textAlign: 'center',
    },
    phoneModalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    phoneModalButton: {
        flex: 1,
        paddingVertical: RH(12),
        borderRadius: RF(8),
        alignItems: 'center',
    },
    cancelPhoneButton: {
        backgroundColor: '#f0f0f0',
        marginRight: RF(8),
    },
    cancelPhoneText: {
        color: '#666',
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
    },
    updatePhoneButton: {
        backgroundColor: '#4CAF50',
        marginLeft: RF(8),
    },
    updatePhoneText: {
        color: '#fff',
        fontSize: RF(14),
        fontFamily: "Poppins-Medium",
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
        maxHeight: RH(300),
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    imageOptionsContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: RF(20),
        borderTopRightRadius: RF(20),
        padding: RF(20),
        paddingBottom: Platform.OS === 'ios' ? RH(40) : RH(20),
    },
    optionButton: {
        paddingVertical: RH(16),
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    optionText: {
        fontSize: RF(16),
        color: '#333',
        textAlign: 'center',
        fontFamily: 'Poppins-Medium',
    },
    cancelButton: {
        borderBottomWidth: 0,
        marginTop: RH(10),
        backgroundColor: '#f8f8f8',
        borderRadius: RF(10),
    },
    cancelText: {
        fontSize: RF(16),
        color: '#E13333',
        textAlign: 'center',
        fontFamily: 'Poppins-Medium',
    },
});
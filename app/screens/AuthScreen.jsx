import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, Pressable, Image, Alert, Platform} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import logo from '../../assets/Logo_green.png';
import googleIcon from '../../assets/google_logo.png';
import facebookIcon from '../../assets/facebook.png';
import {googleLogin} from "../../utils/googleLoginHelper";
import * as Notifications from "expo-notifications";

export default function AuthScreen() {

    useEffect(() => {
        requestNotificationPermission();
    }, []);

    const requestNotificationPermission = async () => {
        // iOS + Android (API 33+)
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            Alert.alert("Permission Needed", "Please enable notifications.");
            return;
        }

        // Create Android channel (important)
        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("default", {
                name: "Default",
                importance: Notifications.AndroidImportance.MAX,
            });
        }

        console.log("Notification permission granted");
    };
    const router = useRouter();
    const [googleLoading, setGoogleLoading] = useState(false);
    function handleLogin() {
        router.replace('/screens/LoginScreen');
    }

    function handleSignUp() {
        router.replace('/screens/SignUpScreen');
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Center logo */}
            <View style={styles.logoWrapper}>
                <Image source={logo} style={styles.logoImage} resizeMode="contain" />
            </View>

            {/* Buttons Section */}
            <View style={styles.buttonWrapper}>
                <Pressable
                    style={[styles.button, { backgroundColor: colors.primaryGreen }]}
                    onPress={handleLogin}
                >
                    <Text style={[styles.buttonText, { color: colors.white }]}>Log In</Text>
                </Pressable>

                <Pressable
                    style={[
                        styles.button,
                        {
                            backgroundColor: colors.white,
                            borderWidth: 1,
                            borderColor: colors.primaryGreen,
                        },
                    ]}
                    onPress={handleSignUp}
                >
                    <Text style={[styles.buttonText, { color: colors.primaryGreen }]}>Sign Up</Text>
                </Pressable>

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>Or</Text>
                    <View style={styles.line} />
                </View>

                {/* Social Login Buttons */}
                <Pressable style={[styles.socialButton]} onPress={() => googleLogin(router, setGoogleLoading)} disabled={googleLoading}>
                    <Image source={googleIcon} style={styles.icon} />
                    <Text style={styles.socialText}>Continue with Google</Text>
                </Pressable>

                <Pressable style={[styles.socialButton]}>
                    <Image source={facebookIcon} style={styles.icon} />
                    <Text style={styles.socialText}>Continue with Facebook</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    logoWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 60,
    },
    logoImage: {
        width: 200,
        height: 200,
    },
    buttonWrapper: {
        width: '100%',
        alignItems: 'center',
        gap: 20,
    },
    button: {
        width: '85%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: fonts.medium,
        fontSize: 16,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginVertical: 20,
    },
    line: {
        height: 1,
        flex: 1,
        backgroundColor: "#D9D9D9",
    },
    orText: {
        color: "#838383",
        fontSize: 16,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '85%',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderGray,
        backgroundColor: colors.white,
    },
    icon: {
        width: 24,
        height: 24,
        marginRight: 10,
    },
    socialText: {
        fontFamily: fonts.medium,
        fontSize: 16,
        color: '#1E1E1E',
    },
});

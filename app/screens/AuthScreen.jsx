import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Alert} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import { globalStyles } from '../../constants/globalStyles';
import logo from '../../assets/Logo_green.png';
import googleIcon from '../../assets/google_logo.png';
import facebookIcon from '../../assets/facebook.png';
import * as Linking from "expo-linking";
import {BASE_URL} from "../../config/apiConfig";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import {mergeGuestCart} from "../../api/cartApi";

export default function AuthScreen() {
    const router = useRouter();
    const [googleLoading, setGoogleLoading] = useState(false);
    function handleLogin() {
        router.replace('/screens/LoginScreen');
    }

    function handleSignUp() {
        router.replace('/screens/SignUpScreen');
    }
    async function handleGoogleLogin() {
        if (googleLoading) return;
        setGoogleLoading(true);
        try {
            const redirectUrl = Linking.createURL('/');
            const authUrl = `${BASE_URL}/api/auth/social/google?redirect_uri=${encodeURIComponent(redirectUrl)}`;
            // Open an auth session; it resolves when redirected to redirectUrl
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

            if (result.type === 'success' && result.url) {
                const finalUrl = result.url;
                const fragment = finalUrl.includes('#') ? finalUrl.split('#')[1] : '';
                const query = finalUrl.includes('?') ? finalUrl.split('?')[1] : '';
                const raw = fragment || query || '';

                const params = new URLSearchParams(raw);
                const accessToken = params.get('accessToken') || params.get('access_token') || params.get('token');
                const refreshToken = params.get('refreshToken') || params.get('refresh_token');
                const userParam = params.get('user');

                if (accessToken) {
                    await SecureStore.setItemAsync('accessToken', String(accessToken));
                }
                if (refreshToken) {
                    await SecureStore.setItemAsync('refreshToken', String(refreshToken));
                }

                if (userParam) {
                    try {
                        const decoded = decodeURIComponent(userParam);
                        await SecureStore.setItemAsync('user', decoded);
                    } catch (_) {
                        // best-effort: store raw string
                        await SecureStore.setItemAsync('user', String(userParam));
                    }
                }

                Alert.alert('Success', 'Logged in with Google');
                // Merge guest cart into user account after social login
                try {
                    await mergeGuestCart();
                } catch (_) {
                }
                router.replace('/screens/LoginTypeSelectionScreen');
            } else if (result.type === 'cancel') {
                Alert.alert('Cancelled', 'Google login was cancelled');
            } else {
                Alert.alert('Error', 'Google login did not complete');
            }
        } catch (error) {
            const message = error?.message || 'Failed to login with Google';
            Alert.alert('Error', message);
        } finally {
            setGoogleLoading(false);
        }
    }
    return (
        <SafeAreaView style={styles.container}>
            {/* Center logo */}
            <View style={styles.logoWrapper}>
                <Image source={logo} style={styles.logoImage} resizeMode="contain" />
            </View>

            {/* Buttons Section */}
            <View style={styles.buttonWrapper}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primaryGreen }]}
                    onPress={handleLogin}
                >
                    <Text style={[styles.buttonText, { color: colors.white }]}>Log In</Text>
                </TouchableOpacity>

                <TouchableOpacity
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
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>Or</Text>
                    <View style={styles.line} />
                </View>

                {/* Social Login Buttons */}
                <TouchableOpacity style={[styles.socialButton]} onPress={handleGoogleLogin} disabled={googleLoading}>
                    <Image source={googleIcon} style={styles.icon} />
                    <Text style={styles.socialText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.socialButton]}>
                    <Image source={facebookIcon} style={styles.icon} />
                    <Text style={styles.socialText}>Continue with Facebook</Text>
                </TouchableOpacity>
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

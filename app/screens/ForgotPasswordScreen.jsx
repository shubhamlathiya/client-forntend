// ForgotPasswordScreen.js
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform, Image,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {globalStyles} from "../../constants/globalStyles";
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { forgotPassword } from '../../api/authApi';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/screens/AuthScreen');
        }
    };
    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.inner}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <View style={globalStyles.header}>
                    <TouchableOpacity style={globalStyles.backButton} onPress={handleBack}>
                        <Image source={require("../../assets/icons/back_icon.png")} style={globalStyles.backIcon}/>
                    </TouchableOpacity>
                    <Text style={globalStyles.title}>Forgot Password</Text>
                </View>

                <Text style={styles.subtitle}>
                    Enter your registered email address below to receive password reset
                    instructions.
                </Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your email"
                        placeholderTextColor="#838383"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={async () => {
                        if (loading) return;
                        if (!email) {
                            Alert.alert('Error', 'Email is required');
                            return;
                        }
                        setLoading(true);
                        try {
                            const data = await forgotPassword({ type: 'email', contact: email });
                            Alert.alert('Success', data?.message || 'Reset link/OTP sent');
                            router.push({ pathname: '/screens/VerifyOtpScreen', params: { contact: email, type: 'email', mode: 'reset' } });
                        } catch (error) {
                            const message = error?.response?.data?.message || 'Failed to start password reset';
                            Alert.alert('Error', message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Confirm'}</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 40,
    },
    inner: {
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: "500",
        color: "#000000",
        textAlign: "center",
        marginBottom: 20,
        fontFamily: "Poppins",
    },
    subtitle: {
        fontSize: 14,
        color: "#838383",
        fontFamily: "Poppins",
        lineHeight: 21,
        textAlign: "center",
        marginBottom: 40,
    },
    form: {
        gap: 8,
        marginBottom: 40,
    },
    label: {
        fontSize: 16,
        color: "#1B1B1B",
        fontFamily: "Poppins",
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderColor: "#E6E6E6",
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 14,
        color: "#000",
        backgroundColor: "#FFFFFF",
    },
    button: {
        backgroundColor: "#4CAD73",
        height: 48,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins",
    },
});

// ForgotPasswordScreen.js
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    Alert,
    ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { globalStyles } from "../../constants/globalStyles";
import { useRouter } from 'expo-router';
import { forgotPassword } from '../../api/authApi';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const router = useRouter();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/screens/LoginScreen');
        }
    };

    // Validate email format
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    // Clear errors
    const clearErrors = () => {
        setErrors({});
    };

    // Handle forgot password submission
    const handleForgotPassword = async () => {
        clearErrors();

        // Validation
        if (!email.trim()) {
            setErrors({ email: "Email is required" });
            Alert.alert("Error", "Please enter your email address");
            return;
        }

        if (!validateEmail(email.trim())) {
            setErrors({ email: "Please enter a valid email address" });
            Alert.alert("Error", "Please enter a valid email address");
            return;
        }

        if (loading) return;

        setLoading(true);

        try {
            const response = await forgotPassword({
                type: 'email',
                contact: email.trim()
            });

            // Check if the request was successful
            if (response?.success === false) {
                // If success is false, show the message and don't navigate
                Alert.alert("Information", response.message || "No account found with this email");
                return;
            }

            // Only proceed to OTP screen if success is true
            const message = response?.message ||
                response?.data?.message ||
                "Password reset instructions sent successfully";

            // Show success message
            Alert.alert("Success", message, [
                {
                    text: "OK",
                    onPress: () => {
                        // Navigate to OTP verification screen with appropriate parameters
                        router.push({
                            pathname: '/screens/VerifyOtpScreen',
                            params: {
                                contact: email.trim(),
                                type: 'email',
                                mode: 'reset',
                                // Pass masked contact info for display
                                ...(response?.data?.contact && { maskedContact: response.data.contact })
                            }
                        });
                    }
                }
            ]);

        } catch (error) {
            console.error("Forgot Password Error:", error);

            // Handle different error structures
            let errorMessage = "Failed to process your request. Please try again.";

            if (error.response) {
                // Server responded with error status
                const serverError = error.response.data;

                // Check if this is a "not found" response (backend returns 200 with success: false)
                if (serverError?.success === false) {
                    errorMessage = serverError?.message || "No account found with this email address";
                } else {
                    errorMessage = serverError?.message ||
                        serverError?.error ||
                        serverError?.msg ||
                        `Server error: ${error.response.status}`;

                    // Handle specific HTTP status codes
                    if (error.response.status === 400) {
                        errorMessage = serverError?.message || "Invalid request. Please check your input.";
                    } else if (error.response.status === 403) {
                        errorMessage = serverError?.message || "Account is not active. Please contact support.";
                    } else if (error.response.status === 429) {
                        errorMessage = "Too many attempts. Please try again later.";
                    } else if (error.response.status === 500) {
                        errorMessage = "Server error. Please try again later.";
                    }
                }
            } else if (error.request) {
                // Request made but no response
                errorMessage = "No response from server. Please check your internet connection";
            } else {
                // Something else happened
                errorMessage = error.message || "An unexpected error occurred";
            }

            Alert.alert("Error", errorMessage);

            // Optionally set error state for UI
            setErrors({
                email: errorMessage.includes("email") ? errorMessage : "Failed to send reset instructions"
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle social media account case
    const checkSocialMediaAccount = () => {
        Alert.alert(
            "Social Media Account",
            "This email is associated with a social media login. Please use the social login option to access your account.",
            [
                { text: "OK", style: "default" },
                {
                    text: "Back to Login",
                    onPress: () => router.replace('/screens/AuthScreen')
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.inner}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            >
                <View style={globalStyles.header}>
                    <Pressable style={globalStyles.backButton} onPress={handleBack}>
                        <Image
                            source={require("../../assets/icons/back_icon.png")}
                            style={globalStyles.backIcon}
                        />
                    </Pressable>
                    <Text style={globalStyles.title}>Forgot Password</Text>
                </View>

                <Text style={styles.subtitle}>
                    Enter your registered email address below to receive password reset instructions.
                </Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={[
                            styles.input,
                            errors.email && styles.inputError
                        ]}
                        placeholder="Enter your email address"
                        placeholderTextColor="#838383"
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            clearErrors();
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                        onBlur={() => {
                            if (email && !validateEmail(email)) {
                                setErrors({ email: "Please enter a valid email" });
                            }
                        }}
                    />
                    {errors.email && (
                        <Text style={styles.errorText}>{errors.email}</Text>
                    )}
                </View>

                <Pressable
                    style={[
                        styles.button,
                        loading && styles.buttonDisabled
                    ]}
                    onPress={handleForgotPassword}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.buttonText}>Send Reset Instructions</Text>
                    )}
                </Pressable>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    inner: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    subtitle: {
        fontSize: 14,
        color: "#838383",
        fontFamily: "Poppins",
        lineHeight: 21,
        textAlign: "center",
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    form: {
        gap: 8,
        marginBottom: 30,
    },
    label: {
        fontSize: 16,
        color: "#1B1B1B",
        fontFamily: "Poppins",
        marginBottom: 8,
        fontWeight: "500",
    },
    input: {
        height: 56,
        borderColor: "#E6E6E6",
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: "#000",
        backgroundColor: "#FFFFFF",
        fontFamily: "Poppins",
    },
    inputError: {
        borderColor: "#FF4444",
        backgroundColor: "#FFF5F5",
    },
    errorText: {
        fontSize: 12,
        color: "#FF4444",
        fontFamily: "Poppins",
        marginTop: 4,
        marginLeft: 4,
    },
    button: {
        backgroundColor: "#4CAD73",
        height: 56,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#4CAD73",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: "#AFAFAF",
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "Poppins",
    },
    helpSection: {
        marginTop: 30,
        gap: 16,
    },
    helpText: {
        fontSize: 14,
        color: "#666",
        fontFamily: "Poppins",
        textAlign: "center",
        lineHeight: 20,
    },
    resendText: {
        color: "#4CAD73",
        fontWeight: "600",
        textDecorationLine: "underline",
    },
    loginText: {
        color: "#4CAD73",
        fontWeight: "600",
        textDecorationLine: "underline",
    },
});
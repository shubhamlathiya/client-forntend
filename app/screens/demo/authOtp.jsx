// screens/VerifyOtpScreen.js - Updated version
import React, {useRef, useState} from "react";
import {View, Text, TextInput, Pressable, StyleSheet, Image,Alert, ActivityIndicator} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {globalStyles} from "../../../constants/globalStyles";
import { useLocalSearchParams, useRouter } from 'expo-router';
import {verifyEmail, resendResetOTP, resendVerification} from '../../../api/authApi'; // Updated imports

export default function AuthOtp() {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [timer, setTimer] = useState(60); // Timer for resend OTP
    const { email, mode, redirectTo } = useLocalSearchParams(); // Get email and mode from params
    const router = useRouter();
    const inputsRef = useRef([]);

    // Timer effect for resend OTP
    React.useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timer]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/screens/LoginScreen');
        }
    };

    const handleChange = (value, index) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Move focus forward or backward
        if (value && index < newOtp.length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
        if (!value && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e?.nativeEvent?.key === 'Backspace' && !otp[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    async function handleVerifyOtp() {
        if (loading) return;

        const code = otp.join('');
        if (code.length !== 6) {
            Alert.alert('Error', 'Please enter the 6-digit code');
            return;
        }

        if (!email) {
            Alert.alert('Error', 'Email not found. Please try again.');
            return;
        }

        setLoading(true);
        try {
            const response = await verifyEmail({
                email: String(email),
                otp: code
            });

            if (response.success) {
                Alert.alert('Success', 'Your account has been verified! You can now login.');
                router.replace('/screens/LoginScreen');
            } else {
                Alert.alert('Error', response.message || 'OTP verification failed');
            }
        } catch (error) {
            console.error("OTP Verification Error:", error);
            const message = error.message ||
                error?.message ||
                'OTP verification failed. Please try again.';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    }

    async function handleResendOtp() {
        if (resendLoading || timer > 0) return;

        setResendLoading(true);
        try {
            const response = await resendVerification({
                type: 'email',
                contact: String(email)
            });

            if (response.success) {
                Alert.alert('Success', response.message || 'New OTP sent to your email');
                setTimer(60); // Reset timer
                // Clear OTP fields
                setOtp(["", "", "", "", "", ""]);
                // Focus on first input
                inputsRef.current[0]?.focus();
            } else {
                Alert.alert('Error', response.message || 'Failed to resend OTP');
            }
        } catch (error) {
            console.error("Resend OTP Error:", error);
            const message = error?.response?.data?.message ||
                error?.message ||
                'Failed to resend OTP';
            Alert.alert('Error', message);
        } finally {
            setResendLoading(false);
        }
    }

    // Format timer to MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={globalStyles.header}>
                <Pressable onPress={handleBack}>
                    <Image
                        source={require("../../../assets/icons/back_icon.png")}
                        style={globalStyles.backIcon}
                    />
                </Pressable>
                <Text style={globalStyles.title}>Verify OTP</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.messageContainer}>
                    <Text style={styles.title}>Enter Verification Code</Text>
                    <Text style={styles.subtitle}>
                        We have sent a verification code to
                    </Text>
                    <Text style={styles.emailText}>{email}</Text>
                </View>

                <View style={styles.inputRow}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(el) => (inputsRef.current[index] = el)}
                            style={[
                                styles.inputBox,
                                digit && styles.inputBoxFilled
                            ]}
                            keyboardType="numeric"
                            maxLength={1}
                            value={digit}
                            onChangeText={(value) => handleChange(value, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            editable={!loading && !resendLoading}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <View style={styles.timerContainer}>
                    <Text style={styles.timerText}>
                        {timer > 0 ? `Resend OTP in ${formatTime(timer)}` : 'You can now resend OTP'}
                    </Text>
                </View>

                <Pressable
                    style={[
                        styles.resendButton,
                        (timer > 0 || resendLoading) && styles.resendButtonDisabled
                    ]}
                    onPress={handleResendOtp}
                    disabled={timer > 0 || resendLoading}
                >
                    {resendLoading ? (
                        <ActivityIndicator color="#4CAD73" size="small" />
                    ) : (
                        <Text style={[
                            styles.resendButtonText,
                            timer > 0 && styles.resendButtonTextDisabled
                        ]}>
                            Resend OTP
                        </Text>
                    )}
                </Pressable>

                <Pressable
                    style={[
                        styles.verifyButton,
                        (loading || otp.join('').length !== 6) && styles.buttonDisabled
                    ]}
                    onPress={handleVerifyOtp}
                    disabled={loading || otp.join('').length !== 6}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.verifyButtonText}>Verify OTP</Text>
                    )}
                </Pressable>

                <Pressable
                    style={styles.backToLogin}
                    onPress={() => router.replace('/screens/LoginScreen')}
                >
                    <Text style={styles.backToLoginText}>Back to Login</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        alignItems: "center",
    },
    messageContainer: {
        alignItems: "center",
        marginBottom: 40,
    },
    title: {
        fontFamily: "Poppins-SemiBold",
        fontSize: 24,
        color: "#1B1B1B",
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        fontFamily: "Poppins-Regular",
        fontSize: 14,
        color: "#838383",
        textAlign: "center",
        marginBottom: 4,
    },
    emailText: {
        fontFamily: "Poppins-SemiBold",
        fontSize: 16,
        color: "#4CAD73",
        textAlign: "center",
    },
    inputRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 24,
    },
    inputBox: {
        width: 48,
        height: 60,
        borderWidth: 1,
        borderColor: "#E6E6E6",
        borderRadius: 12,
        textAlign: "center",
        fontSize: 24,
        fontFamily: "Poppins-SemiBold",
        color: "#1B1B1B",
        backgroundColor: "#FAFAFA",
    },
    inputBoxFilled: {
        borderColor: "#4CAD73",
        backgroundColor: "#FFFFFF",
    },
    timerContainer: {
        marginBottom: 16,
    },
    timerText: {
        fontSize: 14,
        color: "#838383",
        fontFamily: "Poppins-Regular",
    },
    resendButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    resendButtonDisabled: {
        opacity: 0.5,
    },
    resendButtonText: {
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins",
        color: "#4CAD73",
    },
    resendButtonTextDisabled: {
        color: "#AFAFAF",
    },
    verifyButton: {
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        width: "100%",
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 24,
        shadowColor: "#4CAD73",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: "#AFAFAF",
        shadowColor: "#AFAFAF",
    },
    verifyButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "Poppins",
    },
    backToLogin: {
        paddingVertical: 12,
    },
    backToLoginText: {
        fontSize: 16,
        color: "#4CAD73",
        fontFamily: "Poppins-Regular",
        textDecorationLine: "underline",
    },
});
// screens/VerifyOtpScreen.js - Updated version
import React, {useRef, useState} from "react";
import {View, Text, TextInput, Pressable, StyleSheet, Image,Alert, ActivityIndicator} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {globalStyles} from "../../constants/globalStyles";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { verifyResetOTP, resendResetOTP } from '../../api/authApi'; // Updated imports

export default function VerifyOtpScreen() {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const { contact, type, mode } = useLocalSearchParams();
    const router = useRouter();
    const inputsRef = useRef([]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.replace('/screens/LoginScreen');
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

    async function handleConfirm() {
        if (loading) return;

        const code = otp.join('');
        if (code.length !== 6) {
            Alert.alert('Error', 'Please enter the 6-digit code');
            return;
        }

        // Only handle reset password mode
        if (String(mode || '') === 'reset') {
            setLoading(true);
            try {
                const response = await verifyResetOTP({
                    type: type || 'email',
                    contact: String(contact || ''),
                    token: code
                });
                if (response.success) {
                    // Navigate to reset password screen with the secure token
                    router.push({
                        pathname: '/screens/ResetPasswordScreen',
                        params: {
                            contact: String(contact || ''),
                            type: type || 'email',
                            resetToken: response.data?.resetToken,
                            userId: response.data?.userId
                        }
                    });
                } else {
                    Alert.alert('Error', response.message || 'OTP verification failed');
                }
            } catch (error) {
                const message = error?.response?.data?.message || 'OTP Not Match';
                Alert.alert('Error', message);
            } finally {
                setLoading(false);
            }
        }
    }

    async function handleResend() {
        if (resendLoading) return;

        setResendLoading(true);
        try {
            const response = await resendResetOTP({
                type: type || 'email',
                contact: String(contact || '')
            });

            if (response.success) {
                Alert.alert('Success', response.message || 'New OTP sent');
            } else {
                Alert.alert('Error', response.message || 'Failed to resend OTP');
            }
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to resend OTP';
            Alert.alert('Error', message);
        } finally {
            setResendLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={globalStyles.header}>
                <Pressable onPress={handleBack}>
                    <Image
                        source={require("../../assets/icons/back_icon.png")}
                        style={globalStyles.backIcon}
                    />
                </Pressable>
                <Text style={globalStyles.title}>Verify OTP</Text>
            </View>

            <View style={{alignItems: "center"}}>
                <Text style={styles.label}>
                    Please enter the 6-digit code sent to your {type === 'email' ? 'email' : 'phone'}.
                </Text>

                <View style={styles.inputRow}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(el) => (inputsRef.current[index] = el)}
                            style={styles.inputBox}
                            keyboardType="numeric"
                            maxLength={1}
                            value={digit}
                            onChangeText={(value) => handleChange(value, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            editable={!loading}
                        />
                    ))}
                </View>

                <Text style={styles.notice}>
                    A 6-digit code has been sent to your {type === 'email' ? 'email address' : 'phone number'}
                </Text>

                <Pressable
                    style={styles.resendContainer}
                    onPress={handleResend}
                    disabled={resendLoading}
                >
                    {resendLoading ? (
                        <ActivityIndicator color="#4CAD73" size="small" />
                    ) : (
                        <Text style={styles.resendText}>Resend OTP</Text>
                    )}
                </Pressable>

                <Pressable
                    style={[
                        styles.confirmBtn,
                        (loading || otp.join('').length !== 6) && styles.buttonDisabled
                    ]}
                    onPress={handleConfirm}
                    disabled={loading || otp.join('').length !== 6}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.confirmText}>Verify OTP</Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    label: {
        fontFamily: "Poppins",
        fontSize: 14,
        color: "#838383",
        width: "85%",
        textAlign: "center",
        marginBottom: 40,
        lineHeight: 21,
    },
    inputRow: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        width: "85%",
        marginBottom: 30,
    },
    inputBox: {
        width: 45,
        height: 58,
        borderBottomWidth: 1,
        borderBottomColor: "#838383",
        textAlign: "center",
        fontSize: 22,
        fontFamily: "Poppins",
        color: "#1B1B1B",
    },
    notice: {
        fontSize: 14,
        color: "#838383",
        fontFamily: "Poppins",
        textAlign: "center",
        marginBottom: 10,
    },
    resendContainer: {
        marginBottom: 50,
        padding: 10,
    },
    resendText: {
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins",
        color: "#4CAD73",
    },
    confirmBtn: {
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        width: "85%",
        paddingVertical: 16,
        alignItems: "center",
    },
    buttonDisabled: {
        backgroundColor: "#AFAFAF",
    },
    confirmText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins",
    },
});
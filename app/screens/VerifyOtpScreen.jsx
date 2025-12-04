// screens/VerifyOtpScreen.js
import React, {useRef, useState} from "react";
import {View, Text, TextInput, Pressable, StyleSheet, Image,Alert} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {globalStyles} from "../../constants/globalStyles";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { verifyEmail, resendVerification, forgotPassword } from '../../api/authApi';
import * as SecureStore from 'expo-secure-store';

export default function VerifyOtpScreen() {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [otpCode, setOtpCode] = useState("");
    const [loading, setLoading] = useState(false);
    const { email, contact, type, mode } = useLocalSearchParams();
    const router = useRouter();
    const inputsRef = useRef([]);

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

        const code = newOtp.join('');
        setOtpCode(code);
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
        // Reset-password mode: treat OTP as token and navigate directly
        if (String(mode || '') === 'reset') {
            try {
                await SecureStore.setItemAsync('resetToken', code);
                const identifier = String(contact || email || '');
                const contactType = String(type || 'email');
                router.replace({ pathname: '/screens/ResetPasswordScreen', params: { contact: identifier, type: contactType } });
                return;
            } catch (error) {
                Alert.alert('Error', 'Failed to proceed to reset password');
                return;
            }
        }

        setLoading(true);
        try {
            const identifier = String(contact || email || '');
            const data = await verifyEmail({ email: identifier, otp: code });
            Alert.alert('Success', data?.message || 'Email verified successfully');
            router.replace('/screens/LoginScreen');
        } catch (error) {
            const message = error?.response?.data?.message || 'Verification failed';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        try {
            const identifier = String(contact || email || '');
            const contactType = String(type || 'email');
            if (String(mode || '') === 'reset') {
                const data = await forgotPassword({ type: contactType, contact: identifier });
                Alert.alert('Info', data?.message || 'Reset OTP resent');
            } else {
                const data = await resendVerification({ type: contactType, contact: identifier });
                Alert.alert('Info', data?.message || 'OTP resent');
            }
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to resend OTP';
            Alert.alert('Error', message);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={globalStyles.header}>

                <Image source={require("../../assets/icons/back_icon.png")} style={globalStyles.backIcon}/>
                <Text style={globalStyles.title}>Verify OTP</Text>
            </View>

            <View style={{alignItems: "center"}}>
                <Text style={styles.label}>Please enter the 6-digit code sent to your phone.</Text>

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
                        />
                    ))}
                </View>

                <Text style={styles.notice}>A code has been sent to your phone</Text>
                <Pressable style={styles.resendContainer} onPress={handleResend}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                </Pressable>

                <Pressable style={styles.confirmBtn} onPress={handleConfirm} disabled={loading || otpCode.length !== 6}>
                    <Text style={styles.confirmText}>{loading ? 'Loading...' : 'Confirm'}</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 40,
        paddingStart :10
    },
    title: {
        fontFamily: "Poppins",
        fontSize: 24,
        fontWeight: "500",
        color: "#000",
        marginBottom: 20,
    },
    label: {
        fontFamily: "Poppins",
        fontSize: 14,
        color: "#838383",
        width: "85%",
        textAlign: "center",
        marginBottom: 40,
    },
    inputRow: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        width: "85%",
        marginBottom: 30,
    },
    inputBox: {
        width: 50,
        height: 58,
        borderBottomWidth: 1,
        borderBottomColor: "#838383",
        textAlign: "center",
        fontSize: 22,
        fontFamily: "Plus Jakarta Sans",
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
    },
    resendText: {
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins",
        color: "#1B1B1B",
    },
    confirmBtn: {
        backgroundColor: "#4CAD73",
        borderRadius: 12,
        width: "85%",
        paddingVertical: 14,
        alignItems: "center",
    },
    confirmText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins",
    },
});

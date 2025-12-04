import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, Pressable, StyleSheet, Image, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {globalStyles} from '../../constants/globalStyles';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {resetPassword} from '../../api/authApi';
import * as SecureStore from 'expo-secure-store';

export default function ResetPasswordScreen() {
    const {contact, type} = useLocalSearchParams();
    const router = useRouter();
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Prefill token automatically from OTP stored during verification
        (async () => {
            try {
                const stored = await SecureStore.getItemAsync('resetToken');
                if (stored) setToken(stored);
            } catch {
            }
        })();
    }, []);

    async function handleReset() {
        if (loading) return;
        if (!token || !newPassword) {
            Alert.alert('Error', 'Token and new password are required');
            return;
        }
        setLoading(true);
        try {
            const data = await resetPassword({
                type: String(type || 'email'),
                contact: String(contact || ''),
                token,
                newPassword
            });
            Alert.alert('Success', data?.message || 'Password reset successfully');
            try {
                await SecureStore.deleteItemAsync('resetToken');
            } catch {
            }
            router.replace('/screens/LoginScreen');
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to reset password';
            Alert.alert('Error', message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={globalStyles.header}>
                <Pressable style={globalStyles.backButton}>
                    <Image source={require('../../assets/icons/back_icon.png')} style={globalStyles.backIcon}/>
                </Pressable>
                <Text style={globalStyles.title}>Reset Password</Text>
            </View>

            <View style={styles.form}>

                <Text style={styles.label}>New Password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="#838383"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                />

                <Pressable style={styles.button} onPress={handleReset} disabled={loading}>
                    <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Confirm'}</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 40,
        paddingHorizontal: 20,
    },
    form: {
        marginTop: 40,
    },
    label: {
        fontSize: 16,
        color: '#1B1B1B',
        fontFamily: 'Poppins',
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderColor: '#E6E6E6',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 14,
        color: '#000',
        backgroundColor: '#FFFFFF',
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#4CAD73',
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'Poppins',
    },
});

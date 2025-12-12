import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Text, TouchableOpacity, Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import logo from '../../assets/Logo.png';

export default function SplashScreen() {
    const [isConnected, setIsConnected] = useState(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });

        return () => unsubscribe();
    }, []);

    const openSettings = () => {
        Linking.openSettings(); // opens device settings
    };

    // If offline show message + option to enable internet
    if (!isConnected) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.offlineBox}>
                    <Text style={styles.offlineText}>No internet connection</Text>

                    <TouchableOpacity style={styles.button} onPress={openSettings}>
                        <Text style={styles.buttonText}>Open Settings</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // If online show original splash
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.logoContainer}>
                <Image source={logo} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#4CAD73',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: 33,
        height: 101,
        borderRadius: 6,
        justifyContent: 'center',
    },

    offlineBox: {
        alignItems: 'center',
    },
    offlineText: {
        color: '#fff',
        fontSize: 18,
        marginBottom: 15,
    },
    button: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    buttonText: {
        color: '#4CAD73',
        fontSize: 16,
        fontWeight: '600',
    },
});

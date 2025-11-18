import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import logo from '../../assets/Logo.png';
import {SafeAreaView} from "react-native-safe-area-context";

export default function SplashScreen() {
    return (
        <SafeAreaView style={styles.container}>
            {/* Logo Center */}
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
    },
    logoBar: {
        width: 33,
        height: 101,
        backgroundColor: '#FFFFFF',
        borderRadius: 6,
    },
});

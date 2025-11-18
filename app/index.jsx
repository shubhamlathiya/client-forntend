import React, {useEffect} from "react";
import {View} from "react-native";
import {useRouter} from "expo-router";
import SplashScreen from "./screens/SplashScreen";
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateSessionId } from '../api/cartApi';


export default function Index() {
    const router = useRouter();

    useEffect(() => {
        (async () => {
            try {
                // Initialize/verify session ID for cart on app load
                // Fire and forget to avoid blocking navigation
                getOrCreateSessionId().catch(() => {});
                const token = await SecureStore.getItemAsync('accessToken');
                if (token) {
                    // After login, ensure loginType is selected
                    const lt = await AsyncStorage.getItem('loginType');
                    if (lt) {
                        router.replace('/Home');
                    } else {
                        router.replace('/screens/LoginTypeSelectionScreen');
                    }
                } else {
                    router.replace('/screens/LoginScreen');
                }
            } catch {
                router.replace('/screens/LoginScreen');
            }
        })();
    }, []);

    return (
        <View style={{flex: 1}}>
            <SplashScreen/>
            {/*<VerifyOtpScreen/>*/}
            {/*<HomeScreen />*/}
        </View>
    );
}

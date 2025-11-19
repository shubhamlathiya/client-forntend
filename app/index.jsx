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
        const timer = setTimeout(() => {
            (async () => {
                try {
                    // Initialize session ID for cart
                    getOrCreateSessionId().catch(() => {});

                    const token = await SecureStore.getItemAsync('accessToken');

                    if (token) {
                        const lt = await AsyncStorage.getItem('loginType');

                        if (lt) {
                            // Route based on login type logic
                            if (lt === 'business') {
                                router.replace('/Home');
                            } else {
                                router.replace('/Home'); // individual
                            }
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
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={{flex: 1}}>
            <SplashScreen/>
            {/*<VerifyOtpScreen/>*/}
            {/*<HomeScreen />*/}
        </View>
    );
}

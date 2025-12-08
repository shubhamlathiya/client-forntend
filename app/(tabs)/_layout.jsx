import { Tabs } from 'expo-router';
import React from 'react';
import { Image, View, Platform } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: 'absolute',
                    width: '100%',
                    height: 60 + insets.bottom,
                    bottom: 0,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 25,
                    borderTopRightRadius: 25,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -5 },
                    shadowOpacity: 0.08,
                    shadowRadius: 25,
                    elevation: 15,
                    paddingHorizontal: 20,
                    paddingBottom: insets.bottom,
                    paddingTop: 10,
                },
            }}
        >
            {/* Home Tab */}
            <Tabs.Screen
                name="Home"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={{ alignItems: 'center', marginTop: 5 }}>
                            <Image
                                source={focused ?
                                    require("../../assets/icons/home_green.png") :
                                    require("../../assets/icons/home.png")
                                }
                                style={{ width: 50, height: 50 }}
                                resizeMode="contain"
                            />
                        </View>
                    ),
                }}
            />

            {/* Cart Tab */}
            <Tabs.Screen
                name="Cart"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={{ alignItems: 'center', marginTop: 5}}>
                            <Image
                                source={focused ?
                                    require("../../assets/icons/cart_green.png") :
                                    require("../../assets/icons/cart.png")
                                }
                                style={{ width: 50, height: 50 }}
                                resizeMode="contain"
                            />
                        </View>
                    ),
                }}
            />

            {/* Order Tab */}
            <Tabs.Screen
                name="Order"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={{ alignItems: 'center', marginTop: 5}}>
                            <Image
                                source={focused ?
                                    require("../../assets/icons/order_green.png") :
                                    require("../../assets/icons/order_menu.png")
                                }
                                style={{ width: 58, height: 58 }}
                                resizeMode="contain"
                            />
                        </View>
                    ),
                }}
            />

            {/* Account Tab */}
            <Tabs.Screen
                name="Account"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <View style={{ alignItems: 'center', marginTop: 5 }}>
                            <Image
                                source={focused ?
                                    require("../../assets/icons/account_green.png") :
                                    require("../../assets/icons/account.png")
                                }
                                style={{ width: 55, height: 55 }}
                                resizeMode="contain"
                            />
                        </View>
                    ),
                }}
            />
        </Tabs>
    );
}
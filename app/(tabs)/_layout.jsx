import {Tabs} from 'expo-router';
import React from 'react';
import {Image, View} from "react-native";

export default function TabLayout() {
    const tabConfig = [
        {
            name: "Home",
            title: "Home",
            icon: require("../../assets/icons/home.png"),
            activeIcon: require("../../assets/icons/home_green.png"),
        },
        {
            name: "Cart",
            title: "Cart",
            icon: require("../../assets/icons/cart.png"),
            activeIcon: require("../../assets/icons/cart_green.png"),
        },
        {
            name: "Account",
            title: "Account",
            icon: require("../../assets/icons/account.png"),
            activeIcon: require("../../assets/icons/account_green.png"),
        },
        {
            name: "Order",
            title: "Order",
            icon: require("../../assets/icons/order_menu.png"),
            activeIcon: require("../../assets/icons/order_green.png"),
        }
    ];

    const TabItem = ({focused, icon, activeIcon}) => (
        <View style={{
            justifyContent: 'center',
            marginTop: 30,
            width: 65,
            height: 65,
        }}>
            <Image
                source={focused ? activeIcon : icon}
                style={{
                    width: 50,
                    height: 50,
                }}
                resizeMode="contain"
            />
        </View>
    );

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: 'absolute',
                    width: '100%',
                    height: 90,
                    bottom: 0,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 40,
                    borderTopRightRadius: 40,
                    shadowColor: '#000',
                    shadowOffset: {width: 0, height: -10},
                    shadowOpacity: 0.07,
                    shadowRadius: 70,
                    elevation: 10,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                },
            }}
        >
            {/* Home Tab */}
            <Tabs.Screen
                name="Home"
                options={{
                    tabBarIcon: ({focused}) => (
                        <TabItem
                            focused={focused}
                            icon={require("../../assets/icons/home.png")}
                            activeIcon={require("../../assets/icons/home_green.png")}
                        />
                    ),
                }}
            />

            {/* Cart Tab */}
            <Tabs.Screen
                name="Cart"
                options={{
                    tabBarIcon: ({focused}) => (
                        <TabItem
                            focused={focused}
                            icon={require("../../assets/icons/cart.png")}
                            activeIcon={require("../../assets/icons/cart_green.png")}
                        />
                    ),
                }}
            />
            {/* Order Tab */}
            <Tabs.Screen
                name="Order"
                options={{
                    tabBarIcon: ({focused}) => (
                        <TabItem
                            focused={focused}
                            icon={require("../../assets/icons/order_menu.png")}
                            activeIcon={require("../../assets/icons/order_green.png")}
                        />
                    ),
                }}
            />
            {/* Account Tab */}
            <Tabs.Screen
                name="Account"
                options={{
                    tabBarIcon: ({focused}) => (
                        <TabItem
                            focused={focused}
                            icon={require("../../assets/icons/account.png")}
                            activeIcon={require("../../assets/icons/account_green.png")}
                        />
                    ),
                }}
            />


        </Tabs>
    );
}